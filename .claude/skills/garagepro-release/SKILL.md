---
name: garagepro-release
description: Release a new GaragePro version — bump the version, rebuild the SQL bundle, build the LIVE and PREVIEW zips, deploy Edge Functions if they changed, commit and push, send the files and give the owner plain install steps. Use after a tested change to garagepro/ or garagepro-cloud/.
---

# Releasing GaragePro

1. **Pick the version**: patch (3.8.2 → 3.8.3) for fixes/small additions, minor (3.9.0) for a feature batch. If a test pins the exact version, make it `startsWith('3.x')`.
2. **Build**: `tools/garagepro-release.sh <version> <scratchpad>/out [--sql]`
   - bumps `APP_VERSION` and the `sw.js` cache, rebuilds `all-in-one.sql` from `level2.sql`, syntax-checks every JS file, builds `GaragePro-v<V>-LIVE.zip` (folder **GaragePro-LIVE**, live config) and `-PREVIEW.zip`, and checks each zip carries the right Supabase project.
   - add `--sql` only when `level2.sql` changed since the last release the owner installed → also writes `all-in-one-v<V>.sql`.
3. **Re-run the tests** you ran for the change (version-sensitive suites) — see `garagepro-test`.
4. **Edge Functions** changed? Pushing deploys them to preview automatically. For live: append a line `Last requested: <date UTC> — v<V> <what>` to `garagepro-cloud/deploy-live.txt`, push, and check the "Deploy functions to LIVE" run succeeds (GitHub Actions). Update `garagepro-cloud/SETUP-GUIDE.md` test counts if they changed.
5. **Commit and push** to the working branch with a message that says what the owner gets and why; end with the session's attribution lines.
6. **Send files** to the owner: the LIVE zip (and the SQL file if any). The PREVIEW zip only if they still use the test site.
7. **Update `docs/garagepro/NOTES.md`**: version table row, owner's to-dos.

## Install message template (plain English, numbered)
> **v<V> is ready** — <one line of what's new>.
> 1. *(only if SQL)* Supabase → your **live** project → SQL Editor → paste all of `all-in-one-v<V>.sql` → **Run** → it should say Success. Do this **before** step 2.
> 2. Unzip `GaragePro-v<V>-LIVE.zip` → Netlify → **mendtechauto** → Deploys → drag the **GaragePro-LIVE** folder in → wait for "Published".
> 3. Close and reopen the app on each phone/PC → Settings shows **<V>**.
> Then: how to use the new thing, with their own example.

Say "app only, no SQL" when there's no SQL. Never include secrets. If a deploy fails, read the job log, and say exactly what's blocked and what they need to do.
