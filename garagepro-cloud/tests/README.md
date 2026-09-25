# Level 2 tests (local Supabase stand-in)

No Docker or internet access to supabase.co was available while building, so the tests run against a local copy:

- **Postgres 16** database `sb`: `stack/roles.sql` (Supabase-like roles), then GoTrue's own migrations, then the v3 scripts (records + requests, from the app), `stack/net-stub.sql` (records pg_net calls instead of sending them), and `../sql/level2.sql`.
- **GoTrue** (Supabase Auth), built from source (`go install github.com/supabase/auth@<master pseudo-version>`), configured by `stack/gotrue.env` (port 9999, MFA TOTP on). Test-only secrets.
- **`stack/gateway.js`** on :8200 plays the Supabase API gateway: `/auth/v1` → GoTrue, `/rest/v1` → a PostgREST subset (sets role + `request.jwt.claims` like PostgREST), `/functions/v1/<name>` → the Deno functions.
- **`stack/start-fns.sh`** runs the three Edge Functions with Deno and a fake Resend (`stack/mockmail.js`, :8310).
- **`stack/app-copy.sh`** copies the app with a preview `config.js` pointing at the gateway; `/tmp/pgt/server.js` serves it on :8099.

Run (with `PG_MODULES` pointing at a folder containing the `pg` npm package):

    node level2-db.test.mjs        # 120 checks: roles, approvals + lockout, audit log, devices, crew, quote link, MFA
    node functions.test.mjs        # 48 checks: login lockout, staff admin, switch-off / reset, e-mail alerts, daily summary
    node app-level2.e2e.mjs        # 45 checks in Chromium: the full changeover with 4 devices
