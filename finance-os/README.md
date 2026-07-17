# Finance OS — Private CFO (v1)

An AI-powered **Financial Operating System** for one owner: Johnson. Personal wealth +
Mendtech cash flow in a single command centre. Not a budgeting app, not accounting, not ERP.

Open it and within 30 seconds you see: net worth, investment performance, monthly
spending, available cash, business cash position, upcoming risks, AI recommendations
and goal progress.

## The most important rule

**No background sync — ever.** No polling, no scheduled jobs, no hidden API calls.
Data is re-evaluated only when you press **Refresh** (or ask the CFO). Refresh:

1. Recalculates every metric from your data
2. Compares against the previous snapshot
3. Stores a new net-worth snapshot (powers the history chart)
4. Regenerates AI insights, risks and the Executive Brief
5. Recomputes the 0–100 Financial Health Score

## What's inside

| Tab | What it does |
|---|---|
| **Home** | Net worth hero + history chart, cash / investments / spending / business tiles, health score, AI insights & risks, goals, accounts & assets |
| **Money** | Monthly income/spend/net, 6-month cash-flow chart, spend-by-category, transaction list, **CSV statement import** with AI auto-categorisation |
| **Invest** | Portfolio value, P/L and return %, allocation donut, best/worst performer, holdings (Binance, Mutual Funds, Amana, Stocks…) |
| **Biz** | Mendtech cash position + runway, received/paid this month, outstanding client payments (overdue flags), upcoming expenses, 30/60/90-day forecast, safe-withdrawal number |
| **CFO** | Conversational AI CFO. Works fully offline with a built-in engine; add a Claude API key (More → Assistant) for open-ended analysis via `claude-opus-4-8` |
| **More** | Theme, API key, learned merchant rules, backup/restore, demo data, erase |

## AI transaction engine

- CSV import auto-detects date / description / amount (or debit + credit) columns
- Every line is auto-categorised (Talabat → Food Delivery, ADNOC → Fuel, DEWA → Utilities…)
- Duplicates are skipped (hash of date + amount + merchant)
- **It learns:** correct a category once and the merchant rule is remembered and applied
  to all future imports (manage rules in More)
- Subscriptions are detected automatically from recurring similar charges

## Data & security

- 100% local: everything lives in this browser's `localStorage` (`mts-finance-os-v1`)
- Nothing is uploaded anywhere; the only network call is the optional Claude API
  request you trigger from the CFO tab (key stored on-device only)
- Read-only by design — no trading, no transfers
- Use **More → Export backup** regularly (JSON file)

## Running it

- Preview: launch config `finance-os` (port 5180), or any static server over the folder
- Install as a PWA from the browser menu (works offline via service worker)
- On release bumps: increase `?v=` on `styles.css` / `app.js` in `index.html`
  **and** `CACHE_NAME` + asset versions in `service-worker.js` together

## Next phase (when ready)

- Zoho Books / Wio auto-import on Refresh (needs a small relay because of CORS —
  same pattern as the Field Ops Zoho pipe)
- Binance read-only API + MF statement (CAS PDF) parsing
- Port to Next.js + Supabase + Clerk when Node tooling is available
