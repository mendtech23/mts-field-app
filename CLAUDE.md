# MendTech / GaragePro — instructions for Claude

This repo holds **GaragePro** (brand "mendtech."): the workshop app for **MendTech Auto** (garage, Industrial Area 2, Sharjah) and **MendTech Mobile** (van service). It is live at https://mendtechauto.netlify.app with real customers and money in it. The owner is not a developer; they work full-time elsewhere and run the garage with a small team.

Before any change, also read `docs/garagepro/NOTES.md` (version history, what the owner still has to do, the ideas list, open questions). Keep that file up to date at the end of every piece of work.

## How to work with the owner
- Plain, friendly, step-by-step English. No jargon; when a technical word is unavoidable, explain it in a few words. Their messages are informal, often typed on a phone.
- They prefer things **optional, not mandatory** (e.g. Google review reminders are a tick box).
- When they list several change requests and say "keep note", **collect them in NOTES.md and build them together** when they say go.
- When they ask "let me know first", propose (a short table of options + your recommendation) and wait.
- **Never ask for or repeat secrets**: passwords, PINs, authenticator codes, Supabase `sbp_…` access tokens, `service_role` keys, Resend `re_…` keys. Remind them never to send these in chat. (The anon key and project refs in `garagepro*/…/config.js` are public by design.)
- Everything stays on their **personal** accounts and devices — never the Emirates work PC or work OneDrive.
- **Preview first, then they publish.** You build and test; they drag the folder into Netlify themselves.

## Repo map
- `garagepro/` — **the app** (plain HTML/CSS/JS, no build step). This exact folder is what gets deployed; don't put dev files in it. `js/config.js` here is the **LIVE** config.
- `garagepro-cloud/` — not part of the website: `sql/level2.sql` (+ `sql/all-in-one.sql` bundle the owner runs in Supabase), `functions/` (Edge Functions login, staff-admin, notify), `preview/config.js` (PREVIEW config), `tests/`, `SETUP-GUIDE.md`, `deploy-live.txt`.
- `tools/garagepro-release.sh` — version bump + zips (see the `garagepro-release` skill).
- `.github/workflows/deploy-functions-*.yml` — Edge Function deploys (preview: automatic on push to this branch; live: when `garagepro-cloud/deploy-live.txt` changes).
- Everything else at the root (`app.js`, `index.html`, `auto-concierge/`, `finance-os/`, `website/`, `docs/*.md` except `docs/garagepro/`) is the **older "MendTech OS" field app** — leave it alone unless asked.

**Branch:** all GaragePro work is on `claude/handoff-continuation-l39e0b` (it is ahead of `main`). Develop there unless told otherwise. Don't open a pull request unless the owner asks.

## Architecture essentials
- Offline-first: IndexedDB in the browser (`DB`, version **8**), data in memory as `S.<collection>`; `save(coll, obj)` / `remove(coll, id)` (always use these so cloud tombstones sync). Collections list: `COLLECTIONS` in `js/core.js`. Adding a collection = add it there, bump the IndexedDB version, add it to backup/restore and the SQL `app.can_access` rules.
- Settings live in `S.settings`; new defaults go through `migrateSettings()` in `js/core.js` with the next **schema** number (currently 38). Mobile settings are `S.settings.mob` (not `.mobile`).
- UI: hash router `PAGES.<name>` + `go('#/name')`; `openForm({fields, data, onSave})`, `openModal`, `confirmBox(msg, ok, danger, noLabel)`, `table(cols, rows, opts)`, `pill()`, `toast()`. Screen text shows emoji that `icons.js` swaps for SVG; many labels are CSS-uppercased.
- Money: `money(v)`, `r2()`, `num()`; `calcDoc(doc)` gives net/vat/total/cost; month figures in `monthData(mk)` (`js/finance.js`); cash & bank in `js/money.js`.
- Roles (`ROLES` in `js/auth.js`): owner, manager, advisor, technician, driver. Service advisors must never see money collections (`MONEY_COLLS`: expenses, incomes, transfers, cashups, fixedCosts) — enforced in three places that must agree: `ROLES` page access, `Sync.canPush` (`js/sync.js`), and SQL `app.can_access` (`level2.sql`).
- Cloud (Supabase, owner's personal account): table `records` (coll, id, data jsonb, deleted, owner=garage) with row-level security; booking inbox `requests`. Projects: **preview** `ugpaqdthrxbulrxeijpz`, **live** `otdmnzvmlqjppydokcfv`. Free plan: ~500 MB, so photos are compressed (1280 px) and there is a cloud space meter.
- E-mail alerts: SQL `app.alert` → pg_net → `notify` function → Resend. Security-only by default.
- `sw.js` caches the app: **bump the CACHE name with every release** (the release script does it together with `APP_VERSION`).
- `render()` closes modals synchronously before any await. Functions that open a confirm box must not be awaited in tests.

## Changing the database (SQL)
Edit `garagepro-cloud/sql/level2.sql` only, keep it **idempotent** (safe to run twice: `create or replace`, `if not exists`, `drop policy if exists`…). The release script rebuilds `all-in-one.sql` from it. The owner runs the bundle in Supabase → SQL Editor → Run, **before** dragging in the app. Say clearly in the reply when an update needs the SQL step and when it doesn't.

## Edge Functions
Changes under `garagepro-cloud/functions/` deploy to the **preview** project automatically when pushed. For **live**, add a new "Last requested: <date> — <why>" line to `garagepro-cloud/deploy-live.txt` and push; check the run succeeds. If Supabase answers "FGA Authentication Error / Unauthorized" for both projects at once, check status.supabase.com before blaming the tokens (it was a Supabase outage on 2026-10-06).

## Git
Commit with clear messages that explain the why; end them with the attribution lines the session gives you. Never put a model name in commits, code or files. Push with `git push -u origin <branch>`.

## Skills in this repo
- `garagepro-change` — the workflow for any change or new feature (understand → build → test → release → reply).
- `garagepro-test` — how to run the test suites in a cloud session.
- `garagepro-release` — version bump, zips, SQL / function steps, and the install message for the owner.
