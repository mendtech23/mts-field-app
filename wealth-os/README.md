# Wealth OS — Johnny's Edge

Budgeting, expense tracking, investments, debt and an AI advisor in one place,
plus the workbook the whole thing is built on.

Two deliverables live here and they agree with each other to the dirham:

| | What it is |
|---|---|
| `Johnnys_Edge_Finance_OS.xlsx` | **The live workbook** — 26 sheets, 4,123 formulas, 22 integrity checks. Audited and amended. |
| `Johnnys_Edge_Lifetime_Finance.xlsx` | The earlier workbook, kept for reference |
| `index.html` + `js/` + `styles.css` | The app: an offline-capable PWA, 23 pages, seeded from the live workbook |

Everything is stated as of **26 August 2026**, the date of the last confirmed
balance in the source file.

---

## The number that decides the quarter

> **Earn AED 386.38 a week and don't spend it.**

Spendable cash of AED 156.80, plus AED 7,914.88 of salary landing before the
deadline, less AED 4,263.41 of bills, AED 5,809.30 still owed on the cheque and
the AED 250 buffer, leaves a living pool of **−AED 2,251.03** against a minimum
living need of AED 840. The gap is **AED 3,091.03 across 56 days**.

It closes through income, not cuts — the daily cap is already at the AED 15
survival floor. Everything else in this repo waits behind that one number.

---

## The audit

The new workbook arrived in genuinely good shape: **zero formula errors across
all 4,120 formulas**, and all 22 of its own integrity checks passing. Every
defect below is structural rather than arithmetic — no number was wrong.

To check it at all I had to rebuild my evaluator, because LibreOffice in this
environment ships without its Calc filters and cannot open a spreadsheet. It now
handles lazy `IF` (Excel does not evaluate the branch it does not take, and this
file relies on that), array-carried errors (the `LOOKUP(2,1/(…))` idiom needs
`1/0` to be a value, not an abort), `INDEX`/`MATCH`, `FV`, `SMALL`, `EDATE`,
`WEEKDAY` and date pictures in `TEXT`.

That last one matters: **my first pass reported the month-to-date spending check
as failing.** It was not. My `TEXT()` could not render `"YYYY-MM"`, so the month
keys did not match. The workbook was right and my tool was wrong.

### What was amended

| # | Sheet | Defect | Effect |
|---|---|---|---|
| 1 | Account History | The latest-balance summary sat at A21:D29, *inside* the `$A$7:$A$100` ranges its own `LOOKUP`s scan | 136 circular references. All eight accounts read "No data" — the whole feature was dead. Moved to G5:J14. |
| 2 | Account History | `B7` read "FAB 1001 Current" | A typo for 4001, so that entry matched no account |
| 3 | Account History | `C7`/`C8` held the text "REQUIRES DATA" in a balance column | The lookup counted text as a reading. Blanked; reason moved to the note column. |
| 4 | Account History | Log ended 11 Aug while Accounts was confirmed to 26 Aug | The summary contradicted the live sheet. Added the four confirmed 25–26 Aug readings. |
| 5 | Account History | Change-vs-last-entry formula on some rows, missing on others, including two header rows | Applied uniformly to rows 7–100 and guarded so an empty row stays empty |
| 6 | Investments | Two identical TOTAL rows (12 and 13) | Nothing referenced the second. Removed. |
| 7 | Accounts | `H15` asserted "Must equal AED 4,277.19" against a live AED 6,105.17 | A note left behind by an earlier balance set. Now a formula that states the current total. |
| 8 | Settings | Next-income date used `<=` against the salary day | On payday itself it returned *today*, leaving zero days to income — which drove the safe daily limit to zero on the one day of the month you are paid. Changed to `<`. |
| 9 | Checks & Audit | The household-plus-personal check compared two typed constants with each other | It could never fail, and both had drifted from the live figures (5,939.85 + 1,503.16 against a real 6,028.40 + 1,559.25). Both sides now read the engine. |
| 10 | Checks & Audit | Three MODEL STATUS banners had accumulated, two sitting in the source log's ID column | Which is why the log began at S6 with S1–S5 missing. One banner now; log renumbered S1–S8 with every entry preserved. |
| 11 | Checks & Audit | Three check notes described superseded balance sets | The FAB note added up to 7,183.87 against a live 5,963.32. Rewritten. |
| 12 | MASTER PLAN | Row 11 labelled "TOTAL NET WORTH" but pointed at total *assets* | It does not net off the AED 2,687.36 Tabby debt. Relabelled, with a true net-worth line added (new engine row E59). |

After amendment: **0 circular references, 0 formula errors, 22/22 checks OK.**
An amendment log recording all twelve fixes is written into `Checks & Audit`.

> No rows were ever inserted. `openpyxl` does not rewrite formulas when rows
> shift, so an insert would silently break the stage tables below it — the one
> fix that needed a new row got a new engine row on Settings instead.

## The earlier workbook

### What was repaired

The file arrived with several cells damaged or half-finished. Each fix below is
derived from a value already present elsewhere in the file — nothing was invented.

- **`Inputs!B42`** held AED 715.33 but the cell was typed as a date, so it
  displayed as *15-Dec-1901* (715.33 days after the 1900 epoch). The arithmetic
  downstream was already right; only the display was broken. `D42` held the due
  date as a raw serial. Both are now correctly typed.
- **`Rent Closure!E20`**, **`Recent Ledger!A43`** and **`Sources & Audit!E33:E44`**
  held dates as raw serial numbers (46316, 46246, 46259.48…). All converted.
- **`Sources & Audit` rows 25–32** had drifted one or two columns out of
  alignment with their own header, and IDs S17–S21 were missing. Realigned in
  place with every original fact preserved and the sequence closed to S1–S24.
- **`Inputs!A44`** and **`Checks!A18`** were merged callouts whose sentences had
  been cut off mid-thought. Both are now live formulas that compute their own
  numbers with `TEXT()`, so they can never go stale.
- **`Dashboard!H6`** and **`H8`** were hardcoded (705.76 and 5,759.55). Both are
  now formulas: DEWA less loose cash, and rent cheque less protected rent.

### One arithmetic error corrected

Several notes in the original quoted **AED 651.19** as the extra cash needed
before 15 September. The correct sum is **AED 651.59** — the AED 189.19
bills-and-survival gap plus AED 462.40 of SIP funding. `Inputs!B53` now computes
it, and `Checks` asserts it.

### What was added

Eight new sheets, and extensions to three existing ones:

- **FX & Assumptions** — every lever the workbook cannot prove, in blue on
  yellow, each with its basis written beside it. Nothing else in the file
  hardcodes a rate or a return.
- **Budget** — plan against the actual ledger, scaled to a monthly run rate so
  a 23-day sample is comparable with a monthly plan.
- **Spend Analysis** — category, personal/household split, top merchants and
  the burn rate, all from the confirmed ledger.
- **Net Worth** — assets and liabilities consolidated into dirhams.
- **Wealth Plan** — a 20-year projection, a sensitivity table pricing each
  lever, and a financial-independence calculation.
- **Goals** — three stages, with progress computed live from the rest of the file.
- **Debt Plan** — a dated route to zero, and the arithmetic showing why the
  aggressive route is worse.
- **AI Advisor** — recommendations wired to live conditions, so an item closes
  when the data says it is closed. Plus a weighted health score.
- **Recent Ledger** gained columns I–K (budget category, spend flag, split) so
  every downstream total is a `SUMIFS`, not a manual sort.
- **Investments** gained dirham values, weights, an allocation table against
  target, and risk controls.
- **Checks** gained 18 new integrity checks; all 30 now pass.

### Verifying it yourself

Open `Checks`. The last row reads **ALL OK** when all 30 checks pass. Among them:
the ledger's final balance must equal the confirmed FAB 4001 balance; total
payments on the debt schedule must equal the exposure; and the closed-form
future value must match the year-by-year projection to the cent.

```bash
cd wealth-os/tools
python3 validate.py ../Johnnys_Edge_Lifetime_Finance.xlsx   # references, cycles, functions
```

The build itself is reproducible — `a_repair.py` through `f_finalize.py`, run in
order against the original file.

> **A note on recalculation.** The usual tool for this (`recalc.py`, which drives
> LibreOffice) cannot run in the environment this was built in: that LibreOffice
> install ships without its Calc filters, so it cannot open a spreadsheet at all.
> `evaluate.py` replaces it — a small evaluator covering the exact formula subset
> this workbook uses. It computed all 1,035 formulas with zero errors, and its
> results are embedded as cached values. `fullCalcOnLoad` is also set, so Excel
> and Google Sheets recalculate everything from scratch the moment the file opens.

---

## The app

Open `index.html`, or serve the folder and add it to a phone home screen. It
works offline after the first load, and everything stays on the device.

### Seven tabs, fourteen sub-pages

| Tab | What it does |
|---|---|
| **Home** | Net worth, health score, today against the daily cap, runway, the 90-day forecast, top actions |
| **Money** | The full ledger — add, edit, filter, search, quick-add; category and merchant breakdowns |
| **Budget** | Plan against actual run rate, by group, with health ratios |
| **Invest** | Holdings, allocation against target, risk controls |
| **Plan** | Net worth statement, 20-year projection, lever sensitivity, independence, goals |
| **Advisor** | 24 live rules ranked by monthly-equivalent impact, with the reasoning |
| **More** | A hub into everything below |

Plus two pages the new workbook made necessary:

| Page | What it does |
|---|---|
| **The rent gap** | The workbook's headline arithmetic, line for line — spendable cash, inflows, commitments, the vault, the buffer, the living pool, the gap, and the weekly earning target. Reproduced exactly so the two can never disagree. |
| **Family & future** | The grocery bill transferring on 15 Sep, what her EBP actually covers on a delivery, the newborn year insurance does not touch, the six-month emergency target sized on the household that *will* exist, an honest home-purchase reality check, and the four modelled paths to a crore. |

Sub-pages: **The rent gap · Cashflow forecast · Spending calendar · Recurring &
subscriptions · Import · Income · Rules · Reports · SIP schedule · Net worth
history · Debt plan · Accounts & pots · Family & future · Assumptions & data ·
Search · How this works.**

### The cashflow forecast

The piece that matters most. It walks day by day from today to a horizon you
choose, applying dated income, obligations, debt payments, SIP instalments,
confirmed recurring bills and a daily living burn — then tells you the day the
money runs out, before it does.

Three things make it honest rather than merely pretty:

- **It starts from safe-to-spend, not the bank balance.** Money in a pot is
  already promised.
- **A pot earmarked for a bill is netted off that bill.** Otherwise the same
  dirham is punished twice — once by being held back, once by being spent.
- **It refuses to count the same money twice.** A Tabby obligation that is also
  a scheduled debt payment appears once. A dated salary estimate overrides the
  recurring assumption for that month, so AED 2,906 is treated as the
  *remainder* of the August cycle rather than an extra AED 7,915 on top of it.

On the current position it reads: negative from **10 September**, bottoming at
**−AED 6,155 on 25 October** — the three days between the rent cheque clearing
and the next salary.

The forecast reads tighter than the rent-gap page on purpose. The workbook marks
the AED 1,314.50 Tabby minimum as settled because autopay is already set, so it
sits outside committed outflows — but the cash does not leave until 3 September,
and the day-by-day forecast charges it on that date. Treat the rent-gap page as
the funding arithmetic and the forecast as the bank balance.

### Import: paste what the bank actually sends you

Paste one bank SMS or fifty. The parser pulls the amount, merchant, card, date
and closing balance, matches the card digits to a real account, and
auto-categorises through the rules engine. Rows that already exist are flagged
as duplicates and unticked for you. Nothing is written until you confirm.

CSV import works the same way and matches column names loosely, so most bank
exports load unedited.

A message that reports a closing balance is treated as a **confirmation** —
it sets the balance rather than adjusting it, so an import can never
double-count.

### How it handles money

- **A balance you confirm always wins.** It sets truth absolutely; everything
  else adjusts from there.
- **A transaction you record moves its account.** Seeded August history carries
  no account link, because those balances are already stated *after* those
  transactions.
- **Settling a debt does not make you richer.** Balance down, liability down,
  net worth flat. If a payment eats into pot money, the app says so.
- **Paying an earmarked bill draws its pot down too.**
- **Expected money is never cash.** A salary you have not received is an event
  in the forecast, never a balance.

### Everything else

- **Recurring detection** — two or more charges at a regular interval with a
  stable amount become a proposed subscription; you confirm, and it enters the
  forecast. Merchants that repeat without a rhythm are shown separately as
  habits rather than contracts.
- **Rules engine** — correct a category by hand and a rule is written for you,
  but only when the guess was actually wrong, and only once per merchant.
- **Daily cap tracker** — today, this week, no-spend streak, and a calendar
  heatmap with drill-down into any day.
- **Pots** — virtual envelopes inside real accounts, with payday allocation.
- **Income** — sources, expected dates, receipts, concentration.
- **SIP schedule** — per-fund plans, next dates, contribution log that updates
  cost basis so new money never shows up as a gain.
- **Debt** — multiple debts, avalanche against snowball, payoff dates and cost.
- **Net worth history** — a snapshot a day, charted, with change attribution.
- **Reports** — month by month, printable, with prior-month deltas.
- **Undo** — whole-state, 25 deep, on everything including a bulk import.
- **Search** — across transactions, obligations, goals, holdings and budget.
- **Keyboard** — `/` search, `N` new transaction, `Esc` close, `Ctrl+Z` undo.

### Code layout

No build step, no dependencies. Eleven plain scripts loaded in order:

| File | Role |
|---|---|
| `js/util.js` | Formatting, dates, CSV, small maths |
| `js/data.js` | Seed data transcribed from the workbook |
| `js/store.js` | State, persistence, v1→v2 migration, undo |
| `js/engine.js` | `metrics()`, `forecast()`, recurring detection, debt strategies, reports, rules |
| `js/advisor.js` | The 24 live recommendation rules |
| `js/charts.js` | Inline SVG: donut, ring, area, forecast, heatmap, columns, sparkline |
| `js/importers.js` | Bank-SMS and CSV parsing, duplicate detection |
| `js/ui.js` | Router, modals, toasts, shared render helpers |
| `js/views.js` | All 21 page renderers |
| `js/modals.js` | Every write to state, each one undoable |
| `js/app.js` | Event delegation and boot |

`metrics()` is the single source of truth: every view reads from it, so no two
screens can disagree about the position.

### Verified

- Every engine figure matches the workbook to the dirham — net worth, spend,
  burn rate, blended return, the 20-year projection.
- All 21 pages render with zero console errors.
- No horizontal overflow at 360, 430, 768 and 1280 px.
- Import, undo, duplicate detection, debt payment, pot accounting, search,
  keyboard shortcuts and reload persistence all pass an automated browser suite.

## The headline finding

Net worth is **AED 16,053**, of which **AED 12,635** compounds. The balance sheet
is not the problem — the calendar is.

The confirmed ledger shows day-to-day living running at **AED 95.76 a day**
against a damage-control cap of **AED 5**. Scaled to a full month that is
AED 6,018 against a salary of AED 7,915, and the planned budget — which includes
a proper monthly rent accrual — does not balance by **AED 882 a month**.

The day-by-day forecast puts a date on it. Starting from AED 7.27 of genuinely
spendable cash, and with every pot, bill, debt payment and SIP accounted for
exactly once, the balance goes **negative on 5 September** and bottoms out at
**−AED 5,260 on 25 October** — the gap between the rent cheque clearing on the
22nd and the salary arriving on the 26th.

Four things, in order:

1. Hold the rent ring-fence. AED 5,990.45 in FAB 4002 is not spendable.
2. Close the September gap of AED 651.59 by earning it, or by pausing the SIP —
   decided on 8 September against real balances, not on estimates.
3. Let the Tabby minimums run to zero by 3 November without ever paying a fee.
   Paying the full August statement early costs AED 657.53 more and saves nothing.
4. Start accruing rent monthly, so October 2027 is a transfer instead of a crisis.

Then, and only then, raise the SIP.

Switch the forecast to **budget burn** on the cashflow page to see what changes
if the AED 5 cap is actually kept — that single toggle is the clearest argument
in the whole app.

---

## Two assumptions to confirm

Both are flagged in the workbook and in the app, because the model leans on them:

- **Rent cheques per year is set to 4.** The lease schedule in the source file
  shows one cheque of AED 11,750 due 22 Oct 2026 but not the cadence. This drives
  the monthly rent accrual, the essentials ratio and the emergency-fund target.
- **AED/INR is 0.0385333**, derived from the last confirmed transfer
  (AED 462.40 funded INR 12,000 on 10 Aug 2026). Refresh it from the next receipt.


---

## Two figures the app deliberately keeps apart

**Total assets — AED 18,910.50.** Dirham cash of AED 6,105.17 plus investments of
AED 12,805.33 (mutual funds AED 9,437.48, Amana AED 3,176.05, Binance AED 191.80).
This is the workbook's headline and the app matches it to the fils.

**Net worth — AED 16,223.14.** The same figure with the AED 2,687.36 of Tabby
exposure netted off. The workbook headlines the gross number; the app shows both,
because "what you own" and "what you'd have if you settled up" are different
questions.

The **ICICI rupee account (INR 12,388.51 ≈ AED 477)** is in neither total. It is
money in transit: a remittance that funds the SIP and leaves again on the 10th.
Counting it as household cash would overstate what you can spend; counting it as
an investment would double-count the units it is about to buy.

---

## What changed in this pass

- The workbook was audited (4,120 formulas, zero errors) and amended (twelve
  structural fixes, including 136 circular references that had killed an entire
  sheet's headline feature).
- The app was re-seeded from it: the 26 August balances, the Binance sleeve, the
  AED 15 daily floor and AED 250 buffer, the confirmed quarterly rent cadence,
  the corrected Tabby schedule, and the partner's income change.
- Two pages were added — the rent gap and family planning — and the advisor
  gained rules for the grocery transfer, the HR maternity call, and the SIP
  pause priced against the gap.
- **The rent cheque cadence is now confirmed: four cheques a year.** That was the
  open question from the last pass, and it is settled.

## Still open

- **The couple's trip has no date.** Setting one activates the countdown and the
  weekly saving figure.
- **India property has no city.** Prices vary enormously between cities, so there
  is no honest number to show until one is chosen.
- **Confirm with HR that maternity is not excluded** on her specific EBP tier,
  even though coverage is active with no waiting period. Five minutes; worth
  thousands.
- **Get the real grocery figure** once it firms up. AED 1,500 is the midpoint of
  a stated "under AED 2,000" and it lands inside the rent window.
