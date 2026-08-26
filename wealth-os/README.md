# Wealth OS — Johnny's Edge

Budgeting, expense tracking, investments, debt and an AI advisor in one place,
plus the workbook the whole thing is built on.

Two deliverables live here and they agree with each other to the dirham:

| | What it is |
|---|---|
| `Johnnys_Edge_Lifetime_Finance.xlsx` | The workbook: 17 sheets, 1,035 formulas, 30 integrity checks |
| `index.html` + `app.js` + `styles.css` | The app: an offline-capable PWA seeded from that workbook |

Everything is stated as of **25 August 2026**, the date of the last confirmed
balance in the source file.

---

## The workbook

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
works offline after the first load.

| Tab | What it does |
|---|---|
| **Home** | Net worth, health score, cash position, the next ninety days, top actions |
| **Money** | The full ledger — add, edit, filter, search; category and merchant breakdowns |
| **Budget** | Plan against actual run rate, by group, with health ratios |
| **Invest** | Holdings, allocation against target, risk controls |
| **Plan** | Net worth statement, 20-year projection, lever sensitivity, independence, goals |
| **Advisor** | Live recommendations ranked by monthly-equivalent impact, with the reasoning |
| **More** | Debt schedule, obligations, account balances, every assumption, export/import |

### How it handles money

- **A balance you confirm always wins.** Updating an account from a bank message
  sets the balance absolutely rather than adjusting it, so nothing double-counts.
- **A transaction you record moves its account.** New entries you add here reduce
  the balance they were paid from. The seeded August history carries no account
  link, because those balances are already stated *after* those transactions.
- **Settling a debt does not make you richer.** Marking a Tabby payment paid
  reduces both the balance and what you owe, so net worth stays flat.
- **Expected money is never cash.** The AED 2,906 salary expected on 26 August
  is modelled as an inflow, never as a balance.

### Data

Everything lives in `localStorage` on the device. Nothing is uploaded anywhere.
Export and import JSON from the More tab; **Reset to workbook** returns every
figure to the seeded position.

---

## The headline finding

Net worth is **AED 16,053**, of which **AED 12,635** compounds. The balance sheet
is not the problem — the calendar is.

The confirmed ledger shows day-to-day living running at **AED 95.76 a day**
against a damage-control cap of **AED 5**. Scaled to a full month that is
AED 6,018 against a salary of AED 7,915, and the planned budget — which includes
a proper monthly rent accrual — does not balance by **AED 882 a month**.

Four things, in order:

1. Hold the rent ring-fence. AED 5,990.45 in FAB 4002 is not spendable.
2. Close the September gap of AED 651.59 by earning it, or by pausing the SIP —
   decided on 8 September against real balances, not on estimates.
3. Let the Tabby minimums run to zero by 3 November without ever paying a fee.
   Paying the full August statement early costs AED 657.53 more and saves nothing.
4. Start accruing rent monthly, so October 2027 is a transfer instead of a crisis.

Then, and only then, raise the SIP.

---

## Two assumptions to confirm

Both are flagged in the workbook and in the app, because the model leans on them:

- **Rent cheques per year is set to 4.** The lease schedule in the source file
  shows one cheque of AED 11,750 due 22 Oct 2026 but not the cadence. This drives
  the monthly rent accrual, the essentials ratio and the emergency-fund target.
- **AED/INR is 0.0385333**, derived from the last confirmed transfer
  (AED 462.40 funded INR 12,000 on 10 Aug 2026). Refresh it from the next receipt.
