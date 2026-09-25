-- ============================================================================================
-- mendtech. Security Level 2 — run once in Supabase → SQL Editor (safe to run again).
-- Needs the v3 scripts first (records table + booking requests). Nothing is deleted.
--
-- What it does
--   • members: every login (Owner, Manager, Advisor, Technician, Driver) belongs to the garage
--   • access enforced by the database (row-level security), per role
--   • protected actions (void/delete invoice, delete payment, big discount, payment link, bank
--     details, reopen month) need an Owner approval that the server issues after checking the
--     Owner's approval PIN — with its own lockout
--   • audit_log: every change, who / when / what — nobody can edit or delete it
--   • devices: every signed-in device; the Owner can cut one off instantly
--   • alerts: security + important events → e-mail (instant) and a daily summary
--   • crew_pull / crew_push: Technicians and Drivers only ever get their own jobs, trimmed
--   • public_quote / public_quote_decide: customer approves a quotation from a link
-- ============================================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;
do $$ begin create extension if not exists pg_net;  exception when others then raise notice 'pg_net not available: turn it on in Database → Extensions'; end $$;
do $$ begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron not available: turn it on in Database → Extensions'; end $$;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ---------- settings the server needs (functions URL, alert e-mail) ----------
create table if not exists app.config (key text primary key, value text);
revoke all on app.config from anon, authenticated;

-- ---------- members ----------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  garage_id  uuid not null,
  username   text not null,
  name       text not null,
  role       text not null check (role in ('owner','manager','advisor','technician','driver')),
  tech_id    text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (garage_id, username)
);
alter table public.members enable row level security;
revoke insert, update, delete, truncate on public.members from anon, authenticated;

-- ---------- devices ----------
create table if not exists public.devices (
  id          uuid primary key default gen_random_uuid(),
  garage_id   uuid not null,
  user_id     uuid not null,
  session_id  uuid,
  label       text,
  user_agent  text,
  ip          text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  revoked     boolean not null default false,
  revoked_at  timestamptz,
  revoked_by  uuid
);
create index if not exists devices_user on public.devices (user_id, session_id);
alter table public.devices enable row level security;
revoke insert, update, delete, truncate on public.devices from anon, authenticated;

-- ---------- helpers (security definer: they read members / devices without exposing them) ----------
create or replace function app.my_member() returns public.members
  language sql stable security definer set search_path = public, app as $$
  select m.* from public.members m where m.user_id = auth.uid() $$;

-- the garage this login works for. A login without a member row is the garage account itself
-- (the original shared login) — it keeps full access to its own data until the changeover.
create or replace function app.my_garage() returns uuid
  language sql stable security definer set search_path = public, app as $$
  select case
    when auth.uid() is null then null
    when not exists (select 1 from public.members where user_id = auth.uid()) then auth.uid()
    else (select garage_id from public.members where user_id = auth.uid() and active)
  end $$;

create or replace function app.my_role() returns text
  language sql stable security definer set search_path = public, app as $$
  select case
    when auth.uid() is null then null
    when not exists (select 1 from public.members where user_id = auth.uid()) then 'owner'
    else (select role from public.members where user_id = auth.uid() and active)
  end $$;

-- the Owner must use the authenticator code once one is set up (that is the changeover)
create or replace function app.mfa_ok() returns boolean
  language sql stable security definer set search_path = public, auth, app as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified') $$;

create or replace function app.session_ok() returns boolean
  language sql stable security definer set search_path = public, app as $$
  select not exists (select 1 from public.devices d
                     where d.user_id = auth.uid() and d.revoked
                       and d.session_id::text = coalesce(auth.jwt()->>'session_id', '-')) $$;

-- who may read / write which collection directly (Technicians & Drivers: nothing — they use crew_pull/crew_push)
create or replace function app.can_access(p_coll text) returns boolean
  language plpgsql stable security definer set search_path = public, app as $$
declare r text := app.my_role();
begin
  if r is null or not app.session_ok() then return false; end if;
  if r = 'owner' then return app.mfa_ok(); end if;
  if r = 'manager' then return p_coll not in ('staff', 'secLog'); end if;
  if r = 'advisor' then return p_coll not in ('staff', 'secLog', 'expenses'); end if;
  return false;
end $$;

-- ---------- records: row-level security by role ----------
alter table public.records enable row level security;
drop policy if exists "own rows" on public.records;
drop policy if exists "garage read" on public.records;
drop policy if exists "garage insert" on public.records;
drop policy if exists "garage update" on public.records;
create policy "garage read" on public.records for select to authenticated
  using (owner = (select app.my_garage()) and app.can_access(coll));
create policy "garage insert" on public.records for insert to authenticated
  with check (owner = (select app.my_garage()) and app.can_access(coll));
create policy "garage update" on public.records for update to authenticated
  using (owner = (select app.my_garage()) and app.can_access(coll))
  with check (owner = (select app.my_garage()) and app.can_access(coll));
-- no delete policy: deletions are "deleted = true" rows, so they are audited and synced
revoke delete, truncate on public.records from anon, authenticated;
alter table public.records alter column owner drop default;
alter table public.records alter column owner set default app.my_garage();

-- ---------- booking requests: readable by the garage's office staff ----------
drop policy if exists "garage reads" on public.requests;
drop policy if exists "garage updates" on public.requests;
drop policy if exists "garage deletes" on public.requests;
create policy "garage reads" on public.requests for select to authenticated
  using (garage = (select app.my_garage()) and app.my_role() in ('owner','manager','advisor') and app.session_ok() and (app.my_role() <> 'owner' or app.mfa_ok()));
create policy "garage updates" on public.requests for update to authenticated
  using (garage = (select app.my_garage()) and app.my_role() in ('owner','manager','advisor') and app.session_ok() and (app.my_role() <> 'owner' or app.mfa_ok()));
create policy "garage deletes" on public.requests for delete to authenticated
  using (garage = (select app.my_garage()) and app.my_role() in ('owner','manager') and app.session_ok() and (app.my_role() <> 'owner' or app.mfa_ok()));

-- ---------- alerts ----------
create table if not exists public.alerts (
  id        bigserial primary key,
  garage_id uuid not null,
  at        timestamptz not null default now(),
  level     text not null check (level in ('alert','warn','info')),
  kind      text not null,
  text      text not null,
  user_name text,
  device    text,
  emailed   boolean not null default false,
  seen      boolean not null default false
);
create index if not exists alerts_garage_at on public.alerts (garage_id, at desc);
alter table public.alerts enable row level security;
revoke insert, delete, truncate on public.alerts from anon, authenticated;
revoke update on public.alerts from anon, authenticated;
grant update (seen) on public.alerts to authenticated;
drop policy if exists "owner reads alerts" on public.alerts;
drop policy if exists "owner marks alerts" on public.alerts;
create policy "owner reads alerts" on public.alerts for select to authenticated
  using (garage_id = (select app.my_garage()) and app.my_role() = 'owner' and app.mfa_ok() and app.session_ok());
create policy "owner marks alerts" on public.alerts for update to authenticated
  using (garage_id = (select app.my_garage()) and app.my_role() = 'owner' and app.mfa_ok() and app.session_ok());

create or replace function app.who() returns text
  language sql stable security definer set search_path = public, app as $$
  select coalesce((select name || ' (' || role || ')' from public.members where user_id = auth.uid()),
                  case when auth.uid() is null then coalesce(nullif(current_setting('app.actor', true), ''), 'system') else 'Garage login' end) $$;

create or replace function app.alert(p_garage uuid, p_level text, p_kind text, p_text text, p_device text default null)
  returns void language plpgsql security definer set search_path = public, app, extensions as $$
declare v_id bigint; v_url text; v_key text;
begin
  insert into public.alerts (garage_id, level, kind, text, user_name, device)
  values (p_garage, p_level, p_kind, left(p_text, 500), app.who(), p_device) returning id into v_id;
  if p_level in ('alert', 'warn') then   -- instant e-mail through the notify function (pg_net), if set up
    select value into v_url from app.config where key = 'functions_url';
    select value into v_key from app.config where key = 'anon_key';
    if v_url is not null then
      begin
        perform net.http_post(url := v_url || '/notify', body := jsonb_build_object('alert_id', v_id),
                              headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')));
      exception when others then null;   -- e-mail is best effort; the alert is always stored
      end;
    end if;
  end if;
end $$;

-- ---------- audit log (append-only) ----------
create table if not exists public.audit_log (
  id        bigserial primary key,
  garage_id uuid not null,
  at        timestamptz not null default now(),
  user_id   uuid,
  who       text,
  coll      text,
  rec_id    text,
  action    text,
  summary   text,
  ip        text
);
create index if not exists audit_garage_at on public.audit_log (garage_id, at desc);
alter table public.audit_log enable row level security;
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated, service_role;
drop policy if exists "owner reads audit" on public.audit_log;
create policy "owner reads audit" on public.audit_log for select to authenticated
  using (garage_id = (select app.my_garage()) and app.my_role() = 'owner' and app.mfa_ok() and app.session_ok());
create or replace function app.audit_block() returns trigger language plpgsql as $$
begin raise exception 'The audit log cannot be changed or deleted'; end $$;
drop trigger if exists audit_no_change on public.audit_log;
create trigger audit_no_change before update or delete on public.audit_log for each row execute function app.audit_block();
drop trigger if exists audit_no_truncate on public.audit_log;
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function app.audit_block();

create or replace function app.req_ip() returns text language sql stable as $$
  select nullif(split_part(coalesce(current_setting('request.headers', true), '{}')::json->>'x-forwarded-for', ',', 1), '') $$;

-- ---------- approvals (Owner PIN checked by the server) ----------
drop function if exists public.approve_with_pin(text, text, text, text);
create table if not exists app.owner_pin (garage_id uuid primary key, pin_hash text not null, set_at timestamptz not null default now());
create table if not exists app.pin_fails (garage_id uuid primary key, fails int not null default 0, locked_until timestamptz);
create table if not exists app.approvals (
  id           uuid primary key default gen_random_uuid(),
  garage_id    uuid not null,
  action       text not null,
  target       text not null,
  detail       text,
  requested_by uuid,
  approved_by  text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  used_at      timestamptz
);
revoke all on app.owner_pin, app.pin_fails, app.approvals from anon, authenticated;

create or replace function public.set_owner_pin(p_pin text) returns void
  language plpgsql security definer set search_path = public, app, extensions as $$
begin
  if app.my_role() is distinct from 'owner' or not app.mfa_ok() or not app.session_ok() then raise exception 'Only the Owner can set the approval PIN'; end if;
  if p_pin !~ '^\d{6,8}$' then raise exception 'PIN must be 6-8 digits'; end if;
  insert into app.owner_pin (garage_id, pin_hash) values (app.my_garage(), crypt(p_pin, gen_salt('bf', 10)))
  on conflict (garage_id) do update set pin_hash = excluded.pin_hash, set_at = now();
  delete from app.pin_fails where garage_id = app.my_garage();
  perform app.alert(app.my_garage(), 'warn', 'pin', 'Owner approval PIN was changed');
end $$;

create or replace function public.has_owner_pin() returns boolean
  language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from app.owner_pin where garage_id = app.my_garage()) $$;

-- staff type the Owner's PIN on their device → the server checks it and issues a 10-minute, one-use approval.
-- Returns {ok, approval_id} or {ok:false, error, message}. It never raises on a wrong PIN: an error would roll back
-- the failed-try counter and the alert, and the lockout would never happen.
create or replace function public.approve_with_pin(p_action text, p_target text, p_detail text, p_pin text) returns jsonb
  language plpgsql security definer set search_path = public, app, extensions as $$
declare g uuid := app.my_garage(); v_hash text; f app.pin_fails; v_id uuid; v_mins int;
begin
  if g is null or not app.session_ok() or app.my_role() not in ('owner','manager','advisor') then
    return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED', 'message', 'Not signed in');
  end if;
  select pin_hash into v_hash from app.owner_pin where garage_id = g;
  if v_hash is null then return jsonb_build_object('ok', false, 'error', 'PIN_NOT_SET', 'message', 'The Owner has not set an approval PIN yet (Settings → Staff & security).'); end if;
  insert into app.pin_fails (garage_id, fails) values (g, 0) on conflict (garage_id) do nothing;
  select * into f from app.pin_fails where garage_id = g for update;
  if f.locked_until is not null and f.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'PIN_LOCKED', 'minutes', ceil(extract(epoch from f.locked_until - now()) / 60),
      'message', format('Too many wrong PINs — approvals locked for %s min. The Owner has been alerted.', ceil(extract(epoch from f.locked_until - now()) / 60)));
  end if;
  if coalesce(p_pin, '') = '' or crypt(p_pin, v_hash) <> v_hash then
    update app.pin_fails set fails = fails + 1 where garage_id = g returning * into f;
    if f.fails >= 5 then
      v_mins := least(1440, 15 * power(2, f.fails - 5)::int);
      update app.pin_fails set locked_until = now() + make_interval(mins => v_mins) where garage_id = g;
      perform app.alert(g, 'alert', 'lockout', format('Owner approval PIN locked for %s min after %s wrong tries — %s asked to: %s', v_mins, f.fails, app.who(), coalesce(p_detail, p_action)));
      return jsonb_build_object('ok', false, 'error', 'PIN_LOCKED', 'minutes', v_mins, 'message', format('Too many wrong PINs — approvals locked for %s min. The Owner has been alerted.', v_mins));
    end if;
    if f.fails = 3 then perform app.alert(g, 'warn', 'pin-fail', format('3 wrong Owner PINs from %s (%s)', app.who(), coalesce(p_detail, p_action))); end if;
    return jsonb_build_object('ok', false, 'error', 'PIN_WRONG', 'left', 5 - f.fails, 'message', format('Wrong PIN — %s tries left', 5 - f.fails));
  end if;
  update app.pin_fails set fails = 0, locked_until = null where garage_id = g;
  insert into app.approvals (garage_id, action, target, detail, requested_by, approved_by)
  values (g, p_action, p_target, left(p_detail, 300), auth.uid(), 'Owner PIN') returning id into v_id;
  perform app.alert(g, 'warn', 'approval', format('Owner PIN approved for %s: %s', app.who(), coalesce(p_detail, p_action)));
  return jsonb_build_object('ok', true, 'approval_id', v_id);
end $$;

create or replace function app.use_approval(g uuid, p_action text, p_target text) returns void
  language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  select id into v_id from app.approvals
   where garage_id = g and action = p_action and target = p_target and used_at is null and expires_at > now() and requested_by = auth.uid()
   order by created_at limit 1 for update skip locked;
  if v_id is null then raise exception 'APPROVAL_NEEDED: % needs the Owner''s approval', p_action using errcode = 'P0001'; end if;
  update app.approvals set used_at = now() where id = v_id;
end $$;

-- discount as % of the subtotal (same maths as the app)
create or replace function app.discount_pct(d jsonb) returns numeric language sql immutable as $$
  with s as (select coalesce(sum(coalesce(nullif(i->>'qty','')::numeric, 0) * coalesce(nullif(i->>'rate','')::numeric, 0)), 0) as sub
             from jsonb_array_elements(case when jsonb_typeof(d->'items') = 'array' then d->'items' else '[]'::jsonb end) i)
  select case
    when d is null then 0
    when coalesce(d->>'discountType', 'pct') = 'amt' then
      case when (select sub from s) > 0 then round(coalesce(nullif(d->>'discount','')::numeric, 0) / (select sub from s) * 100, 2)
           when coalesce(nullif(d->>'discount','')::numeric, 0) > 0 then 100 else 0 end
    else coalesce(nullif(d->>'discount','')::numeric, 0) end $$;

-- ---------- the guard: protected changes need the Owner (or a server-issued approval) ----------
create or replace function app.records_guard() returns trigger
  language plpgsql security definer set search_path = public, app as $$
declare
  r text := app.my_role(); g uuid := new.owner; lim numeric; k text;
  pay_keys text[] := array['bankDetails','payStripeLink','wioName','wioBank','wioIban','wioLink'];
  od jsonb := case when tg_op = 'UPDATE' then old.data else null end;
begin
  -- only signed-in app users are checked; the server itself (service role) and the customer quote link are not
  if coalesce(auth.jwt()->>'role', '') <> 'authenticated' then return new; end if;
  if r = 'owner' then return new; end if;
  if new.coll = 'staff' then raise exception 'Only the Owner can change staff logins'; end if;

  if new.coll in ('quotes','jobs','invoices') and not new.deleted and r <> 'manager' then
    select coalesce(nullif(data->'security'->>'discountLimit','')::numeric, 10) into lim from public.records where owner = g and coll = 'settings' and id = 'settings';
    if app.discount_pct(new.data) > coalesce(lim, 10) + 0.001 and app.discount_pct(new.data) > app.discount_pct(od) + 0.001 then
      perform app.use_approval(g, 'discount', new.id);
    end if;
  end if;
  if new.coll = 'invoices' and tg_op = 'UPDATE' then
    if coalesce((new.data->>'void')::boolean, false) and not coalesce((od->>'void')::boolean, false) then perform app.use_approval(g, 'void_invoice', new.id); end if;
    if new.deleted and not old.deleted then perform app.use_approval(g, 'delete_invoice', new.id); end if;
    if coalesce(new.data->>'payLink','') <> coalesce(od->>'payLink','') then perform app.use_approval(g, 'pay_link', new.id); end if;
  end if;
  if new.coll = 'payments' and tg_op = 'UPDATE' and new.deleted and not old.deleted then perform app.use_approval(g, 'delete_payment', new.id); end if;

  if new.coll = 'settings' and tg_op = 'UPDATE' then
    for k in select key from jsonb_each(coalesce(new.data, '{}')) union select key from jsonb_each(coalesce(od, '{}')) loop
      continue when (new.data->k) is not distinct from (od->k);
      continue when k in ('updatedAt', 'counters');
      if r = 'advisor' then raise exception 'Advisors cannot change settings (%)', k; end if;
      if k = any(pay_keys) then perform app.use_approval(g, 'bank_details', 'settings');
      elsif k = 'security' then perform app.use_approval(g, 'security', 'settings');
      elsif k = 'closedMonths' and exists (select 1 from jsonb_object_keys(coalesce(od->'closedMonths', '{}')) m where not (coalesce(new.data->'closedMonths', '{}') ? m)) then
        perform app.use_approval(g, 'reopen_month', 'settings');
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records for each row execute function app.records_guard();

-- ---------- audit + alerts for every change ----------
create or replace function app.records_audit() returns trigger
  language plpgsql security definer set search_path = public, app as $$
declare
  act text; summ text; ident text; keys text; g uuid := new.owner;
  od jsonb := case when tg_op = 'UPDATE' then old.data else null end;
  pay_keys text[] := array['bankDetails','payStripeLink','wioName','wioBank','wioIban','wioLink'];
begin
  ident := coalesce(new.data->>'number', new.data->>'name', new.data->>'plate', new.data->>'code', coalesce(od->>'number', od->>'name', od->>'plate'), new.id);
  if tg_op = 'INSERT' then act := case when new.deleted then 'delete' else 'create' end;
  elsif new.deleted and not old.deleted then act := 'delete';
  else act := 'update'; end if;
  if tg_op = 'UPDATE' and not new.deleted and new.coll <> 'photos' then
    select string_agg(key, ', ') into keys from (
      select key from jsonb_each(coalesce(new.data, '{}')) where key not in ('updatedAt','updatedBy') and (new.data->key) is distinct from (od->key)
      union select key from jsonb_each(coalesce(od, '{}')) where key not in ('updatedAt','updatedBy') and not (coalesce(new.data, '{}') ? key)
      limit 12) x;
    if keys is null then return new; end if;   -- nothing but timestamps changed
  end if;
  summ := coalesce(ident, '') || case when keys is not null then ' — changed: ' || keys else '' end;
  insert into public.audit_log (garage_id, user_id, who, coll, rec_id, action, summary, ip)
  values (g, auth.uid(), app.who(), new.coll, new.id, act, left(summ, 400), app.req_ip());

  -- instant alerts for the important ones
  if new.coll = 'invoices' and act = 'delete' then perform app.alert(g, 'alert', 'invoice', format('Invoice %s deleted by %s', ident, app.who())); end if;
  if new.coll = 'invoices' and tg_op = 'UPDATE' and coalesce((new.data->>'void')::boolean, false) and not coalesce((od->>'void')::boolean, false) then
    perform app.alert(g, 'alert', 'invoice', format('Invoice %s voided by %s', ident, app.who())); end if;
  if new.coll = 'invoices' and tg_op = 'UPDATE' and coalesce(new.data->>'payLink','') <> coalesce(od->>'payLink','') then
    perform app.alert(g, 'alert', 'invoice', format('Payment link on invoice %s changed by %s to: %s', ident, app.who(), coalesce(nullif(new.data->>'payLink',''), '(default)'))); end if;
  if new.coll = 'payments' and act = 'delete' then perform app.alert(g, 'alert', 'payment', format('Payment %s (%s) deleted by %s', coalesce(od->>'number', ident), coalesce(od->>'amount', ''), app.who())); end if;
  if new.coll in ('quotes','jobs','invoices') and not new.deleted and app.discount_pct(new.data) > app.discount_pct(od) + 0.001 and app.discount_pct(new.data) > 10 then
    perform app.alert(g, 'warn', 'discount', format('Discount %s%% on %s by %s', app.discount_pct(new.data), ident, app.who())); end if;
  if new.coll = 'settings' and tg_op = 'UPDATE' then
    if exists (select 1 from unnest(pay_keys) k where (new.data->k) is distinct from (od->k)) then
      perform app.alert(g, 'alert', 'bank', format('Bank / payment details changed by %s', app.who())); end if;
    if exists (select 1 from jsonb_object_keys(coalesce(od->'closedMonths', '{}')) m where not (coalesce(new.data->'closedMonths', '{}') ? m)) then
      perform app.alert(g, 'alert', 'month', format('A closed month was reopened by %s', app.who())); end if;
  end if;
  if act = 'delete' and new.coll not in ('photos') and (select count(*) from public.audit_log where garage_id = g and user_id is not distinct from auth.uid() and action = 'delete' and at > now() - interval '5 minutes') = 25 then
    perform app.alert(g, 'alert', 'mass-delete', format('%s deleted 25+ records in 5 minutes', app.who())); end if;
  return new;
end $$;
drop trigger if exists records_audit on public.records;
create trigger records_audit after insert or update on public.records for each row execute function app.records_audit();

-- ---------- who am I (called by the app after sign-in) ----------
create or replace function public.whoami() returns jsonb
  language sql stable security definer set search_path = public, auth, app as $$
  select jsonb_build_object(
    'user_id', auth.uid(), 'garage_id', app.my_garage(), 'role', app.my_role(),
    'name', coalesce((select name from public.members where user_id = auth.uid()), 'Owner'),
    'username', (select username from public.members where user_id = auth.uid()),
    'tech_id', (select tech_id from public.members where user_id = auth.uid()),
    'is_garage_login', not exists (select 1 from public.members where user_id = auth.uid()),
    'mfa_enrolled', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'),
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'), 'mfa_ok', app.mfa_ok(), 'session_ok', app.session_ok(),
    'has_owner_pin', exists (select 1 from app.owner_pin where garage_id = app.my_garage())) $$;

-- the garage account registers itself as Owner (so it appears in the staff list)
create or replace function public.claim_owner() returns void
  language plpgsql security definer set search_path = public, auth, app as $$
declare u auth.users;
begin
  if auth.uid() is null or exists (select 1 from public.members where user_id = auth.uid()) then return; end if;
  select * into u from auth.users where id = auth.uid();
  insert into public.members (user_id, garage_id, username, name, role, created_by)
  values (auth.uid(), auth.uid(), 'owner', 'Owner', 'owner', auth.uid()) on conflict do nothing;
end $$;

-- ---------- devices: register / heartbeat / revoke ----------
create or replace function public.device_hello(p_label text, p_ua text) returns jsonb
  language plpgsql security definer set search_path = public, app as $$
declare
  g uuid := app.my_garage(); s uuid := nullif(auth.jwt()->>'session_id', '')::uuid; d public.devices; seen_before boolean; r text := app.my_role();
begin
  if g is null then return jsonb_build_object('revoked', true, 'reason', 'This login is switched off'); end if;
  select * into d from public.devices where user_id = auth.uid() and session_id = s;
  if found then
    if d.revoked then return jsonb_build_object('revoked', true, 'reason', 'This device was signed out by the Owner'); end if;
    update public.devices set last_seen = now(), ip = coalesce(app.req_ip(), ip) where id = d.id;
    return jsonb_build_object('revoked', false, 'device_id', d.id);
  end if;
  seen_before := exists (select 1 from public.devices where user_id = auth.uid() and label = p_label and not revoked);
  insert into public.devices (garage_id, user_id, session_id, label, user_agent, ip)
  values (g, auth.uid(), s, left(p_label, 80), left(p_ua, 300), app.req_ip()) returning * into d;
  perform app.alert(g, case when r = 'owner' or not seen_before then 'warn' else 'info' end, 'login',
    format('%s signed in on %s%s%s', app.who(), coalesce(p_label, 'a device'), case when seen_before then '' else ' (new device)' end, coalesce(' · ' || app.req_ip(), '')), p_label);
  return jsonb_build_object('revoked', false, 'device_id', d.id);
end $$;

create or replace function public.revoke_device(p_id uuid) returns void
  language plpgsql security definer set search_path = public, auth, app as $$
declare d public.devices;
begin
  if app.my_role() is distinct from 'owner' or not app.mfa_ok() or not app.session_ok() then raise exception 'Only the Owner can sign devices out'; end if;
  select * into d from public.devices where id = p_id and garage_id = app.my_garage();
  if not found then raise exception 'Device not found'; end if;
  update public.devices set revoked = true, revoked_at = now(), revoked_by = auth.uid() where id = p_id;
  begin delete from auth.sessions where id = d.session_id; exception when others then null; end;
  perform app.alert(app.my_garage(), 'warn', 'device', format('Owner signed out %s (%s)', coalesce(d.label, 'a device'),
    (select name from public.members where user_id = d.user_id)));
end $$;

drop policy if exists "devices read" on public.devices;
create policy "devices read" on public.devices for select to authenticated
  using (garage_id = (select app.my_garage()) and ((app.my_role() = 'owner' and app.mfa_ok()) or user_id = auth.uid()));

drop policy if exists "members read" on public.members;
create policy "members read" on public.members for select to authenticated
  using (garage_id = (select app.my_garage()) and (app.my_role() in ('owner','manager') or user_id = auth.uid()));

-- ---------- Technicians & Drivers: their own jobs only, trimmed ----------
create or replace function public.crew_pull() returns jsonb
  language plpgsql stable security definer set search_path = public, app as $$
declare
  g uuid := app.my_garage(); r text := app.my_role(); t text := (select tech_id from public.members where user_id = auth.uid());
  jobs jsonb; vids text[]; cids text[];
begin
  if g is null or r not in ('technician','driver') or not app.session_ok() then raise exception 'Not allowed'; end if;
  select coalesce(jsonb_agg(data - 'items' - 'discount' - 'discountType' - 'discountApproved' - 'discountApprovedBy' - 'vatRate' - 'invoiceId' - 'quoteId' - 'internal' - 'lpo' - 'payLink'), '[]'::jsonb),
         array_agg(distinct data->>'vehicleId'), array_agg(distinct data->>'customerId')
    into jobs, vids, cids
    from public.records
   where owner = g and coll = 'jobs' and not deleted and t is not null
     and (data->>'technicianId' = t or data->'mobile'->>'driverId' = t)
     and (r <> 'driver' or data->>'line' = 'mobile')
     and (coalesce(data->>'status', '') not in ('Delivered','Cancelled') or updated_at > now() - interval '3 days');
  return jsonb_build_object(
    'role', r, 'tech_id', t, 'jobs', jobs,
    'vehicles', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'plate', data->>'plate', 'plateNorm', data->>'plateNorm', 'emirate', data->>'emirate', 'make', data->>'make',
                 'model', data->>'model', 'year', data->>'year', 'color', data->>'color', 'vin', data->>'vin', 'fuel', data->>'fuel', 'customerId', data->>'customerId', 'updatedAt', data->>'updatedAt')), '[]'::jsonb)
                 from public.records where owner = g and coll = 'vehicles' and not deleted and id = any(coalesce(vids, '{}'))),
    'customers', (select coalesce(jsonb_agg(case when r = 'driver'
                   then jsonb_build_object('id', id, 'name', data->>'name', 'phone', data->>'phone', 'whatsapp', data->>'whatsapp', 'updatedAt', data->>'updatedAt')
                   else jsonb_build_object('id', id, 'name', data->>'name', 'updatedAt', data->>'updatedAt') end), '[]'::jsonb)
                 from public.records where owner = g and coll = 'customers' and not deleted and id = any(coalesce(cids, '{}'))),
    'technicians', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name', 'trade', data->>'trade', 'active', data->'active')), '[]'::jsonb)
                 from public.records where owner = g and coll = 'technicians' and not deleted),
    'settings', (select jsonb_build_object('id', 'settings', 'garageName', data->>'garageName', 'brandMobile', data->>'brandMobile', 'address', data->>'address', 'phone', data->>'phone',
                   'whatsapp', data->>'whatsapp', 'email', data->>'email', 'docFooter', data->>'docFooter', 'currency', data->>'currency', 'inspectionTemplate', data->'inspectionTemplate',
                   'lists', jsonb_build_object('jobType', data->'lists'->'jobType'), 'mob', jsonb_build_object('vans', data->'mob'->'vans', 'hoursStart', data->'mob'->'hoursStart', 'hoursEnd', data->'mob'->'hoursEnd', 'allDay', data->'mob'->'allDay', 'zones', data->'mob'->'zones'),
                   'schema', data->'schema', 'updatedAt', data->>'updatedAt')
                 from public.records where owner = g and coll = 'settings' and id = 'settings'),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'jobId', data->>'jobId')), '[]'::jsonb) from public.records
                 where owner = g and coll = 'photos' and not deleted and data->>'jobId' in (select x->>'id' from jsonb_array_elements(jobs) x)));
end $$;

create or replace function public.crew_photo(p_id text) returns jsonb
  language plpgsql stable security definer set search_path = public, app as $$
declare g uuid := app.my_garage(); t text := (select tech_id from public.members where user_id = auth.uid()); ph jsonb;
begin
  if g is null or app.my_role() not in ('technician','driver') or not app.session_ok() then raise exception 'Not allowed'; end if;
  select p.data into ph from public.records p join public.records j on j.owner = g and j.coll = 'jobs' and j.id = p.data->>'jobId'
   where p.owner = g and p.coll = 'photos' and p.id = p_id and not p.deleted and (j.data->>'technicianId' = t or j.data->'mobile'->>'driverId' = t);
  return ph;
end $$;

-- changes from a Technician / Driver: only these fields, only on their own jobs
create or replace function public.crew_push(p_rows jsonb) returns jsonb
  language plpgsql security definer set search_path = public, app as $$
declare
  g uuid := app.my_garage(); r text := app.my_role(); t text := (select tech_id from public.members where user_id = auth.uid());
  row jsonb; cur public.records; nd jsonb; k text; ok int := 0; rej jsonb := '[]'::jsonb;
  allowed text[] := array['status','completed','diagnosis','inspection','inspectionType','checkin','ppi','fuelIn','odometer','odometerOut','signatures','updatedAt','updatedBy'];
begin
  if g is null or r not in ('technician','driver') or not app.session_ok() or t is null then raise exception 'Not allowed'; end if;
  for row in select * from jsonb_array_elements(p_rows) loop
    if row->>'coll' = 'jobs' then
      select * into cur from public.records where owner = g and coll = 'jobs' and id = row->>'id' and not deleted
         and (data->>'technicianId' = t or data->'mobile'->>'driverId' = t) for update;
      if not found then rej := rej || jsonb_build_object('id', row->>'id', 'why', 'not your job'); continue; end if;
      if coalesce(cur.data->>'line', '') <> 'mobile' and coalesce(row->'data'->>'status', cur.data->>'status') not in ('Booked','In Progress','Awaiting Parts','Ready') then
        rej := rej || jsonb_build_object('id', row->>'id', 'why', 'status not allowed'); continue; end if;
      nd := cur.data;
      foreach k in array allowed loop
        if (row->'data') ? k then nd := jsonb_set(nd, array[k], row->'data'->k); end if;
      end loop;
      if coalesce(cur.data->>'line', '') = 'mobile' and (row->'data') ? 'mobile' then
        nd := jsonb_set(nd, '{mobile}', coalesce(nd->'mobile', '{}') || jsonb_build_object(
          'status', coalesce(row->'data'->'mobile'->'status', nd->'mobile'->'status'),
          'times', coalesce(row->'data'->'mobile'->'times', nd->'mobile'->'times'),
          'eta', coalesce(row->'data'->'mobile'->'eta', nd->'mobile'->'eta')));
        if (row->'data') ? 'status' then nd := jsonb_set(nd, '{status}', row->'data'->'status'); end if;
      end if;
      update public.records set data = nd, updated_at = coalesce((row->>'updated_at')::timestamptz, now()) where owner = g and coll = 'jobs' and id = cur.id;
      ok := ok + 1;
    elsif row->>'coll' = 'photos' then
      if not exists (select 1 from public.records where owner = g and coll = 'jobs' and id = row->'data'->>'jobId' and not deleted and (data->>'technicianId' = t or data->'mobile'->>'driverId' = t)) then
        rej := rej || jsonb_build_object('id', row->>'id', 'why', 'photo not on your job'); continue; end if;
      if exists (select 1 from public.records where owner = g and coll = 'photos' and id = row->>'id') then continue; end if;   -- photos are add-only
      insert into public.records (owner, coll, id, data, deleted, updated_at) values (g, 'photos', row->>'id', row->'data', false, coalesce((row->>'updated_at')::timestamptz, now()));
      ok := ok + 1;
    else
      rej := rej || jsonb_build_object('id', row->>'id', 'why', 'not allowed: ' || coalesce(row->>'coll', '?'));
    end if;
  end loop;
  return jsonb_build_object('ok', ok, 'rejected', rej);
end $$;

-- ---------- customer approves a quotation from a link (no login) ----------
create index if not exists records_quote_token on public.records ((data->>'shareToken')) where coll = 'quotes';
create or replace function public.public_quote(p_token text) returns jsonb
  language plpgsql stable security definer set search_path = public, app as $$
declare q public.records; v jsonb; c jsonb; s jsonb;
begin
  if length(coalesce(p_token, '')) < 20 then return null; end if;
  select * into q from public.records where coll = 'quotes' and data->>'shareToken' = p_token and not deleted limit 1;
  if not found then return null; end if;
  select data into v from public.records where owner = q.owner and coll = 'vehicles' and id = q.data->>'vehicleId';
  select data into c from public.records where owner = q.owner and coll = 'customers' and id = q.data->>'customerId';
  select data into s from public.records where owner = q.owner and coll = 'settings' and id = 'settings';
  return jsonb_build_object(
    'number', q.data->>'number', 'date', q.data->>'date', 'validUntil', q.data->>'validUntil', 'status', q.data->>'status', 'description', q.data->>'description',
    'items', (select coalesce(jsonb_agg(jsonb_build_object('desc', i->>'desc', 'qty', i->'qty', 'rate', i->'rate', 'type', i->>'type')), '[]'::jsonb) from jsonb_array_elements(coalesce(q.data->'items', '[]')) i),
    'discount', q.data->'discount', 'discountType', q.data->'discountType', 'vatRate', coalesce(q.data->'vatRate', s->'vatRate'), 'approval', q.data->'approval',
    'customer', split_part(coalesce(c->>'name', ''), ' ', 1),
    'vehicle', jsonb_build_object('plate', v->>'plate', 'make', v->>'make', 'model', v->>'model', 'year', v->>'year'),
    'garage', jsonb_build_object('name', s->>'garageName', 'phone', s->>'phone', 'whatsapp', s->>'whatsapp', 'email', s->>'email', 'address', s->>'address', 'currency', coalesce(s->>'currency', 'AED'), 'footer', s->>'docFooter', 'terms', s->>'quoteTerms', 'validDays', s->'quoteValidDays'));
end $$;

create or replace function public.public_quote_decide(p_token text, p_decision text, p_name text, p_note text) returns jsonb
  language plpgsql security definer set search_path = public, app as $$
declare q public.records; st text; nd jsonb; now_s text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if length(coalesce(p_token, '')) < 20 or p_decision not in ('approve','decline') then raise exception 'Invalid request'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Please type your name'; end if;
  select * into q from public.records where coll = 'quotes' and data->>'shareToken' = p_token and not deleted limit 1 for update;
  if not found then raise exception 'This quotation link is not valid'; end if;
  perform set_config('app.actor', 'Customer (quote link)', true);
  st := coalesce(q.data->>'status', 'Draft');
  if st in ('Approved', 'Declined', 'Converted') then return jsonb_build_object('status', st, 'already', true); end if;
  if nullif(q.data->>'validUntil', '') is not null and (q.data->>'validUntil')::date < (now() at time zone 'Asia/Dubai')::date then raise exception 'This quotation has expired — please contact us for an updated price'; end if;
  nd := q.data || jsonb_build_object('status', case when p_decision = 'approve' then 'Approved' else 'Declined' end,
        'approval', jsonb_build_object('decision', p_decision, 'name', left(trim(p_name), 80), 'note', left(coalesce(p_note, ''), 500), 'at', now_s, 'via', 'link', 'ip', app.req_ip()),
        'updatedAt', now_s, 'updatedBy', 'Customer (link)');
  update public.records set data = nd, updated_at = now() where owner = q.owner and coll = 'quotes' and id = q.id;
  perform app.alert(q.owner, 'warn', 'quote', format('Quotation %s %s by %s via the link', q.data->>'number', case when p_decision = 'approve' then 'APPROVED' else 'declined' end, left(trim(p_name), 80)));
  return jsonb_build_object('status', nd->>'status', 'already', false);
end $$;

-- ---------- owner: alert e-mail + functions URL (for instant e-mails) ----------
create or replace function public.set_alert_config(p_email text, p_functions_url text, p_anon_key text) returns void
  language plpgsql security definer set search_path = public, app as $$
begin
  if app.my_role() is distinct from 'owner' or not app.mfa_ok() or not app.session_ok() then raise exception 'Only the Owner can change alert settings'; end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail'; end if;
  insert into app.config values ('alert_email', p_email) on conflict (key) do update set value = excluded.value;
  if p_functions_url is not null then insert into app.config values ('functions_url', p_functions_url) on conflict (key) do update set value = excluded.value; end if;
  if p_anon_key is not null then insert into app.config values ('anon_key', p_anon_key) on conflict (key) do update set value = excluded.value; end if;
  perform app.alert(app.my_garage(), 'warn', 'settings', 'Alert e-mail set to ' || p_email);
end $$;
create or replace function public.get_alert_email() returns text
  language sql stable security definer set search_path = public, app as $$
  select case when app.my_role() = 'owner' then (select value from app.config where key = 'alert_email') end $$;

-- ---------- server-only helpers used by the functions (service role) ----------
create table if not exists app.login_fails (key text primary key, fails int not null default 0, locked_until timestamptz, last_at timestamptz);
revoke all on app.login_fails from anon, authenticated;
create or replace function public.srv_login_check(p_key text) returns jsonb language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object('locked_min', case when locked_until > now() then ceil(extract(epoch from locked_until - now()) / 60) else 0 end, 'fails', coalesce(fails, 0))
  from (select 1) x left join app.login_fails f on f.key = p_key $$;
create or replace function public.srv_login_result(p_key text, p_ok boolean, p_garage uuid, p_who text, p_ip text) returns jsonb
  language plpgsql security definer set search_path = public, app as $$
declare f app.login_fails; m int;
begin
  if p_ok then
    select * into f from app.login_fails where key = p_key;
    if f.fails >= 3 and p_garage is not null then perform app.alert(p_garage, 'warn', 'login', format('%s signed in after %s wrong passwords', p_who, f.fails)); end if;
    delete from app.login_fails where key = p_key; return jsonb_build_object('fails', 0);
  end if;
  insert into app.login_fails (key, fails, last_at) values (p_key, 1, now())
  on conflict (key) do update set fails = app.login_fails.fails + 1, last_at = now() returning * into f;
  if f.fails >= 5 then
    m := least(1440, 15 * power(2, f.fails - 5)::int);
    update app.login_fails set locked_until = now() + make_interval(mins => m) where key = p_key;
    if p_garage is not null then perform app.alert(p_garage, 'alert', 'lockout', format('Login %s locked for %s min after %s wrong passwords%s', p_who, m, f.fails, coalesce(' · ' || p_ip, ''))); end if;
    return jsonb_build_object('fails', f.fails, 'locked_min', m);
  end if;
  if f.fails = 3 and p_garage is not null then perform app.alert(p_garage, 'warn', 'login', format('3 wrong passwords for %s%s', p_who, coalesce(' · ' || p_ip, ''))); end if;
  return jsonb_build_object('fails', f.fails, 'left', 5 - f.fails);
end $$;
create or replace function public.srv_alert(p_garage uuid, p_level text, p_kind text, p_text text) returns void
  language sql security definer set search_path = public, app as $$ select app.alert(p_garage, p_level, p_kind, p_text) $$;
create or replace function public.srv_alert_get(p_id bigint) returns jsonb language sql stable security definer set search_path = public, app as $$
  select to_jsonb(a) || jsonb_build_object('email', (select value from app.config where key = 'alert_email')) from public.alerts a where id = p_id $$;
create or replace function public.srv_alert_emailed(p_id bigint) returns void language sql security definer set search_path = public, app as $$
  update public.alerts set emailed = true where id = p_id $$;
-- the daily summary covers everything since the previous one (so late-evening events are never missed); once per ~day
drop function if exists public.srv_daily(date);
create or replace function public.srv_daily() returns jsonb language plpgsql security definer set search_path = public, app as $$
declare out jsonb := '[]'::jsonb; g uuid; v_from timestamptz; v_to timestamptz := now();
begin
  for g in select distinct garage_id from public.members where role = 'owner' union select distinct garage_id from public.alerts loop
    select value::timestamptz into v_from from app.config where key = 'summary_at_' || g::text;
    if v_from is not null and v_from > v_to - interval '20 hours' then continue; end if;
    v_from := greatest(coalesce(v_from, v_to - interval '24 hours'), v_to - interval '7 days');
    insert into app.config values ('summary_at_' || g::text, v_to::text) on conflict (key) do update set value = excluded.value;
    out := out || jsonb_build_object('garage_id', g, 'email', (select value from app.config where key = 'alert_email'), 'from', v_from, 'to', v_to,
      'alerts', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'level', level, 'text', text) order by at), '[]'::jsonb)
                 from public.alerts where garage_id = g and at > v_from and at <= v_to),
      'changes', (select coalesce(jsonb_agg(jsonb_build_object('who', who, 'coll', coll, 'action', action, 'n', n)), '[]'::jsonb) from
                   (select who, coll, action, count(*) n from public.audit_log where garage_id = g and at > v_from and at <= v_to group by 1, 2, 3 order by 1, 4 desc) x));
  end loop;
  return out;
end $$;
-- who is signing in (username or e-mail) → which auth user / garage
create or replace function public.srv_login_lookup(p_login text) returns jsonb
  language plpgsql stable security definer set search_path = public, auth, app as $$
declare l text := lower(trim(coalesce(p_login, ''))); u auth.users; m public.members;
begin
  if position('@' in l) > 0 then
    select * into u from auth.users where lower(email) = l limit 1;
    if not found then return null; end if;
    select * into m from public.members where user_id = u.id;
  else
    select * into m from public.members where username = l order by created_at limit 1;
    if not found then return null; end if;
    select * into u from auth.users where id = m.user_id;
  end if;
  return jsonb_build_object('user_id', u.id, 'email', u.email, 'garage_id', coalesce(m.garage_id, u.id),
    'who', coalesce(m.name || ' (' || m.role || ')', 'Owner'), 'active', coalesce(m.active, true), 'role', coalesce(m.role, 'owner'));
end $$;

-- sign a login out everywhere (password reset / switched off)
create or replace function public.srv_kill_sessions(p_user uuid) returns int
  language plpgsql security definer set search_path = public, auth, app as $$
declare n int;
begin
  update public.devices set revoked = true, revoked_at = now() where user_id = p_user and not revoked;
  get diagnostics n = row_count;
  delete from auth.sessions where user_id = p_user;
  return n;
end $$;

-- staff logins: kept here so the database is the only place that writes members
create or replace function public.srv_member_upsert(p_user uuid, p_garage uuid, p_username text, p_name text, p_role text, p_tech text, p_active boolean, p_by uuid)
  returns public.members language plpgsql security definer set search_path = public, app as $$
declare m public.members;
begin
  if p_role = 'owner' and exists (select 1 from public.members where user_id = p_user and role <> 'owner') then raise exception 'Cannot make a staff login the Owner'; end if;
  insert into public.members (user_id, garage_id, username, name, role, tech_id, active, created_by)
  values (p_user, p_garage, lower(p_username), p_name, p_role, nullif(p_tech, ''), coalesce(p_active, true), p_by)
  on conflict (user_id) do update set username = excluded.username, name = excluded.name, role = excluded.role,
    tech_id = excluded.tech_id, active = excluded.active
  where public.members.garage_id = p_garage and public.members.role <> 'owner'
  returning * into m;
  return m;
end $$;

-- daily summary: pg_cron calls this at 20:00 Dubai → notify function e-mails the day's summary
create or replace function app.daily_ping() returns void language plpgsql security definer set search_path = public, app, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app.config where key = 'functions_url';
  select value into v_secret from app.config where key = 'cron_secret';
  if v_url is null then return; end if;
  perform net.http_post(url := v_url || '/notify', body := jsonb_build_object('daily', true),
                        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(v_secret, '')));
end $$;
insert into app.config values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (key) do nothing;
create or replace function public.srv_cron_secret() returns text language sql stable security definer set search_path = app as $$
  select value from app.config where key = 'cron_secret' $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'mendtech-daily-summary';
    perform cron.schedule('mendtech-daily-summary', '0 16 * * *', 'select app.daily_ping()');   -- 16:00 UTC = 20:00 Dubai
  end if;
end $$;

do $$ declare f text; begin
  foreach f in array array['srv_login_check(text)', 'srv_login_result(text, boolean, uuid, text, text)', 'srv_alert(uuid, text, text, text)',
    'srv_alert_get(bigint)', 'srv_alert_emailed(bigint)', 'srv_daily()', 'srv_login_lookup(text)', 'srv_kill_sessions(uuid)',
    'srv_member_upsert(uuid, uuid, text, text, text, text, boolean, uuid)', 'srv_cron_secret()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke execute on function app.daily_ping() from public, anon, authenticated;
revoke execute on function public.public_quote(text), public.public_quote_decide(text, text, text, text) from public;
grant execute on function public.public_quote(text), public.public_quote_decide(text, text, text, text) to anon, authenticated;
