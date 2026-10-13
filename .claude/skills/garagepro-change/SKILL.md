---
name: garagepro-change
description: Workflow for any change, fix or new feature in the GaragePro / mendtech. garage app (folder garagepro/) — from understanding the owner's request to a tested build and a plain-English reply. Use whenever the owner asks to add, change, fix or check something in the app.
---

# Making a change to GaragePro

Read `CLAUDE.md` and `docs/garagepro/NOTES.md` first if you haven't this session.

## 1. Understand the request
- Restate it in one line in your head; if the owner's wording allows two meanings that lead to different builds (e.g. "paid 1,000 of 5,500" = part payment vs split cost), ask one short question with the options, or explain both in the reply.
- If they said "keep note" / "we'll do it together", add it to NOTES.md (Ideas list or a "Next update" section) and stop there.
- If they said "let me know first", reply with a short options table + recommendation and wait.
- Check whether the app already does it — often the answer is "here's how" (step-by-step taps), not code.

## 2. Find the code
- Page → `PAGES.<name>` (grep `PAGES.` in `garagepro/js/`). File map is in the header comment of each `js/*.js` file.
- Follow the existing style: compact one-liners, template-string HTML, the same helpers (`openForm`, `table`, `pill`, `money`, `confirmBox`). Short header comment for a new file; new `<script>` tags go in `garagepro/index.html` **and** the `sw.js` cache list.
- New setting default → `migrateSettings()` next schema number. New collection → `COLLECTIONS`, IndexedDB version, backup/restore, SQL `app.can_access`, and `MONEY_COLLS` if it holds money.
- Anything about money: check the knock-on places — month-end (`monthData`, closing page, Excel), Reports page, Cash & bank (`moneyMoves`), day report, VAT figures, fixed costs, KPI.
- Cloud/SQL: edit `garagepro-cloud/sql/level2.sql` (idempotent) + add checks to `garagepro-cloud/tests/level2-db.test.mjs`.

## 3. Make it optional and safe
- New behaviour that changes what customers receive or what staff must do → a tick box, default off unless the owner asked otherwise.
- Never lose data: edits go through `save()`, deletions through `remove()`; respect closed months (`guardClosed` / `isClosedPeriod`).
- Phone first: the owner and team use phones. Check 390 px width (no sideways scroll, nothing cut off).

## 4. Test (see the `garagepro-test` skill)
- Add or extend a suite in `garagepro-cloud/tests/app/` that walks the owner's exact scenario (their numbers), including phone width and "no page errors".
- Run the related suites + `crawl.mjs`. Look at a screenshot of anything visual.

## 5. Release (see the `garagepro-release` skill)
Bump the version (patch for small fixes, minor for a feature batch), build zips, commit, push, send files, reply.

## 6. Reply to the owner
- Lead with the result in one line ("Done — v3.8.3 is ready" / "No update needed, here's how").
- Install steps only if they need to do something; say whether SQL is needed.
- How to use it: numbered taps with the exact on-screen names, using their own example.
- Mention anything you noticed but didn't change, and update NOTES.md (shipped, to-dos, ideas).
