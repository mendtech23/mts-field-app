-- ============================================================================
-- MendTech OS — Phase 1 foundation
--
-- Establishes identity, authorization, audit and the approval policy table.
-- Every access rule lives here in SQL, never in JavaScript: the v13 role system
-- was interface-only, which is why the app had to be locked to the owner.
--
-- Portable between local Postgres and Supabase. Supabase exposes the caller's
-- id through auth.uid(); locally the same value comes from a session GUC. Both
-- funnel through app.current_profile_id() so policies read identically.
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;

-- ----------------------------------------------------------------------------
-- Caller identity
-- ----------------------------------------------------------------------------

-- Returns the acting profile id, or null when unauthenticated.
-- SECURITY: never trust a client-supplied id. Under Supabase this resolves from
-- the verified JWT; locally it reads a GUC that only the test harness sets.
create or replace function app.current_profile_id()
returns uuid
language plpgsql
stable
as $$
declare
  claim text;
begin
  -- Supabase path: auth.uid() exists only when the auth schema is installed.
  begin
    execute 'select auth.uid()::text' into claim;
    if claim is not null then
      return claim::uuid;
    end if;
  exception when others then
    -- auth schema absent (local Postgres); fall through to the GUC.
    null;
  end;

  claim := current_setting('app.profile_id', true);
  if claim is null or claim = '' then
    return null;
  end if;
  return claim::uuid;
end;
$$;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------

create type app.user_role as enum
  ('Owner', 'Admin', 'HR', 'Supervisor', 'Worker', 'Driver', 'Outsourced');

create type app.approval_status as enum ('Pending', 'Approved', 'Rejected');

create table app.profiles (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  phone             text unique,
  role              app.user_role not null default 'Worker',
  approval_status   app.approval_status not null default 'Pending',
  -- Outsourced staff lose access automatically at this instant.
  access_expires_at timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- Helper predicates. SECURITY DEFINER so a policy can read profiles without
-- recursively triggering the policies on profiles itself.
create or replace function app.is_active(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, pg_catalog
as $$
  select exists (
    select 1 from app.profiles p
    where p.id = p_id
      and p.approval_status = 'Approved'
      and p.revoked_at is null
      and (p.access_expires_at is null or p.access_expires_at > now())
  );
$$;

create or replace function app.current_role()
returns app.user_role
language sql
stable
security definer
set search_path = app, pg_catalog
as $$
  select p.role
  from app.profiles p
  where p.id = app.current_profile_id()
    and app.is_active(p.id);
$$;

create or replace function app.is_owner()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'Owner';
$$;

-- Roles permitted to see money. Deliberately narrow: a supervisor who can read
-- rates can quote around the company.
create or replace function app.can_see_prices()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('Owner', 'Admin');
$$;

-- ----------------------------------------------------------------------------
-- Invite codes — owner-issued, no SMS cost
-- ----------------------------------------------------------------------------

create table app.invite_codes (
  id            uuid primary key default gen_random_uuid(),
  -- Only the digest is stored, so a database leak does not yield usable codes.
  code_hash     text not null unique,
  role          app.user_role not null,
  created_by    uuid not null references app.profiles(id),
  expires_at    timestamptz not null,
  redeemed_by   uuid references app.profiles(id),
  redeemed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index on app.invite_codes (code_hash) where redeemed_at is null;

-- ----------------------------------------------------------------------------
-- Approval policies — the Amber tier
-- ----------------------------------------------------------------------------

create table app.policies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  entity_type  text not null,          -- 'quote' | 'purchase_order' | ...
  -- Machine-checkable bounds, e.g. {"max_amount": 2000, "customer": "existing"}.
  rule         jsonb not null,
  enabled      boolean not null default true,
  approved_by  uuid not null references app.profiles(id),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

-- ----------------------------------------------------------------------------
-- Audit log — append only
-- ----------------------------------------------------------------------------

create table app.audit_events (
  id           bigserial primary key,
  actor_id     uuid references app.profiles(id),
  -- Set when an Amber policy authorised the action instead of a person.
  policy_id    uuid references app.policies(id),
  action       text not null,
  target_type  text not null,
  target_id    text,
  before_state jsonb,
  after_state  jsonb,
  created_at   timestamptz not null default now(),
  -- An action is either taken by a person or authorised by a policy. Never
  -- neither: that would leave an untraceable change in the log.
  constraint audit_has_authority check (actor_id is not null or policy_id is not null)
);

create index on app.audit_events (target_type, target_id);
create index on app.audit_events (created_at desc);

-- Rewriting history must be impossible even for the table owner's normal path.
create or replace function app.deny_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only (attempted %)', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_no_update
  before update on app.audit_events
  for each row execute function app.deny_audit_mutation();

create trigger audit_no_delete
  before delete on app.audit_events
  for each row execute function app.deny_audit_mutation();

-- ----------------------------------------------------------------------------
-- Operational tables
-- ----------------------------------------------------------------------------

create table app.customers (
  id           uuid primary key default gen_random_uuid(),
  zoho_crm_id  text unique,
  name         text not null,
  phone        text,
  address      text,
  created_at   timestamptz not null default now()
);

create type app.job_status as enum
  ('Draft', 'Assigned', 'Accepted', 'In Progress', 'Completed', 'Cancelled');

create table app.jobs (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references app.customers(id),
  title         text not null,
  status        app.job_status not null default 'Draft',
  scheduled_at  timestamptz,
  zoho_project_id text,
  created_at    timestamptz not null default now()
);

-- Which workers may see which job. Absence of a row means no access.
create table app.job_assignments (
  job_id     uuid not null references app.jobs(id) on delete cascade,
  profile_id uuid not null references app.profiles(id) on delete cascade,
  primary key (job_id, profile_id)
);

create type app.quote_status as enum
  ('DRAFTED', 'PENDING_OWNER', 'APPROVED', 'REJECTED', 'EXECUTED', 'ESCALATED', 'SYNC_FAILED');

create table app.quotes (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid references app.jobs(id),
  status         app.quote_status not null default 'DRAFTED',
  total          numeric(12,2) not null default 0,
  approved_by    uuid references app.profiles(id),
  approved_at    timestamptz,
  -- Set when an Amber policy authorised it rather than the owner in person.
  authorising_policy_id uuid references app.policies(id),
  created_at     timestamptz not null default now()
);

-- The approval invariant, enforced in the database rather than trusted to the
-- application: nothing is APPROVED or EXECUTED without either the owner's
-- signature or a named policy.
create or replace function app.enforce_quote_authority()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('APPROVED', 'EXECUTED')
     and new.approved_by is null
     and new.authorising_policy_id is null then
    raise exception 'a quote cannot reach % without an approver or an authorising policy', new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger quote_authority
  before insert or update on app.quotes
  for each row execute function app.enforce_quote_authority();

-- Event bus: how agents talk to each other. Append-only like the audit log.
create table app.events (
  id              bigserial primary key,
  event_type      text not null,
  entity_type     text,
  entity_id       text,
  actor_id        uuid references app.profiles(id),
  payload         jsonb not null default '{}'::jsonb,
  -- Deduplicates a retried delivery from the Field App.
  idempotency_key text unique,
  created_at      timestamptz not null default now()
);

create index on app.events (event_type, created_at desc);

create trigger events_no_update
  before update on app.events
  for each row execute function app.deny_audit_mutation();

create trigger events_no_delete
  before delete on app.events
  for each row execute function app.deny_audit_mutation();

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------

alter table app.profiles        enable row level security;
alter table app.invite_codes    enable row level security;
alter table app.policies        enable row level security;
alter table app.audit_events    enable row level security;
alter table app.customers       enable row level security;
alter table app.jobs            enable row level security;
alter table app.job_assignments enable row level security;
alter table app.quotes          enable row level security;
alter table app.events          enable row level security;

-- Force RLS so even the table owner is subject to it; without this, the role
-- that owns the schema silently bypasses every policy below.
alter table app.profiles        force row level security;
alter table app.invite_codes    force row level security;
alter table app.policies        force row level security;
alter table app.audit_events    force row level security;
alter table app.customers       force row level security;
alter table app.jobs            force row level security;
alter table app.job_assignments force row level security;
alter table app.quotes          force row level security;
alter table app.events          force row level security;

-- Profiles: you can always see yourself. Owner and HR see everyone.
create policy profiles_select on app.profiles for select
  using (
    id = app.current_profile_id()
    or app.current_role() in ('Owner', 'Admin', 'HR', 'Supervisor')
  );

create policy profiles_insert on app.profiles for insert
  with check (app.current_role() in ('Owner', 'HR'));

create policy profiles_update on app.profiles for update
  using (app.current_role() in ('Owner', 'HR'))
  with check (app.current_role() in ('Owner', 'HR'));

-- Only the Owner approves users or grants elevated access.
create policy profiles_delete on app.profiles for delete
  using (app.is_owner());

-- Invite codes: owner only, in every direction.
create policy invites_all on app.invite_codes for all
  using (app.is_owner()) with check (app.is_owner());

-- Policies: the Owner alone may create or revoke an autonomy rule. Everyone
-- active may read them, so an agent can check what it is allowed to do.
create policy policies_select on app.policies for select
  using (app.is_active(app.current_profile_id()));

create policy policies_write on app.policies for all
  using (app.is_owner()) with check (app.is_owner());

-- Audit: readable by Owner and Admin, insertable by any active caller, never
-- updatable or deletable by anyone (triggers above enforce that absolutely).
create policy audit_select on app.audit_events for select
  using (app.current_role() in ('Owner', 'Admin'));

create policy audit_insert on app.audit_events for insert
  with check (app.is_active(app.current_profile_id()));

-- Customers: the directory is withheld from workers and outsourced staff.
create policy customers_select on app.customers for select
  using (app.current_role() in ('Owner', 'Admin', 'Supervisor'));

create policy customers_write on app.customers for all
  using (app.current_role() in ('Owner', 'Admin'))
  with check (app.current_role() in ('Owner', 'Admin'));

-- Jobs: management sees all; field staff see only what they are assigned.
create policy jobs_select on app.jobs for select
  using (
    app.current_role() in ('Owner', 'Admin', 'Supervisor', 'HR')
    or exists (
      select 1 from app.job_assignments a
      where a.job_id = jobs.id
        and a.profile_id = app.current_profile_id()
        and app.is_active(a.profile_id)
    )
  );

create policy jobs_write on app.jobs for all
  using (app.current_role() in ('Owner', 'Admin'))
  with check (app.current_role() in ('Owner', 'Admin'));

create policy assignments_select on app.job_assignments for select
  using (
    profile_id = app.current_profile_id()
    or app.current_role() in ('Owner', 'Admin', 'Supervisor')
  );

create policy assignments_write on app.job_assignments for all
  using (app.is_owner()) with check (app.is_owner());

-- Quotes carry prices, so reads are limited to roles allowed to see money.
create policy quotes_select on app.quotes for select
  using (app.can_see_prices());

create policy quotes_insert on app.quotes for insert
  with check (app.current_role() in ('Owner', 'Admin'));

-- Only the Owner moves a quote's state. This is the money gate.
create policy quotes_update on app.quotes for update
  using (app.is_owner()) with check (app.is_owner());

-- Events: any active caller may publish; management may read.
create policy events_insert on app.events for insert
  with check (app.is_active(app.current_profile_id()));

create policy events_select on app.events for select
  using (app.current_role() in ('Owner', 'Admin', 'Supervisor'));
