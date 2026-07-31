-- ============================================================================
-- Grants
--
-- Table privileges are the outer gate; RLS policies are the inner one. Both
-- must allow an operation for it to succeed. The audit and event logs are
-- granted INSERT and SELECT only — no UPDATE or DELETE privilege exists to be
-- exercised, so history cannot be rewritten even if a policy were mistakenly
-- widened later.
--
-- On Supabase, run this with `authenticated` in place of app_user, or simply
-- create app_user as a group role and grant it to authenticated.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end;
$$;

grant usage on schema app to app_user;

grant select, insert, update, delete on app.profiles        to app_user;
grant select, insert, update, delete on app.invite_codes    to app_user;
grant select, insert, update, delete on app.policies        to app_user;
grant select, insert, update, delete on app.customers       to app_user;
grant select, insert, update, delete on app.jobs            to app_user;
grant select, insert, update, delete on app.job_assignments to app_user;
grant select, insert, update, delete on app.quotes          to app_user;

-- Append-only: deliberately no UPDATE, no DELETE.
grant select, insert on app.audit_events to app_user;
grant select, insert on app.events       to app_user;

grant usage, select on all sequences in schema app to app_user;

grant execute on function
  app.current_profile_id(),
  app.current_role(),
  app.is_owner(),
  app.is_active(uuid),
  app.can_see_prices()
to app_user;
