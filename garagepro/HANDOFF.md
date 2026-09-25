# GaragePro — handover note for a new Claude session

Paste this whole note into a new Claude Code session (or give Claude this folder) to continue.

## What this is
GaragePro = web app for **MendTech Auto** (workshop, Al Quoz Dubai) and **MendTech Mobile** (van service Dubai & Sharjah).
Plain HTML/CSS/JavaScript, no build step. Offline-first (IndexedDB in the browser) with optional Supabase cloud sync.
Open `index.html` in Chrome, or use the live site.

- Live site: https://mendtechauto.netlify.app  (Netlify, owner's personal account, publish = drag this folder onto Deploys)
- Customer booking page: https://mendtechauto.netlify.app/book.html
- Cloud data: Supabase (owner's personal account). Table `records` (all data, row-level security per garage account) + `requests` (booking-page inbox, public insert only).
- WhatsApp for all enquiries/app messages: +971 52 233 8499. Calls: +971 55 957 4148.
- Version in this folder: 3.2.0 (mendtech. branding + MendTech Mobile + Security Level 1). Nothing after 3.0.1 is live yet.
- Source of truth is now git: repo `mendtech23/mts-field-app`, folder `garagepro/` (live config). The preview build = same folder with `js/config.js` set to mode 'preview', dbName 'garagepro-preview', no Supabase keys.

## Folder / file map
- `js/config.js` — mode: 'live' (real data, DB 'garagepro') or 'preview' (test DB 'garagepro-preview', sync off). Settings → Mobile & booking → "Download config.js" adds Supabase URL/anon key/garageId for the booking page.
- `js/core.js` storage, data model, maths, stock by location, mobile helpers, settings defaults + migrations (`migrateSettings`, schema 31)
- `js/ui.js` router/nav/modals/forms · `js/icons.js` + `js/icon-paths.js` line icons, dark mode
- `js/pages-main.js` dashboard, check-in, vehicle history, customers, vehicles
- `js/pages-docs.js` quotes, job cards, invoices, payments (shared editor `ED`, `docShell`)
- `js/pages-stock.js` parts, POs, suppliers, labour, technicians
- `js/pages-admin.js` reminders, expenses, reports, settings, backup, Excel
- `js/mobile.js` MendTech Mobile (request form, dispatch, crew "My jobs", status flow, van stock)
- `js/requests.js` online requests inbox, booking settings, Auto-vs-Mobile report
- `js/documents.js` HTML + PDF documents (jsPDF) · `js/share.js` WhatsApp/email/SMS, QR
- `js/security.js` PBKDF2 PIN hashing + lockout (`PinGuard`), `ownerApprove()`, security log (`secLog()`, synced collection `secLog`), encrypted backups, headers check
- `_headers` Netlify security headers (CSP needs 'unsafe-inline' because the UI uses inline onclick handlers)
- `js/photos.js`, `js/prints.js`, `js/finance.js` (month-end), `js/pro.js` (bookings, packages, signatures), `js/auth.js` (staff PIN + roles), `js/sync.js` (Supabase sync), `js/app.js` (boot + demo data)
- `book.html` + `js/book.js` public booking page · `sw.js` offline cache (bump CACHE name on every release) · `lib/` bundled jsPDF, xlsx, supabase, qrcode

Gotchas: mobile service settings live in `S.settings.mob` (NOT `.mobile`, that's a phone field). `render()` closes modals synchronously before any await. Deletions must go through `remove()` / `wipeCollections()` so cloud tombstones sync.

## Status (25 Sep 2026)
- v3.2.0 built = mendtech. branding (PREVIEW ONLY — not published). Brand source: owner's PDF "MenDTech automotive branding" (letterhead, quotation, tax invoice, job card) + logo images.
  - Exact vector logo + "m." mark extracted from the owner's PDF → `img/brand/*.svg`; app icons in `icons/` (192/512/maskable/apple/favicon/.ico).
  - Colours: navy #122036, steel #9AA3B5, gold #C9A227 (labels #A9812E), orange #D97A2B, ink #4B5265/#6C7488, lines #DEE3E9/#C7CCD9. Fonts: Inter (text) + Space Grotesk (titles), bundled in `fonts/` (OFL) and as PDF fonts in `lib/pdf-fonts.js`; logo/watermark PNGs for PDFs in `lib/brand-assets.js`.
  - `js/documents.js`: docHTML (print/preview) + buildPDF (jsPDF) both follow the templates: quotation, tax invoice, job card (page 1 = vehicle check-in, page 2 = work & parts), receipt, letterhead, blank job card. Job card editor has a new "Vehicle check-in" card (`job.checkin`: timeIn, keys, location, breakdown, body{area:OK|S|D|C}, items{item:true|false}, bodyNotes).
  - Reports (statement, vehicle history, screen print, photo report + its PDF), QR poster and booking page use the same letterhead/brand.
  - New setting `docFooter` (bottom-right line on documents). Settings schema 33: brand terms replace the old default terms only if never edited.
- Open questions for the owner: address on documents (brand PDF says Sharjah; app settings say Al Quoz, Dubai), quote validity (brand terms say 7 days; app setting 14 — terms now use {validDays}), TRN (blank), MOBILE hours (brand says 24/7; setting says 08:00–20:00).

## Status (24 Sep 2026, later)
- v3.1.0 built = Security Level 1 (item 1 below), tested in a browser, waiting for the owner to test the preview and publish.
- IndexedDB version is now 5 (new `secLog` store). Settings schema 32.

## Status (24 Sep 2026)
- v3.0.1 is ready to go live / going live today (see "GO LIVE - STEPS.txt" and the Go-Live & Security Guide).
- Guides (claude.ai docs): User Manual, Team Briefing & Trial Guide, Go-Live & Security Guide.

## Agreed next work (not built yet)
1. **DONE in v3.1.0 — Security Level 1** (free): 6-digit PINs with stronger hashing + lockout after 5 tries; Owner-PIN approval for discount > 10%, void/delete invoice, delete payment, reopen month, changing bank/Stripe details; password-protected backups; Netlify `_headers` security headers; booking-page rate limit via SQL trigger; in-app security alerts.
2. **Security Level 2** (free): owner keeps email+password + 2FA (Supabase TOTP) as master; staff get individual logins (recommended: username + password created by owner via a Supabase Edge Function using the service role; SMS OTP is paid in UAE) with designation set by the owner; roles enforced by Supabase RLS (members table: garage_id, user_id, role, active); drivers only get their own jobs; device list + remote revoke; append-only audit log by trigger. Keep the old shared garage login working until all staff migrate.
   Waiting for owner: staff login choice (A username/password recommended) + staff list (name + designation) + "go".
3. **Phase 0/1 revenue features** (preview mock-up approved in chat): tap-to-approve quotes, campaigns + follow-ups of work not done, Google review request, referral credits (AED 50/50), free 20-point health check, pre-purchase inspection report, RTA renewal help tracker, at-home tyre fitting, tyre storage, partner extras.
   Waiting for owner: Google review link, referral amount, health-check rule, prices (PPI, RTA help, tyre fitting), expected cars/week.
4. Later: fleet accounts, memberships, service days at towers, motorbikes, insurance claims, EV checklist, KPI dashboard, Tabby/Tamara link.

Working style the owner likes: build as a separate PREVIEW first, test everything, then the owner publishes by dragging the folder onto Netlify. Keep everything off the Emirates work OneDrive; use personal locations only.
