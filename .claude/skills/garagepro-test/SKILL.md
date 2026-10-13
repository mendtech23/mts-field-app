---
name: garagepro-test
description: How to run and write the GaragePro automated tests (browser suites with Playwright, plus the optional local Supabase stack for cloud/database tests). Use before releasing any change to the garagepro/ app or garagepro-cloud/.
---

# Testing GaragePro

## Browser suites (always available)
- The session-start hook serves the app at `http://localhost:8099/new/index.html` straight from `garagepro/` with an offline test config (`garagepro-cloud/tests/stack/serve-app.mjs`). If it isn't up: `(setsid nohup node garagepro-cloud/tests/stack/serve-app.mjs > /tmp/gp-web.log 2>&1 &)`.
- Run from `garagepro-cloud/tests/app/`: `timeout 300 node <suite>.mjs`. Lines start with `PASS`/`FAIL` (older suites print `ok`/`FAIL` and "N passed, M failed").
- Offline suites: `crawl.mjs` (visits every page, ~470 visits), `v35.mjs`, `v38-money.mjs`, `v381-setup.mjs`, `credit-bills.mjs`, `wage-receipt.mjs`, `location.mjs`, `review-optional.mjs`, `printroot.mjs`, `upgrade.mjs` (3.5.0 data → current; needs `/tmp/pgt/old`).
- Pattern for a new suite: copy the top of `v381-setup.mjs` (Playwright import from `/opt/node22/lib/node_modules/playwright/index.mjs`, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `ok()` helper, `ev()` = page.evaluate, `set()` fills `#f_<field>` inputs, `save()` clicks the form's save). Check the phone width with `P.setViewportSize({ width: 390, height: 900 })` and `scrollWidth <= innerWidth + 1`. End with `ok(!errs.length, 'no page errors', errs)`. Screenshots to `/tmp/pgt/*.png` and look at them with Read.

## Gotchas
- Many labels are CSS-uppercased: match `innerText` with case-insensitive regexes.
- Emoji like ★ ↩ are swapped for SVG icons — check text, not the symbol.
- Don't `await` a function that opens a confirm box inside `ev()`; call it, then click `[data-ok]` / `[data-no]`.
- Never `pkill -f` with a pattern that also appears in your own command line (it kills your shell). Kill by PID from `pgrep -f '^node …'`; for Deno use `pkill -x deno`.
- Demo data loads in the test browser; compare before/after values rather than absolute totals.

## Cloud / database suites (only if the local stack exists)
`garagepro-cloud/tests/README.md` explains the local Supabase stand-in (Postgres 16 db `sb`, GoTrue from source, `stack/gateway.js` :8200, Deno functions, mock Resend :8310). It was built by hand under `/tmp/pgt` and is **not** in a fresh container (no GoTrue binary). If `/tmp/pgt/gotrue/auth` exists, start it with:
```
sudo pg_ctlcluster 16 main start
(cd /tmp/pgt/gotrue && set -a && . /tmp/pgt/sb/gotrue.env && set +a && nohup ./auth serve > /tmp/pgt/gotrue.log 2>&1 &)
bash /tmp/pgt/stack/start-gw.sh; bash /tmp/pgt/stack/start-fns.sh
```
then `PG_MODULES=/tmp/pgt/stack/node_modules node garagepro-cloud/tests/level2-db.test.mjs` and `functions.test.mjs` (run functions before `v38-restore.mjs`, which reads its mailbox). Without the stack: check SQL by careful reading, keep it idempotent, and tell the owner the SQL step was not run against a test database.
