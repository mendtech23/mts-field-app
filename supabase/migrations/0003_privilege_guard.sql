-- ============================================================================
-- Privilege guard
--
-- The RLS policy on app.profiles checks WHO is acting, not WHAT they change.
-- That left HR — who legitimately maintains employee records — able to set any
-- profile's role to 'Owner', or to approve a pending account. Row policies
-- cannot express "these particular columns are owner-only", so the constraint
-- is enforced with a trigger.
--
-- Only the Owner may alter the fields that grant access:
--   role, approval_status, access_expires_at, revoked_at
-- ============================================================================

create or replace function app.guard_privilege_fields()
returns trigger
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
  if app.is_owner() then
    return new;
  end if;

  -- Bootstrap: the very first Owner has to come from somewhere, and at that
  -- moment there is no Owner to authorise it. Once any Owner row exists this
  -- door is shut permanently — the check is on existence, not on active
  -- status, so revoking the owner cannot reopen it.
  if not exists (select 1 from app.profiles where role = 'Owner') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A non-owner may only create an unprivileged, unapproved account.
    -- Approval and role assignment remain the Owner's decision.
    if new.role <> 'Worker' or new.approval_status <> 'Pending' then
      raise exception 'only the Owner may create an approved or privileged profile'
        using errcode = 'insufficient_privilege';
    end if;
    if new.access_expires_at is not null or new.revoked_at is not null then
      raise exception 'only the Owner may set access windows'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'only the Owner may change a role'
      using errcode = 'insufficient_privilege';
  end if;

  if new.approval_status is distinct from old.approval_status then
    raise exception 'only the Owner may approve or reject a user'
      using errcode = 'insufficient_privilege';
  end if;

  if new.access_expires_at is distinct from old.access_expires_at
     or new.revoked_at is distinct from old.revoked_at then
    raise exception 'only the Owner may change access windows'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger profiles_privilege_guard
  before insert or update on app.profiles
  for each row execute function app.guard_privilege_fields();
