-- ============================================================================
-- Authorization tests
--
-- Proves the access rules are enforced by the database, not by the interface.
-- The v13 role system was interface-only: every price, job and phone number was
-- readable from browser devtools regardless of role. These assertions exist so
-- that cannot silently return.
--
-- Run:  psql -v ON_ERROR_STOP=1 -d mts_test -f tests/authorization.test.sql
-- Exits non-zero if any assertion fails.
-- ============================================================================

\set QUIET on
set client_min_messages to warning;

-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------

create temporary table _results (
  name   text,
  passed boolean,
  detail text
);

-- The assertions run as app_user (so RLS applies to them); they still need to
-- record their own outcome. The helpers stay SECURITY INVOKER deliberately —
-- running them as a definer/superuser would bypass the very RLS under test.
grant select, insert on _results to app_user;

-- Assert a boolean expression evaluated as a given profile.
create or replace function pg_temp.check_bool(
  test_name text, profile_id uuid, sql text, expected boolean
) returns void language plpgsql as $$
declare actual boolean;
begin
  perform set_config('app.profile_id', coalesce(profile_id::text, ''), true);
  execute sql into actual;
  insert into _results values (
    test_name,
    actual is not distinct from expected,
    format('expected %s, got %s', expected, actual)
  );
exception when others then
  insert into _results values (test_name, false, 'error: ' || sqlerrm);
end;
$$;

-- Assert a row count seen through RLS.
create or replace function pg_temp.check_count(
  test_name text, profile_id uuid, sql text, expected bigint
) returns void language plpgsql as $$
declare actual bigint;
begin
  perform set_config('app.profile_id', coalesce(profile_id::text, ''), true);
  execute sql into actual;
  insert into _results values (
    test_name,
    actual = expected,
    format('expected %s row(s), got %s', expected, actual)
  );
exception when others then
  insert into _results values (test_name, false, 'error: ' || sqlerrm);
end;
$$;

-- Assert a statement is REFUSED WITH A SPECIFIC ERROR. A test that passed on
-- any error at all would also pass on a typo in its own SQL, so the expected
-- sqlstate must be named. Defaults to 42501 (insufficient_privilege).
create or replace function pg_temp.check_denied(
  test_name text, profile_id uuid, sql text, expected_sqlstate text default '42501'
) returns void language plpgsql as $$
begin
  perform set_config('app.profile_id', coalesce(profile_id::text, ''), true);
  begin
    execute sql;
    insert into _results values (test_name, false, 'STATEMENT WAS ALLOWED — expected refusal');
  exception when others then
    if sqlstate = expected_sqlstate then
      insert into _results values (test_name, true, 'refused: ' || sqlstate);
    else
      insert into _results values (test_name, false,
        format('expected %s, got %s: %s', expected_sqlstate, sqlstate, sqlerrm));
    end if;
  end;
end;
$$;

-- Assert a write silently affects NOTHING.
--
-- This is how row-level security normally denies a write: the target rows are
-- simply invisible, so the statement succeeds against zero rows rather than
-- raising. The data is protected either way, but the caller cannot tell refusal
-- from "no such row" — so the application must check the affected row count
-- before reporting success, exactly as the sync queue now checks its response.
create or replace function pg_temp.check_no_effect(
  test_name text, profile_id uuid, sql text
) returns void language plpgsql as $$
declare affected bigint;
begin
  perform set_config('app.profile_id', coalesce(profile_id::text, ''), true);
  begin
    execute sql;
    get diagnostics affected = row_count;
    insert into _results values (
      test_name,
      affected = 0,
      format('%s row(s) changed — expected 0', affected)
    );
  exception when others then
    -- An outright error is an even stronger refusal than a silent no-op.
    insert into _results values (test_name, true, 'refused: ' || sqlstate);
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as superuser, before RLS applies)
-- ---------------------------------------------------------------------------

truncate app.audit_events, app.events, app.quotes, app.job_assignments,
         app.jobs, app.customers, app.invite_codes, app.policies,
         app.profiles restart identity cascade;

-- Seeding runs with no acting profile, so the privilege guard would reject the
-- privileged fixtures. Disable it for the load only; every assertion below
-- runs with it active.
alter table app.profiles disable trigger profiles_privilege_guard;

insert into app.profiles (id, full_name, role, approval_status) values
  ('11111111-1111-1111-1111-111111111111', 'Johnny',    'Owner',      'Approved'),
  ('22222222-2222-2222-2222-222222222222', 'Admin A',   'Admin',      'Approved'),
  ('33333333-3333-3333-3333-333333333333', 'Super S',   'Supervisor', 'Approved'),
  ('44444444-4444-4444-4444-444444444444', 'Worker W',  'Worker',     'Approved'),
  ('55555555-5555-5555-5555-555555555555', 'Worker X',  'Worker',     'Approved'),
  ('66666666-6666-6666-6666-666666666666', 'Pending P', 'Worker',     'Pending'),
  ('77777777-7777-7777-7777-777777777777', 'HR H',      'HR',         'Approved');

-- Outsourced technician whose access window has already closed.
insert into app.profiles (id, full_name, role, approval_status, access_expires_at)
values ('88888888-8888-8888-8888-888888888888', 'Expired E', 'Outsourced', 'Approved',
        now() - interval '1 day');

insert into app.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Maple Hills Villa', '+971500000001');

insert into app.jobs (id, customer_id, title, status) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'AC service', 'Assigned'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Repaint',    'Assigned');

-- Worker W is assigned to job 1 only.
insert into app.job_assignments (job_id, profile_id) values
  ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444');

insert into app.quotes (id, job_id, total, status) values
  ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 4500.00, 'PENDING_OWNER');

alter table app.profiles enable trigger profiles_privilege_guard;

-- Everything from here runs without superuser, so RLS is in force.
set role app_user;

-- Each assertion returns void; suppress the empty result sets so only the
-- report at the end is printed.
\o /dev/null

-- ---------------------------------------------------------------------------
-- Price privacy
-- ---------------------------------------------------------------------------

select pg_temp.check_count('owner reads quotes',
  '11111111-1111-1111-1111-111111111111', 'select count(*) from app.quotes', 1);

select pg_temp.check_count('admin reads quotes',
  '22222222-2222-2222-2222-222222222222', 'select count(*) from app.quotes', 1);

select pg_temp.check_count('supervisor sees NO prices',
  '33333333-3333-3333-3333-333333333333', 'select count(*) from app.quotes', 0);

select pg_temp.check_count('worker sees NO prices',
  '44444444-4444-4444-4444-444444444444', 'select count(*) from app.quotes', 0);

select pg_temp.check_count('HR sees NO prices',
  '77777777-7777-7777-7777-777777777777', 'select count(*) from app.quotes', 0);

-- ---------------------------------------------------------------------------
-- Job scoping: a worker sees only assigned work
-- ---------------------------------------------------------------------------

select pg_temp.check_count('owner sees all jobs',
  '11111111-1111-1111-1111-111111111111', 'select count(*) from app.jobs', 2);

select pg_temp.check_count('assigned worker sees only their job',
  '44444444-4444-4444-4444-444444444444', 'select count(*) from app.jobs', 1);

select pg_temp.check_count('unassigned worker sees no jobs',
  '55555555-5555-5555-5555-555555555555', 'select count(*) from app.jobs', 0);

-- ---------------------------------------------------------------------------
-- Customer directory is withheld from field staff
-- ---------------------------------------------------------------------------

select pg_temp.check_count('worker cannot read customer directory',
  '44444444-4444-4444-4444-444444444444', 'select count(*) from app.customers', 0);

select pg_temp.check_count('supervisor can read customers',
  '33333333-3333-3333-3333-333333333333', 'select count(*) from app.customers', 1);

-- ---------------------------------------------------------------------------
-- Inactive identities have no access at all
-- ---------------------------------------------------------------------------

select pg_temp.check_count('unauthenticated caller sees nothing',
  null, 'select count(*) from app.jobs', 0);

select pg_temp.check_count('pending user sees no jobs',
  '66666666-6666-6666-6666-666666666666', 'select count(*) from app.jobs', 0);

select pg_temp.check_count('expired outsourced user sees no jobs',
  '88888888-8888-8888-8888-888888888888', 'select count(*) from app.jobs', 0);

select pg_temp.check_bool('expired outsourced user is not active',
  '88888888-8888-8888-8888-888888888888',
  'select app.is_active(''88888888-8888-8888-8888-888888888888''::uuid)', false);

-- ---------------------------------------------------------------------------
-- The money gate: only the Owner moves a quote
-- ---------------------------------------------------------------------------

select pg_temp.check_no_effect('admin cannot approve a quote',
  '22222222-2222-2222-2222-222222222222',
  'update app.quotes set status = ''APPROVED'', approved_by = ''22222222-2222-2222-2222-222222222222''
     where id = ''40000000-0000-0000-0000-000000000001''');

-- And prove the row really is untouched, not merely that the count was zero.
select pg_temp.check_bool('quote still PENDING_OWNER after admin attempt',
  '11111111-1111-1111-1111-111111111111',
  'select status = ''PENDING_OWNER'' from app.quotes
     where id = ''40000000-0000-0000-0000-000000000001''', true);

select pg_temp.check_denied('worker cannot create a quote',
  '44444444-4444-4444-4444-444444444444',
  'insert into app.quotes (job_id, total) values (''a0000000-0000-0000-0000-000000000001'', 999)');

-- An agent proposing work must not be able to self-approve. The trigger blocks
-- APPROVED with neither an approver nor an authorising policy.
-- Refused by the quote_authority trigger (check_violation), not by RLS: the
-- Owner is allowed to write quotes, but no one may write one that is already
-- approved by nobody.
select pg_temp.check_denied('quote cannot reach APPROVED with no authority',
  '11111111-1111-1111-1111-111111111111',
  'insert into app.quotes (job_id, total, status) values
     (''a0000000-0000-0000-0000-000000000001'', 100, ''APPROVED'')',
  '23514');

select pg_temp.check_bool('owner CAN approve a quote',
  '11111111-1111-1111-1111-111111111111',
  'with u as (
     update app.quotes
        set status = ''APPROVED'', approved_by = ''11111111-1111-1111-1111-111111111111'',
            approved_at = now()
      where id = ''40000000-0000-0000-0000-000000000001''
      returning 1)
   select count(*) = 1 from u', true);

-- ---------------------------------------------------------------------------
-- Audit log is genuinely append-only
-- ---------------------------------------------------------------------------

select pg_temp.check_bool('active user can write an audit row',
  '22222222-2222-2222-2222-222222222222',
  'with i as (
     insert into app.audit_events (actor_id, action, target_type, target_id)
     values (''22222222-2222-2222-2222-222222222222'', ''quote.viewed'', ''quote'', ''40000000-0000-0000-0000-000000000001'')
     returning 1)
   select count(*) = 1 from i', true);

select pg_temp.check_denied('nobody can update an audit row',
  '11111111-1111-1111-1111-111111111111',
  'update app.audit_events set action = ''tampered'' where action = ''quote.viewed''');

select pg_temp.check_denied('nobody can delete an audit row',
  '11111111-1111-1111-1111-111111111111',
  'delete from app.audit_events where action = ''quote.viewed''');

-- Refused by the audit_has_authority check constraint: an entry with neither
-- an actor nor an authorising policy would be an untraceable change.
select pg_temp.check_denied('audit row needs an actor or a policy',
  '11111111-1111-1111-1111-111111111111',
  'insert into app.audit_events (action, target_type) values (''ghost.action'', ''quote'')',
  '23514');

select pg_temp.check_count('worker cannot read the audit log',
  '44444444-4444-4444-4444-444444444444', 'select count(*) from app.audit_events', 0);

-- ---------------------------------------------------------------------------
-- Event bus
-- ---------------------------------------------------------------------------

select pg_temp.check_bool('worker can publish an event',
  '44444444-4444-4444-4444-444444444444',
  'with i as (
     insert into app.events (event_type, entity_type, entity_id, actor_id, idempotency_key)
     values (''technician.arrived'', ''job'', ''a0000000-0000-0000-0000-000000000001'',
             ''44444444-4444-4444-4444-444444444444'', ''evt-key-1'')
     returning 1)
   select count(*) = 1 from i', true);

select pg_temp.check_denied('duplicate idempotency key is refused',
  '44444444-4444-4444-4444-444444444444',
  'insert into app.events (event_type, idempotency_key) values (''technician.arrived'', ''evt-key-1'')',
  '23505');

select pg_temp.check_denied('events cannot be deleted',
  '11111111-1111-1111-1111-111111111111',
  'delete from app.events where idempotency_key = ''evt-key-1''');

-- ---------------------------------------------------------------------------
-- Policy and invite control is owner-only
-- ---------------------------------------------------------------------------

select pg_temp.check_denied('admin cannot create an autonomy policy',
  '22222222-2222-2222-2222-222222222222',
  'insert into app.policies (name, entity_type, rule, approved_by)
   values (''self granted'', ''quote'', ''{"max_amount": 999999}''::jsonb,
           ''22222222-2222-2222-2222-222222222222'')');

select pg_temp.check_bool('owner can create an autonomy policy',
  '11111111-1111-1111-1111-111111111111',
  'with i as (
     insert into app.policies (name, entity_type, rule, approved_by)
     values (''small quotes'', ''quote'', ''{"max_amount": 2000}''::jsonb,
             ''11111111-1111-1111-1111-111111111111'')
     returning 1)
   select count(*) = 1 from i', true);

select pg_temp.check_count('admin cannot read invite codes',
  '22222222-2222-2222-2222-222222222222', 'select count(*) from app.invite_codes', 0);

select pg_temp.check_no_effect('supervisor cannot approve a pending user',
  '33333333-3333-3333-3333-333333333333',
  'update app.profiles set approval_status = ''Approved''
     where id = ''66666666-6666-6666-6666-666666666666''');

-- ---------------------------------------------------------------------------
-- Privilege escalation
--
-- HR maintains employee records, so RLS must let HR write to app.profiles.
-- Row policies check who is acting, not which columns change — without the
-- privilege guard, HR could promote any account to Owner and take over the
-- company. These are the assertions that hold that door shut.
-- ---------------------------------------------------------------------------

select pg_temp.check_denied('HR cannot promote a worker to Owner',
  '77777777-7777-7777-7777-777777777777',
  'update app.profiles set role = ''Owner''
     where id = ''44444444-4444-4444-4444-444444444444''');

select pg_temp.check_denied('HR cannot promote themselves to Owner',
  '77777777-7777-7777-7777-777777777777',
  'update app.profiles set role = ''Owner''
     where id = ''77777777-7777-7777-7777-777777777777''');

select pg_temp.check_denied('HR cannot approve a pending user',
  '77777777-7777-7777-7777-777777777777',
  'update app.profiles set approval_status = ''Approved''
     where id = ''66666666-6666-6666-6666-666666666666''');

select pg_temp.check_denied('HR cannot create a pre-approved Owner',
  '77777777-7777-7777-7777-777777777777',
  'insert into app.profiles (full_name, role, approval_status)
   values (''Backdoor'', ''Owner'', ''Approved'')');

select pg_temp.check_denied('HR cannot lift an outsourced expiry',
  '77777777-7777-7777-7777-777777777777',
  'update app.profiles set access_expires_at = null
     where id = ''88888888-8888-8888-8888-888888888888''');

select pg_temp.check_bool('HR CAN still edit an employee name',
  '77777777-7777-7777-7777-777777777777',
  'with u as (
     update app.profiles set full_name = ''Worker W (updated)''
      where id = ''44444444-4444-4444-4444-444444444444'' returning 1)
   select count(*) = 1 from u', true);

select pg_temp.check_bool('owner CAN approve a pending user',
  '11111111-1111-1111-1111-111111111111',
  'with u as (
     update app.profiles set approval_status = ''Approved''
      where id = ''66666666-6666-6666-6666-666666666666'' returning 1)
   select count(*) = 1 from u', true);

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

\o
reset role;
\set QUIET off

\echo ''
\echo '================ AUTHORIZATION TESTS ================'
select
  case when passed then '  PASS  ' else '  FAIL  ' end as result,
  name,
  case when passed then '' else detail end as detail
from _results
order by passed, name;

\echo ''
select
  count(*) filter (where passed)       as passed,
  count(*) filter (where not passed)   as failed,
  count(*)                             as total
from _results;

-- Fail the run if anything did not pass.
do $$
declare failures int;
begin
  select count(*) into failures from _results where not passed;
  if failures > 0 then
    raise exception '% authorization test(s) failed', failures;
  end if;
  raise notice 'All authorization tests passed.';
end;
$$;
