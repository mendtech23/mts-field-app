# GaragePro — running notes

Update this file at the end of every piece of work: what shipped, what the owner still has to do, new ideas, answers to open questions.

## Where things stand (2026-10-13)
- **Built:** v3.9.0 (branch `claude/handoff-continuation-l39e0b`), app only — sent 2026-10-13.
- **Live:** v3.8.0 confirmed installed by the owner (SQL + Netlify done, functions deployed to live and preview on 2026-10-06). v3.8.1 / v3.8.2 were sent as zips (app only, no SQL) — ask whether they were installed.
- Cloud space at install: 13 MB of 500 MB (3%), no photos yet. Tell them to check monthly; act at ~300 MB (move photos to separate storage).

## Version history (short)
| Version | What | SQL? |
|---|---|---|
| 3.5.x | Other income, plain documents, PIN after unlock, MFA alerts | yes |
| 3.6.0 | Screen PIN kept in cloud, browser-forgets help, audit log clean-up | yes |
| 3.6.1 | Workshop map link (`{directions}`, booking page, QR on documents) | no |
| 3.6.2 | Wage receipt (Technicians → Wage receipt, records a salary expense) | no |
| 3.6.3 | "Forgot PIN?" on the lock screen | no |
| 3.7.0 | Expenses on credit, supplier debts, pay supplier | no |
| 3.7.1 | Google review reminders optional | no |
| 3.8.0 | Cash & bank, close the day, fixed costs, day report + weekly backup e-mail, supplier bills/cheques/statements/credit limits, customer credit, labour fixed price, comebacks, private feedback page, smaller photos, cloud meter | **yes** + notify function |
| 3.8.1 | Opening / setup costs kept out of monthly profit; Reports → Investment & payback | no |
| 3.8.2 | Only part of a bill can be the opening cost | no |
| 3.9.0 | Advance on a job, Quick past job, invoice date follows the job, plate/phone/km "not known yet" (TEMP- plates), Missing details list, default job type Mechanical Repair, On Hold status, Repeat expense | no |

## Owner's to-do list (remind gently, don't nag)
- First-time setup after 3.8: Cash & bank real balances + cash float; fixed costs list (they'll enter and price it themselves); supplier credit days/limits; customer credit terms; optional weekly backup tick (file is not password-protected); optional private feedback tick.
- Close the day once and confirm the day report e-mail arrives.
- Mark opening costs (Expenses → Mark opening costs).
- Rent example: rent 5,500, paid 1,000, rest due mid-month → expense 5,500 "Part paid now, rest on credit", paid now 1,000, due date the 15th; Record payment of 4,500 when paid. (Their answer: this is a part payment, not a split opening cost.)
- Auto-lock 10 minutes (Staff & security).
- Service list imported into the app by the owner (2026-10-17, MendTech_App_Import_Services.xlsx, 149 items, prices = hours × labour rate for now). Owner filling prices in the catalogue and sending it back → then build "update prices from Excel".
- Export 25 Oct checked: 13 jobs/invoices, 5,700 invoiced = 5,700 cash received. Razzak answered: 3,000 = parts bought, 1,600 = labour (customer paid 4,600). Told owner: INV-0013 add Custom line → type Part 3,000 (cost stays 0), payment 3,000 on 12 Oct, expense 3,000 'Parts for Razzak Urvan' category Other. Other open points: 3 payments dated before their invoice (INV-0015/16/17), JC-0023 dated 25 Oct vs invoice 24 Oct, INV-0016 empty 0-line, no expenses after 6 Oct (8 notebook bills 185 + parts for jobs), rent balance 1,700 due 25 Oct, AAH 01-03 placeholder names, Altima no owner, Honda City km 12345.
- Catching up October work from the notebook (export compared 14 Oct): several jobs, 2 supplier bills and 2 customers still to enter; owner sending missing amounts.

## Open questions to the owner (accounting, asked 2026-10-06, not answered yet)
Which to build: 1 balance sheet, 2 owner's account, 3 loans & instalments, 4 VAT return helper (FTA layout; warning at AED 375,000 if not registered), 5 corporate tax estimate (UAE 9% over AED 375,000 profit; accountant to confirm small business relief), 6 equipment depreciation, 7 bank reconciliation (statement import), 8 year-end pack. Recommended first: 1, 2, 4, 7.
Also asked: VAT registered (TRN)? any loans (incl. family/friends)? opening costs paid from own pocket or the business account?

## Ideas list (not started — only when the owner says)
- **Update prices from Excel**: the import only ADDS services (skips names that exist). When the owner fills prices in the service catalogue (sent 2026-10-17 as Mendtech_Service_Catalogue_v2.xlsx: 105 garage + 48 mobile services, codes G-### / M-### in the app import), the import must also UPDATE rate/hours of existing ones (match by Op Code, then name). Fixed-price items need a "fixed price" flag on labour operations (today: hours × rate).
- Booking page service lists (Settings → Mobile & booking) could be shortened from the catalogue (only if the owner asks).
- **Parts bought for one job** (owner buys parts with cash per job, no stock): one button on the job that adds the part line with its cost AND records the cash out, so profit and cash are right without a separate expense (today: custom part line with cost 0 + an expense).
- "Find part" button (search by car + part, original vs copy grade on quotes)
- Tuning: agreement + waiver, build sheet
- Diagnostic assistant once they buy an Autel scanner (needs the model, a sample report, and an Anthropic API key the owner puts in Supabase secrets themselves)
- Technician time clock; simple HR section (later, when there are proper employees)
- Fixed menu prices / service packages
- WhatsApp automation, online payments, memberships, Arabic, barcode scanning
- Photos to separate storage when the cloud meter gets high
- Netlify connected to GitHub so updates publish without dragging folders (owner still decides when live changes)

## v3.10 proposal (sent 2026-10-25, waiting for the owner's go — "let me know first")
Based on the 25 Oct export (all labour-only invoices, parts bought with cash per job, payments dated before invoices, empty lines, no technician, no expenses after 6 Oct):
1. Parts bought for this job (part line with cost + cash out in one step) — recommended
2. Payment dated before the invoice → warn, offer "record as advance" — recommended
3. Job date later than its invoice → warn — recommended
4. Empty 0-amount lines removed on save (ask first) — recommended
5. Technician: pre-pick when there is only one technician — recommended
6. Dashboard nudge "no expenses recorded for X days" — recommended
7. Update prices from Excel + fixed-price items — when the priced catalogue comes back
8. Missing details also flags placeholder names like "AAH 01"
Owner then asked for the full list "and more" (2026-10-25). Added to the proposal:
9. Quick expense buttons on the dashboard (Fuel / Parts / Consumables, photo of the bill, 3 taps) — recommended v3.10
10. Optional "finish the job" check: km, complaint, work done asked when a job is delivered (tick in settings) — recommended v3.10
11. Owner's account (money put in / taken out; opening costs paid from own pocket) — v3.11
12. Simple balance sheet / "what the business owns and owes" — v3.11
13. Service reminder by WhatsApp from km / date (uses the catalogue intervals) — v3.11
14. Booking page list from the catalogue (mobile AC gas stays, safety check note) — v3.11
15. Later: VAT return helper (when registered), bank reconciliation, year-end pack, depreciation, loans; Find part; packages/memberships; Autel diagnostics; time clock; Arabic; Netlify auto-publish.

## v3.9 design notes
- Advance = a payment with `jobId`, `invoiceId: ''`, `advance: true`; `makeInvoiceFromJob` attaches it (`attachAdvances`). Counted in Cash & bank / day report from its date; customer page and statement show it.
- Razzak's Urvan was entered with the old workaround (INV-0013 = 3,000 "parts advance") before 3.9 — leave it; edit that invoice's lines when the job is finished.
- Invoice from a job dated earlier asks "job date or today"; payment form defaults to the invoice date when the invoice was created today for an earlier date.
- Temporary plates: `plateUnknown` + `TEMP-001…`; Missing details also flags plates with 4+ letters (e.g. SUNNY-AJECT), customers with no phone / garage's own number / "unknown|pending" names, cars with no owner or no km.

## Decisions made
- Google review reminders and private feedback are optional ticks.
- Service advisors never see money pages or records.
- Weekly backup e-mail is opt-in and not password-protected (owner told).
- Day report is sent only when the day is closed (owner/manager) in Cash & bank.
- Opening costs: kept out of monthly profit (not depreciated) — depreciation is idea #6 if wanted.
- AC gas top-up (2026-10-17): stays on the mobile booking page. Done on site only after a safety-standards check, and it depends on the area. Catalogue wording "no refrigerant work unless properly equipped" stays as the rule.

## Known small issues
- `garagepro/HANDOFF.md`, `README.txt` and `GO LIVE - STEPS.txt` ship with the website (anyone can open them at the site address). No secrets in them, but keep it that way; HANDOFF.md now just points here.
- Account opening balances live in synced settings, which advisors' devices also receive (minor).
