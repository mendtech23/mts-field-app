# Backend — Phase 1 foundation

The schema that replaces device-local storage with a real system of record.
This is what makes the role model mean something: in v13 roles were interface
decoration and every price, job and phone number was readable from browser
devtools. Here, access is decided by the database and a wrong answer is a
failing test rather than a discovered breach.

## What is here

| File | Purpose |
|---|---|
| `migrations/0001_foundation.sql` | Tables, identity helpers, RLS policies, append-only audit and event logs, the quote approval invariant |
| `migrations/0002_grants.sql` | Table privileges for the application role. Audit and event logs get INSERT/SELECT only — no UPDATE or DELETE privilege exists to be abused |
| `migrations/0003_privilege_guard.sql` | Blocks privilege escalation: only the Owner may change a role, approval status or access window |
| `../tests/authorization.test.sql` | 38 assertions covering every role against every sensitive table |

## Running the tests

Against a local PostgreSQL:

```bash
npm run test:db
```

That drops a scratch database, applies every migration from scratch, runs the
suite, and drops it again. It proves the migrations work from nothing, not just
against a database already in the right state.

## Design decisions worth knowing

**Access rules live in SQL, not JavaScript.** A policy written in the client can
be edited by the client. Every rule here is enforced by PostgreSQL, so bypassing
it requires database credentials rather than devtools.

**`force row level security` is set on every table.** Without it the role owning
the schema silently bypasses every policy — a common and quiet mistake.

**Row-level security denies by hiding rows, not by raising errors.** An UPDATE a
caller is not allowed to make affects zero rows and *succeeds*. The application
must therefore check the affected row count before reporting success — the same
discipline the sync queue now applies to its HTTP responses. `check_no_effect`
in the test suite asserts this behaviour explicitly.

**The audit and event logs cannot be rewritten.** Two defences: no UPDATE or
DELETE privilege is granted, and triggers reject those operations outright. The
`audit_has_authority` constraint additionally refuses any entry that has neither
an actor nor an authorising policy, so an untraceable change cannot be recorded.

**Agents cannot approve their own work.** `enforce_quote_authority` refuses to
let a quote reach `APPROVED` or `EXECUTED` without either an approver or a named
policy. Because it is a database trigger, a compromised or prompt-injected agent
degrades to noise rather than unauthorised spending.

**The first Owner is a bootstrap.** `guard_privilege_fields` permits creating an
Owner only while no Owner row exists. The check is on existence, not on active
status, so revoking the owner cannot reopen that door.

## Deploying to Supabase

1. Create a project. Choose the region nearest the UAE — Frankfurt or Mumbai.
   There is no UAE region; see the residency note in `docs/AI_ORG_PLAN.md`.
2. Run the migrations in order in the SQL editor, or via the Supabase CLI.
3. Grant the application role to Supabase's authenticated role:

   ```sql
   grant app_user to authenticated;
   ```

4. `app.current_profile_id()` resolves from `auth.uid()` automatically once the
   `auth` schema is present. No policy changes are needed between local and
   hosted environments.

## Not yet built

- Invite-code redemption and PIN unlock (table exists; the flow does not).
- The client data layer still reads `localStorage`; swapping it is the next
  task and is what finally allows `OWNER_ONLY_MODE = false`.
- Zoho sync worker reading from `app.events`.
