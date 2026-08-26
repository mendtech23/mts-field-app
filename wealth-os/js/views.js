/* ============================================================
   Wealth OS — views
   Every renderer takes no arguments and reads from `metrics()`, so a view
   can never show a figure another view disagrees with.
   ============================================================ */
"use strict";

/* ================================================================ HOME == */
function renderHome() {
  const m = metrics();
  const fc = forecast(state, m);
  const recs = advice(m).filter((r) => r.open && !r.dismissed).slice(0, 4);
  const cap = m.A.dailyCap;
  const capPct = clamp((m.todaySpend / Math.max(cap, 1)) * 100, 0, 100);
  const nwSeries = m.snaps.map((s) => s.netWorth);

  return `
    <div class="card hero">
      <div class="hero-label">Net worth</div>
      <div class="hero-value">${money(m.netWorth)}</div>
      <div class="hero-sub">
        ${money(m.totalAssets)} of assets less ${money(m.debtOutstanding)} of debt ·
        <span class="muted">${money(m.invested)} of it compounds</span>
        ${m.nwChange ? ` · <span class="${m.nwChange >= 0 ? "num-pos" : "num-neg"}">${signMoney(m.nwChange)} since last check</span>` : ""}
      </div>
      <div class="hero-grid">
        ${ring(m.health, 92, m.grade)}
        <div class="hero-bars">
          ${m.comp.map((c) => `
            <div class="hero-bar">
              <div class="hero-bar-top"><span>${esc(c.key)}</span><span class="mono">${c.score.toFixed(0)}</span></div>
              <div class="bar ${c.score >= 70 ? "good" : c.score >= 40 ? "warn" : "bad"}">
                <i style="width:${c.score.toFixed(0)}%"></i></div>
            </div>`).join("")}
        </div>
      </div>
    </div>

    <div class="card ${m.todaySpend > cap ? "edge-bad" : "edge-good"}">
      <div class="card-head">
        <div><h2>Today</h2><div class="sub">${longDate(todayISO())} · cap ${money(cap)} a day</div></div>
        ${linkBtn("Calendar", "calendar")}
      </div>
      <div class="today-row">
        <div>
          <div class="today-value ${m.todaySpend > cap ? "num-neg" : "num-pos"}">${money(m.todaySpend)}</div>
          <div class="muted" style="font-size:12px">spent today</div>
        </div>
        <div>
          <div class="today-value">${money(m.weekSpend)}</div>
          <div class="muted" style="font-size:12px">this week of ${money(m.A.weeklyCap)}</div>
        </div>
        <div>
          <div class="today-value">${m.noSpendStreak}</div>
          <div class="muted" style="font-size:12px">no-spend day${m.noSpendStreak === 1 ? "" : "s"} in a row</div>
        </div>
      </div>
      <div class="bar ${m.todaySpend > cap ? "bad" : "good"}" style="margin-top:10px">
        <i style="width:${capPct.toFixed(0)}%"></i></div>
      <div class="note ${m.dailyBurn > cap ? "bad" : "good"}">
        Your confirmed average is <strong>${money(m.dailyBurn)} a day</strong> on day-to-day living.
        At that pace a month costs ${money(m.monthlyRunRate)} against a salary of ${money(m.income)}.
      </div>
    </div>

    <div class="section-title">The next ninety days</div>
    ${statBlock([
      { k: "Safe to spend", v: money(m.safeToSpend), tone: m.safeToSpend < 500 ? "bad" : "",
        n: "after every pot is honoured", goto: "accounts" },
      { k: "Runway", v: m.overdrawn ? "overdrawn" : Number.isFinite(m.runwayDays) ? m.runwayDays + " days" : "—",
        tone: m.overdrawn || m.runwayDays < 14 ? "bad" : m.runwayDays < 30 ? "warn" : "good",
        n: m.overdrawn ? "already inside pot money" : "at the current burn", goto: "flow" },
      { k: "Rent still to fund", v: money(m.rentToFund), tone: m.rentToFund > 0 ? "bad" : "good",
        n: `${daysUntil("2026-10-21")} days to 21 Oct` },
      { k: "Debt outstanding", v: money(m.debtOutstanding), tone: m.debtOutstanding > 0 ? "warn" : "good",
        n: "Tabby, frozen", goto: "debt" },
    ])}

    <div class="card ${fc.firstNegative ? "edge-bad" : ""}">
      <div class="card-head">
        <div><h2>Cashflow forecast</h2>
          <div class="sub">${fc.days} days from today · ${fc.burnMode === "plan" ? "budget" : "actual"} burn rate</div></div>
        ${linkBtn("Detail", "flow")}
      </div>
      ${forecastChart(fc.series)}
      ${statBlock([
        { k: "Lowest point", v: money(fc.minBalance), tone: fc.minBalance < 0 ? "bad" : fc.minBalance < 500 ? "warn" : "good",
          n: longDate(fc.minDate) },
        { k: fc.firstNegative ? "Goes negative" : "Stays positive",
          v: fc.firstNegative ? shortDate(fc.firstNegative) : "✓",
          tone: fc.firstNegative ? "bad" : "good",
          n: fc.firstNegative ? relativeDays(fc.daysUntilNegative) : `for all ${fc.days} days` },
        { k: "Money in", v: money0(fc.totalIn), n: "expected, not banked" },
        { k: "Money out", v: money0(fc.totalOut + fc.burnTotal), n: "bills, debt and living" },
      ])}
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>What to do next</h2><div class="sub">Live from the advisor · ${recs.length} shown</div></div>
        ${linkBtn("All", "advisor")}
      </div>
      ${recs.length ? recs.map((r) => `
        <div class="row tap" data-goto="advisor">
          <div class="avatar p${r.priority}">${r.priority}</div>
          <div class="row-main">
            <div class="row-title wrap">${esc(r.title)}</div>
            <div class="row-sub">${esc(r.group)} · ${esc(r.status)} · by ${shortDate(r.by)}</div>
          </div>
          <div class="row-val">${r.impact > 0 ? money0(r.impact) : "—"}<span class="small">${esc(impactUnit(r))}</span></div>
        </div>`).join("") : emptyState("Nothing open. That is a first — keep it that way.")}
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Where the money went</h2>
          <div class="sub">${longDate(m.firstDate)} – ${longDate(m.lastDate)} · ${m.days} days</div></div>
        ${pill(money(m.totalSpend))}
      </div>
      <div class="donut-wrap">
        ${donut(m.categories.slice(0, 7).map((c) => ({ label: c.cat, value: c.total, color: CAT_COLOR[c.cat] || "var(--s1)" })))}
        <div class="legend">
          ${m.categories.slice(0, 7).map((c) => `
            <div class="li"><span class="sw" style="background:${CAT_COLOR[c.cat] || "var(--s1)"}"></span>
              <span style="flex:1">${esc(c.cat)}</span>
              <span class="mono muted">${money(c.total)}</span></div>`).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Where this ends up</h2>
          <div class="sub">${m.A.horizonYears} years at ${pct(m.blended)}, ${money(m.monthly)}/month rising ${pct(m.A.sipStepUp, 0)} a year</div></div>
        ${linkBtn("Plan", "plan")}
      </div>
      ${areaChart(m.projection.map((p) => ({ label: String(p.calendar), y: p.closing })))}
      ${statBlock([
        { k: "At horizon", v: compact(m.projection[m.projection.length - 1].closing), n: "nominal" },
        { k: "Today's money", v: compact(m.projection[m.projection.length - 1].realClosing), n: "after inflation" },
        { k: "You put in", v: compact(m.projection[m.projection.length - 1].cumulative), n: "contributions" },
      ])}
      ${nwSeries.length > 2 ? `<div style="margin-top:12px;display:flex;align-items:center;gap:10px">
        ${sparkline(nwSeries)}<span class="muted" style="font-size:12px">net worth, last ${nwSeries.length} checks</span>
      </div>` : ""}
    </div>`;
}

/* =============================================================== MONEY == */
function renderMoney() {
  const m = metrics();
  const f = state._filter || {};
  const months = [...new Set(state.tx.map((t) => monthKey(t.date)))].sort().reverse();

  let rows = state.tx.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (f.q) rows = rows.filter((t) => (t.merchant + " " + t.note).toLowerCase().includes(f.q.toLowerCase()));
  if (f.cat) rows = rows.filter((t) => t.category === f.cat);
  if (f.split) rows = rows.filter((t) => t.split === f.split);
  if (f.month) rows = rows.filter((t) => monthKey(t.date) === f.month);
  if (f.account) rows = rows.filter((t) => t.accountId === f.account);
  const shown = sum(rows.filter((t) => t.counts), (t) => t.amount);

  const frequent = m.merchants.slice(0, 6);

  return `
    ${statBlock([
      { k: "Confirmed spending", v: money(m.totalSpend), n: `${m.days} days` },
      { k: "Per day", v: money(m.totalSpend / m.days), n: "all categories" },
      { k: "Living per day", v: money(m.dailyBurn), tone: m.dailyBurn > m.A.dailyCap ? "bad" : "good",
        n: `cap ${money(m.A.dailyCap)}` },
      { k: "Monthly run rate", v: money(m.monthlyRunRate), tone: m.monthlyRunRate > m.income ? "bad" : "good",
        n: `salary ${money0(m.income)}` },
    ])}

    <div class="quick-grid">
      <button class="quick" data-goto="import"><span class="qi">⤓</span>Import</button>
      <button class="quick" data-goto="recurring"><span class="qi">↻</span>Recurring</button>
      <button class="quick" data-goto="calendar"><span class="qi">▦</span>Calendar</button>
      <button class="quick" data-goto="income"><span class="qi">↑</span>Income</button>
      <button class="quick" data-goto="rules"><span class="qi">⚑</span>Rules</button>
      <button class="quick" data-goto="reports"><span class="qi">◔</span>Reports</button>
    </div>

    ${frequent.length ? card("Quick add", "One tap for the merchants you use most — amount prefilled from last time", `
      <div class="chips">
        ${frequent.map((x) => `<button class="chip" data-quickadd="${esc(x.merchant)}"
          data-amount="${x.avg.toFixed(2)}">${esc(x.merchant)} · ${money0(x.avg)}</button>`).join("")}
      </div>`) : ""}

    <div class="card">
      <div class="card-head">
        <div><h2>Transactions</h2><div class="sub">${rows.length} shown · ${money(shown)} counted as spending</div></div>
        <button class="btn btn-sm btn-accent" id="mAdd">＋ Add</button>
      </div>
      <div class="filters">
        <input id="fq" type="search" placeholder="Search merchant or note" value="${esc(f.q || "")}" />
        <select id="fcat"><option value="">All categories</option>
          ${CATEGORIES.map((c) => `<option ${f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <select id="fsplit"><option value="">Personal + household</option>
          <option ${f.split === "Personal" ? "selected" : ""}>Personal</option>
          <option ${f.split === "Household" ? "selected" : ""}>Household</option></select>
        <select id="fmonth"><option value="">All months</option>
          ${months.map((k) => `<option value="${k}" ${f.month === k ? "selected" : ""}>${monthLabel(k)}</option>`).join("")}</select>
      </div>
      ${(f.q || f.cat || f.split || f.month) ? `<button class="btn btn-sm btn-ghost" id="fClear">Clear filters</button>` : ""}
    </div>

    <div class="card flush">
      ${rows.length ? rows.slice(0, 300).map(txRow).join("")
                    : emptyState("No transactions match those filters.")}
      ${rows.length > 300 ? `<div class="empty">Showing the most recent 300 of ${rows.length}. Narrow the filters to see more.</div>` : ""}
    </div>

    ${card("Category breakdown", "Personal against household, over the ledger window", `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Category</th><th class="num">Total</th><th class="num">Share</th>
          <th class="num">Personal</th><th class="num">Household</th><th class="num">Per day</th></tr></thead>
        <tbody>${m.categories.map((c) => `<tr class="tap" data-filtercat="${esc(c.cat)}">
          <td>${esc(c.cat)}<div class="muted" style="font-size:11px">${c.count} transactions</div></td>
          <td class="num">${money(c.total)}</td><td class="num">${pct(c.share)}</td>
          <td class="num">${money(c.personal)}</td><td class="num">${money(c.household)}</td>
          <td class="num">${money(c.perDay)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(m.totalSpend)}</td><td class="num">100.0%</td>
          <td class="num">${money(sum(m.categories, (c) => c.personal))}</td>
          <td class="num">${money(sum(m.categories, (c) => c.household))}</td>
          <td class="num">${money(m.totalSpend / m.days)}</td></tr></tfoot>
      </table></div>`)}

    ${card("Top merchants", "Where repetition, not size, does the damage", `
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Merchant</th><th class="num">Total</th><th class="num">Times</th>
          <th class="num">Average</th></tr></thead>
        <tbody>${m.merchants.slice(0, 15).map((x) => `<tr>
          <td>${esc(x.merchant)}</td><td class="num">${money(x.total)}</td>
          <td class="num">${x.count}</td><td class="num">${money(x.avg)}</td></tr>`).join("")}</tbody>
      </table></div>`)}`;
}

function txRow(t) {
  return `<div class="row tap" data-tx="${esc(t.id)}">
    <div class="avatar" style="background:${t.counts ? (CAT_COLOR[t.category] || "var(--surface-3)") : "var(--surface-3)"};
         color:${t.counts ? "#fff" : "var(--muted)"}">${esc((t.merchant || "?").slice(0, 1).toUpperCase())}</div>
    <div class="row-main">
      <div class="row-title">${esc(t.merchant)}</div>
      <div class="row-sub">${shortDate(t.date)} · ${esc(t.bank)} · ${esc(t.category)}${t.counts ? "" : " · not counted"}</div>
    </div>
    <div class="row-val ${t.counts ? "" : "muted"}">${t.counts ? "−" : ""}${money(t.amount)}
      <span class="small">${esc(t.split)}</span></div>
  </div>`;
}

/* ============================================================== BUDGET == */
function renderBudget() {
  const m = metrics();
  const groups = ["Essential", "Lifestyle", "Debt & Wealth"];
  const gt = (g, k) => sum(m.budget.filter((b) => b.group === g), (b) => b[k]);

  return `
    ${statBlock([
      { k: "Net income", v: money(m.income), n: "monthly baseline" },
      { k: "Planned outflow", v: money(m.totalOutflow), tone: m.totalOutflow > m.income ? "bad" : "good" },
      { k: "Surplus", v: money(m.surplus), tone: m.surplus >= 0 ? "good" : "bad",
        n: m.surplus >= 0 ? "plan balances" : "plan does not balance" },
      { k: "Savings rate", v: pct(m.savingsRate), tone: m.savingsRate >= m.A.targetSavingsRate ? "good" : "warn",
        n: `target ${pct(m.A.targetSavingsRate, 0)}` },
    ])}

    ${m.surplus < 0 ? `<div class="card edge-bad"><div class="note bad">
      The plan spends <strong>${money(Math.abs(m.surplus))}</strong> more than the salary every month. That gap closes
      by cutting lifestyle, dropping a telecom line, or earning more — never by borrowing. Tap any line to change it
      and watch this number move.</div></div>` : ""}

    ${groups.map((g) => `
      <div class="card">
        <div class="card-head">
          <div><h2>${esc(g)}</h2>
            <div class="sub">Plan ${money(gt(g, "plan"))} · run rate ${money(gt(g, "rate"))}</div></div>
          ${pill(gt(g, "rate") > gt(g, "plan") ? "over" : "within", gt(g, "rate") > gt(g, "plan") ? "bad" : "good")}
        </div>
        ${m.budget.filter((b) => b.group === g).map((b) => {
          const t = !b.cat ? "" : b.usage > 1 ? "bad" : b.usage > 0.85 ? "warn" : "good";
          return `<div class="row tap flat" data-budget="${esc(b.id)}">
            <div class="row-main">
              <div class="row-title">${esc(b.line)}</div>
              <div class="row-sub">${esc(b.priority)}${b.cat ? ` · actual ${money(b.actual)} over ${m.days} days` : " · not in the ledger"}</div>
              <div class="bar ${t}" style="margin-top:7px"><i style="width:${clamp(b.usage * 100, 0, 100).toFixed(0)}%"></i></div>
            </div>
            <div class="row-val">${money(b.plan)}<span class="small">${b.cat ? money(b.rate) + " actual" : "planned"}</span></div>
          </div>`;
        }).join("")}
      </div>`).join("")}

    ${card("Health ratios", "Against the benchmarks that decide whether a plan is survivable",
      [["Savings rate", m.savingsRate, m.A.targetSavingsRate, true, "Investing plus emergency top-ups as a share of income."],
       ["Essential ratio", safeDiv(m.essential, m.income), 0.50, false, "Above half of income leaves almost no room to build wealth."],
       ["Lifestyle ratio (plan)", safeDiv(m.lifestyle, m.income), 0.15, false, "Discretionary spending as planned."],
       ["Lifestyle ratio (actual)", safeDiv(m.lifestyleRate, m.income), 0.15, false, "The same ratio on what the ledger shows. This is the honest one."]]
      .map(([label, v, bench, higher, note]) => {
        const ok = higher ? v >= bench : v <= bench;
        return kv(label, `${pct(v)}<br><span class="muted" style="font-weight:500;font-size:11.5px">target ${pct(bench, 0)}</span>`,
                  ok ? "num-pos" : "num-neg", note);
      }).join(""))}`;
}

/* ============================================================== INVEST == */
function renderInvest() {
  const m = metrics();
  const funds = m.holdings.filter((h) => h.cls !== "Broker cash");
  const sipMonthlyAed = sum(state.sips.filter((s) => s.active),
    (s) => toAedWith(m.A)(s.amountNative, s.ccy));

  return `
    <div class="card hero">
      <div class="hero-label">Portfolio value</div>
      <div class="hero-value">${money(m.invested)}</div>
      <div class="hero-sub">Cost ${money(m.investedCost)} ·
        <span class="${m.investedGain >= 0 ? "num-pos" : "num-neg"}">${signMoney(m.investedGain)} (${pct(m.investedReturn)})</span>
      </div>
    </div>

    ${statBlock([
      { k: "Blended return", v: pct(m.blended), n: "planning assumption" },
      { k: "Fund-house concentration", v: pct(m.houseConcentration),
        tone: m.houseConcentration > 0.8 ? "bad" : "good", n: m.topHouse[0] },
      { k: "Rupee exposure", v: pct(m.inrExposure), tone: m.inrExposure > 0.85 ? "warn" : "good", n: "unhedged" },
      { k: "Monthly SIP", v: money(sipMonthlyAed), n: "across active plans", goto: "sips" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Holdings</h2><div class="sub">Tap to update a value after a statement</div></div>
        <div class="btn-row">${linkBtn("SIPs", "sips")}<button class="btn btn-sm btn-ghost" id="iAdd">＋</button></div>
      </div>
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Fund</th><th class="num">Value</th><th class="num">Cost</th>
          <th class="num">Gain</th><th class="num">Return</th><th class="num">Weight</th></tr></thead>
        <tbody>${m.holdings.map((h) => {
          const gain = h.aed - h.costAed;
          return `<tr class="tap" data-holding="${esc(h.id)}">
            <td>${esc(h.name)}<div class="muted" style="font-size:11px">${esc(h.house)} · ${esc(h.sip)}</div></td>
            <td class="num">${money(h.aed)}<div class="muted" style="font-size:11px">${esc(h.ccy)} ${fmt(h.value)}</div></td>
            <td class="num">${money(h.costAed)}</td>
            <td class="num ${gain >= 0 ? "num-pos" : "num-neg"}">${signMoney(gain)}</td>
            <td class="num ${gain >= 0 ? "num-pos" : "num-neg"}">${pct(safeDiv(gain, h.costAed))}</td>
            <td class="num">${pct(safeDiv(h.aed, m.invested))}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(m.invested)}</td><td class="num">${money(m.investedCost)}</td>
          <td class="num ${m.investedGain >= 0 ? "num-pos" : "num-neg"}">${signMoney(m.investedGain)}</td>
          <td class="num">${pct(m.investedReturn)}</td><td class="num">100.0%</td></tr></tfoot>
      </table></div>
    </div>

    ${card("Asset allocation", "Actual against target · rebalance with new instalments, never by selling", `
      <div class="donut-wrap">
        ${donut(m.allocation.filter((a) => a.value > 0).map((a, i) => ({
          label: a.cls, value: a.value, color: `var(--s${(i % 8) + 1})` })))}
        <div class="legend">
          ${m.allocation.map((a, i) => `
            <div class="li"><span class="sw" style="background:var(--s${(i % 8) + 1})"></span>
              <span style="flex:1">${esc(a.cls)}</span>
              <span class="mono ${Math.abs(a.drift) <= 0.05 ? "muted" : a.drift > 0 ? "num-neg" : "num-pos"}">
                ${pct(a.actual)} vs ${pct(a.target, 0)}</span></div>`).join("")}
        </div>
      </div>
      <div class="note">Drift beyond five points is worth acting on. The cheapest correction is to point the next
        SIP instalment at the underweight sleeve — selling costs exit load and a capital-gains event for nothing.</div>`)}

    ${card("Risk controls", "The structural risks, which matter more than last month's return",
      [["Single fund house", m.houseConcentration, 0.80,
        `${pct(m.houseConcentration)} sits with ${m.topHouse[0]}. Market risk is diversified; manager and operational risk is not.`],
       ["Largest single fund", m.largestFund, 0.35, "No one fund should dominate the portfolio."],
       ["Small and mid cap", safeDiv(
          (m.allocation.find((a) => a.cls === "Indian small cap") || { value: 0 }).value
          + (m.allocation.find((a) => a.cls === "Indian mid cap") || { value: 0 }).value, m.invested), 0.30,
        "The volatile end. Fine at this size for a long horizon; painful if it has to be sold early."],
       ["Rupee exposure", m.inrExposure, 0.85,
        "Almost everything is denominated in rupees while every liability is in dirhams — a genuine, unhedged mismatch."]]
      .map(([label, v, limit, note]) =>
        kv(label, `${pct(v)}<br><span class="muted" style="font-weight:500;font-size:11.5px">limit ${pct(limit, 0)}</span>`,
           v <= limit ? "num-pos" : "num-neg", note)).join(""))}

    ${card("Fund detail", "Units and NAV at the last statement", `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Fund</th><th class="num">Units</th><th class="num">NAV</th><th>SIP</th><th>Evidence</th></tr></thead>
        <tbody>${funds.map((h) => `<tr>
          <td>${esc(h.name)}</td><td class="num">${h.units ? fmt(h.units, 3) : "—"}</td>
          <td class="num">${h.nav ? fmt(h.nav, 4) : "—"}</td><td>${esc(h.sip)}</td>
          <td class="muted" style="font-size:11.5px">${esc(h.note)}</td></tr>`).join("")}</tbody>
      </table></div>`)}`;
}

/* ================================================================ PLAN == */
function renderPlan() {
  const m = metrics();
  const A = m.A;
  const last = m.projection[m.projection.length - 1];

  const scen = [
    ["Base plan", m.monthly, A.sipStepUp, m.blended, A.horizonYears],
    ["Add AED 300 a month", m.monthly + 300, A.sipStepUp, m.blended, A.horizonYears],
    ["Step-up 15% not 10%", m.monthly, 0.15, m.blended, A.horizonYears],
    ["No step-up at all", m.monthly, 0, m.blended, A.horizonYears],
    ["Returns 3 points lower", m.monthly, A.sipStepUp, m.blended - 0.03, A.horizonYears],
    ["Pause the SIP for a year", m.monthly, A.sipStepUp, m.blended, A.horizonYears - 1],
  ].map(([label, mo, g, r, n]) => {
    const fv = futureValue(m.invested, mo * 12, r, g, n);
    return { label, mo, g, r, n, fv, real: fv / Math.pow(1 + A.inflation, n) };
  });
  const base = scen[0].fv;
  const goals = goalRows(m);

  return `
    ${card("Net worth statement", "Everything you own, everything you owe, in dirhams",
      kv("Liquid cash", money(m.liquidCash))
      + kv("Investments", money(m.invested))
      + kv("<strong>Total assets</strong>", money(m.totalAssets))
      + kv("Debt", `−${fmt(m.debtOutstanding)}`, "num-neg")
      + `<div class="kv strong-top"><span class="k"><strong>Net worth</strong></span>
          <span class="v">${money(m.netWorth)}</span></div>`
      + kv("Rent still to fund", `−${fmt(m.rentToFund)}`, "num-neg")
      + kv("Needed before 15 Sep", `−${fmt(m.extraCashNeeded)}`, "num-neg")
      + kv("<strong>Free after commitments</strong>",
           money(m.netWorth - m.rentToFund - m.extraCashNeeded),
           m.netWorth - m.rentToFund - m.extraCashNeeded >= 0 ? "" : "num-neg")
      + `<div class="note">Net worth is the scoreboard; the budget is the game. A disciplined month shows up here as
        a higher number even when the current account looks empty, because units bought outlast cash spent.</div>`,
      linkBtn("History", "history"))}

    ${statBlock([
      { k: "Emergency cover", v: m.emergencyCover.toFixed(2) + " mo",
        tone: m.emergencyCover >= 3 ? "good" : "bad", n: `target ${A.emergencyMonths} months` },
      { k: "Liquidity", v: m.liquidityMonths.toFixed(2) + " mo",
        tone: m.liquidityMonths >= 1 ? "good" : "bad", n: "free cash vs essentials" },
      { k: "Debt to assets", v: pct(m.debtToAssets), tone: m.debtToAssets <= 0.2 ? "good" : "warn" },
      { k: "Invested share", v: pct(safeDiv(m.invested, m.totalAssets)), n: "of total assets" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Wealth projection</h2>
          <div class="sub">${money(m.monthly)}/month rising ${pct(A.sipStepUp, 0)} a year at ${pct(m.blended)}</div></div>
        <button class="btn btn-sm btn-ghost" id="pLevers">Levers</button>
      </div>
      ${areaChart(m.projection.map((p) => ({ label: String(p.calendar), y: p.closing })))}
      <div class="scroll-x" style="margin-top:12px"><table class="tbl wide">
        <thead><tr><th>Year</th><th class="num">Opening</th><th class="num">Added</th><th class="num">Growth</th>
          <th class="num">Closing</th><th class="num">Today's money</th><th>Milestone</th></tr></thead>
        <tbody>${m.projection.map((p, i) => {
          const prev = i ? m.projection[i - 1].closing : m.invested;
          const ms = [1000000, 500000, 250000, 100000, 50000].find((x) => p.closing >= x && prev < x);
          return `<tr><td>${p.calendar}</td><td class="num">${money0(p.opening)}</td>
            <td class="num">${money0(p.contribution)}</td><td class="num">${money0(p.growth)}</td>
            <td class="num">${money0(p.closing)}</td><td class="num muted">${money0(p.realClosing)}</td>
            <td>${ms ? pill(money0(ms), "good") : ""}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td></td><td class="num">${money0(last.cumulative)}</td>
          <td class="num">${money0(last.closing - m.invested - last.cumulative)}</td>
          <td class="num">${money0(last.closing)}</td><td class="num">${money0(last.realClosing)}</td><td></td></tr></tfoot>
      </table></div>
      <div class="note">Growth above contributions is the part the market pays you. If it is smaller than what you
        put in, the missing ingredient is time, not a better fund.</div>
    </div>

    ${card("What each lever is worth", "Same maths, one change at a time, measured at the horizon", `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Scenario</th><th class="num">Monthly</th><th class="num">Step-up</th>
          <th class="num">Return</th><th class="num">At horizon</th><th class="num">vs base</th></tr></thead>
        <tbody>${scen.map((s, i) => `<tr>
          <td>${esc(s.label)}</td><td class="num">${money0(s.mo)}</td><td class="num">${pct(s.g, 0)}</td>
          <td class="num">${pct(s.r)}</td><td class="num">${money0(s.fv)}</td>
          <td class="num ${i === 0 ? "muted" : s.fv - base >= 0 ? "num-pos" : "num-neg"}">
            ${i === 0 ? "—" : (s.fv - base >= 0 ? "+" : "−") + money0(Math.abs(s.fv - base))}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="note good">Compare row two with row five. Adding AED 300 a month — roughly one restaurant week —
        is worth more than three points of return, and it is the only one of the two you control.</div>`)}

    ${card("Financial independence", "The point where capital pays the essentials instead of work",
      kv("Annual essential spending", money(m.annualEssential))
      + kv("Safe withdrawal rate", pct(A.swr, 1))
      + kv("Capital needed", money(m.fiTarget))
      + kv("Years at the base plan", m.yearsToFI ? m.yearsToFI + " years" : "beyond horizon")
      + kv("Projected in today's money", money(last.realClosing))
      + (!m.yearsToFI ? `<div class="note warn">The base plan does not reach independence inside
          ${A.horizonYears} years. The fix is the contribution lever, not a better fund — try the scenarios above.</div>` : ""))}

    ${[1, 2, 3].map((stage) => card(
      ["", "Stage 1 — survive the quarter", "Stage 2 — build the buffer", "Stage 3 — compound"][stage],
      ["", "Nothing later matters until these are done", "The buffer that stops the crisis repeating", "The long game"][stage],
      goals.filter((g) => g.stage === stage).map((g) => `
        <div class="row flat">
          <div class="row-main">
            <div class="row-title wrap">${esc(g.name)}</div>
            <div class="row-sub">${money(g.current)} of ${money(g.target)} · by ${longDate(g.deadline)}</div>
            <div class="bar ${g.progress >= 1 ? "good" : g.progress >= 0.5 ? "warn" : "bad"}" style="margin-top:7px">
              <i style="width:${(g.progress * 100).toFixed(0)}%"></i></div>
            <div class="row-sub wrap" style="margin-top:6px;white-space:normal">${esc(g.note)}</div>
          </div>
          <div class="row-val">${pct(g.progress, 0)}<span class="small">${g.gap > 0 ? money0(g.gap) + " to go" : "done"}</span></div>
        </div>`).join(""))).join("")}`;
}

function goalRows(m) {
  const A = m.A;
  return state.goals.map((g) => {
    let target = g.target;
    if (g.months) target = m.essential * g.months;
    if (g.yearRent) target = A.rentCheque * A.rentChequesPerYear;
    if (g.fiTarget) target = m.fiTarget;
    const current = {
      looseCash: m.looseCash, rentHeld: m.rentHeld, emergency: m.emergency,
      invested: m.invested, netWorth: m.netWorth, debtCleared: m.debtCleared,
    }[g.currentRef] || 0;
    return { ...g, target, current, gap: Math.max(0, target - current),
             progress: target ? clamp(current / target, 0, 1) : 1 };
  });
}

/* ============================================================= ADVISOR == */
function renderAdvisor() {
  const m = metrics();
  const all = advice(m);
  const open = all.filter((r) => r.open && !r.dismissed);
  const closed = all.filter((r) => !r.open || r.dismissed);
  const groups = ["Urgent", "Cashflow", "Spending", "Structure", "Investing"];
  const monthlyImpact = sum(open.filter((r) => r.scale === "month"), (r) => r.impact);

  const item = (r) => `
    <div class="row flat align-top">
      <div class="avatar p${r.priority}">${r.priority}</div>
      <div class="row-main">
        <div class="row-title wrap" style="white-space:normal">${esc(r.title)}</div>
        <div class="pill-row">
          ${pill(r.status, r.open ? (r.priority === 1 ? "bad" : "warn") : "good")}
          ${pill(r.effort + " effort")}
          ${pill("by " + shortDate(r.by))}
          ${r.impact > 0 ? pill(money0(r.impact) + " " + impactUnit(r), "info") : ""}
        </div>
        <div class="row-sub wrap reason">${esc(r.why)}</div>
        <div class="btn-row" style="margin-top:9px">
          <button class="btn btn-sm btn-ghost" data-dismiss="${esc(r.id)}">${r.dismissed ? "Restore" : "Dismiss"}</button>
        </div>
      </div>
    </div>`;

  return `
    <div class="card hero">
      <div class="hero-grid">
        ${ring(m.health, 104, m.grade)}
        <div class="hero-bars">
          <div class="hero-label">Financial health</div>
          <div class="hero-value" style="font-size:26px">${m.health.toFixed(0)} / 100 · ${m.grade}</div>
          <div class="hero-sub">${open.length} open recommendations · ${money0(monthlyImpact)} a month of recurring cost in play</div>
        </div>
      </div>
    </div>

    ${card("The one-paragraph verdict", "Recomputed every time the numbers change",
      `<p class="verdict">${esc(verdict(m))}</p>`, linkBtn("Reports", "reports"))}

    ${card("Score breakdown", "Where the grade comes from", `
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Component</th><th class="num">Score</th><th class="num">Weight</th><th class="num">Weighted</th></tr></thead>
        <tbody>${m.comp.map((c) => `<tr>
          <td>${esc(c.key)}<div class="muted" style="font-size:11.5px">${esc(c.label)}</div></td>
          <td class="num">${c.score.toFixed(1)}</td><td class="num">${pct(c.weight, 0)}</td>
          <td class="num">${(c.score * c.weight).toFixed(1)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num"></td><td class="num">100%</td>
          <td class="num">${m.health.toFixed(1)}</td></tr></tfoot>
      </table></div>`)}

    ${groups.map((g) => {
      const items = open.filter((r) => r.group === g);
      if (!items.length) return "";
      const mo = sum(items.filter((i) => i.scale === "month"), (i) => i.impact);
      return card(g, `${items.length} open${mo ? ` · ${money0(mo)} a month in play` : ""}`,
                  items.map(item).join(""));
    }).join("")}

    ${closed.length ? card("Closed and dismissed", `${closed.length} items the data says are handled`,
      closed.map(item).join("")) : ""}`;
}

/* ================================================================ MORE == */
function renderMore() {
  const m = metrics();
  const due = state.obligations.filter((o) => !o.paid)
    .sort((a, b) => a.due.localeCompare(b.due));
  const soon = due.filter((o) => daysUntil(o.due) <= 30);

  return `
    ${statBlock([
      { k: "Due in 30 days", v: money(sum(soon, (o) => o.amount)), tone: "warn", n: `${soon.length} items` },
      { k: "Debt outstanding", v: money(m.debtOutstanding), tone: m.debtOutstanding ? "warn" : "good", goto: "debt" },
      { k: "Accounts", v: String(state.accounts.length), n: money(m.liquidCash), goto: "accounts" },
      { k: "Transactions", v: String(state.tx.length), n: `${m.days} days covered` },
    ])}

    <div class="hub-grid">
      ${[["debt", "Debt plan", "Route to zero and payoff strategies"],
         ["accounts", "Accounts & pots", "Balances and what each one is promised to"],
         ["flow", "Cashflow forecast", "Day by day to the horizon"],
         ["reports", "Reports", "Month by month, printable"],
         ["recurring", "Recurring", "What renews without asking"],
         ["income", "Income", "Sources, receipts and concentration"],
         ["sips", "SIP schedule", "What buys units, and when"],
         ["history", "Net worth history", "The trend that proves it works"],
         ["rules", "Rules", "How merchants get categorised"],
         ["import", "Import", "Bank messages and CSV"],
         ["search", "Search", "Everything, everywhere"],
         ["settings", "Assumptions & data", "Every lever, export and backup"],
         ["help", "How this works", "The method, in plain words"]]
        .map(([v, t, s]) => `<button class="hub" data-goto="${v}">
          <span class="hub-t">${esc(t)}</span><span class="hub-s">${esc(s)}</span></button>`).join("")}
    </div>

    ${card("Upcoming obligations", "Everything dated, in the order it hits", `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Due</th><th>Item</th><th class="num">Amount</th><th>Status</th><th>Priority</th></tr></thead>
        <tbody>${due.map((o) => {
          const d = daysUntil(o.due);
          return `<tr class="tap" data-obligation="${esc(o.id)}">
            <td>${shortDate(o.due)}<div class="muted" style="font-size:11px">${relativeDays(d)}</div></td>
            <td>${esc(o.name)}<div class="muted" style="font-size:11px">${esc(o.note)}</div></td>
            <td class="num">${money(o.amount)}</td>
            <td>${pill(o.status, o.status === "actual" ? "good" : "warn")}</td>
            <td>${esc(o.priority)}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td></td><td>Total outstanding</td>
          <td class="num">${money(sum(due, (o) => o.amount))}</td><td></td><td></td></tr></tfoot>
      </table></div>`)}`;
}

/* ============================================================ SUB-PAGES = */

/* ---------------------------------------------------------- cashflow --- */
function renderFlow() {
  const m = metrics();
  const days = state._flowDays || m.A.forecastDays;
  const mode = state._flowMode || m.A.forecastBurnMode;
  const fc = forecast(state, m, { days, burnMode: mode });
  const withEvents = fc.series.filter((d) => d.events.length);

  return `${subHeader("flow")}
    ${statBlock([
      { k: "Opening", v: money(fc.opening), n: "safe to spend today" },
      { k: "Lowest point", v: money(fc.minBalance),
        tone: fc.minBalance < 0 ? "bad" : fc.minBalance < 500 ? "warn" : "good", n: longDate(fc.minDate) },
      { k: fc.firstNegative ? "Goes negative" : "Stays positive",
        v: fc.firstNegative ? shortDate(fc.firstNegative) : "✓",
        tone: fc.firstNegative ? "bad" : "good",
        n: fc.firstNegative ? relativeDays(fc.daysUntilNegative) : `all ${fc.days} days` },
      { k: "Closing", v: money(fc.closing), tone: fc.closing < 0 ? "bad" : "" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Projected balance</h2>
          <div class="sub">Burn ${money(fc.dailyBurn)} a day · pots excluded, so this is spendable cash only</div></div>
      </div>
      <div class="chips" style="margin-bottom:12px">
        ${[30, 60, 90, 180].map((d) => `<button class="chip ${d === days ? "on" : ""}" data-flowdays="${d}">${d}d</button>`).join("")}
        <button class="chip ${mode === "actual" ? "on" : ""}" data-flowmode="actual">actual burn</button>
        <button class="chip ${mode === "plan" ? "on" : ""}" data-flowmode="plan">budget burn</button>
      </div>
      ${forecastChart(fc.series)}
      ${fc.firstNegative ? `<div class="note bad">
        The balance turns negative on <strong>${longDate(fc.firstNegative)}</strong> and bottoms out at
        <strong>${money(fc.minBalance)}</strong> on ${longDate(fc.minDate)}. Something has to move before then:
        an inflow, a deferred bill, or a lower burn rate. This is the number the rest of the app exists to fix.
      </div>` : `<div class="note good">
        Cash stays positive for the whole window, with the thinnest day at ${money(fc.minBalance)} on
        ${longDate(fc.minDate)}.</div>`}
    </div>

    ${card("What lands, and when", `${fc.events.length} dated events over ${fc.days} days`, `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Date</th><th>Event</th><th class="num">Amount</th><th class="num">Balance after</th></tr></thead>
        <tbody>${withEvents.map((d) => d.events.map((e, i) => `<tr>
          <td>${i === 0 ? shortDate(d.date) : ""}
            ${i === 0 ? `<div class="muted" style="font-size:11px">${relativeDays(diffDays(fc.start, d.date))}</div>` : ""}</td>
          <td>${esc(e.label)}<div class="muted" style="font-size:11px">${esc(e.note || "")}</div></td>
          <td class="num ${e.amount >= 0 ? "num-pos" : "num-neg"}">${signMoney(e.amount)}</td>
          <td class="num ${d.balance < 0 ? "num-neg" : ""}">${i === 0 ? money(d.balance) : ""}</td>
        </tr>`).join("")).join("") || `<tr><td colspan="4" class="empty">Nothing dated in this window</td></tr>`}</tbody>
      </table></div>
      <div class="note">Living costs are spread evenly across every day rather than shown as events — they are the
        slope of the line, not a step in it.</div>`)}`;
}

/* ---------------------------------------------------------- calendar --- */
function renderCalendar() {
  const m = metrics();
  const from = m.firstDate, to = m.lastDate;
  const cap = m.A.dailyCap;
  const dayList = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) dayList.push(d);
  const overCap = dayList.filter((d) => (m.capSeries[d] || 0) > cap).length;
  const zero = dayList.filter((d) => !(m.capSeries[d] || 0)).length;
  const worst = dayList.slice().sort((a, b) => (m.capSeries[b] || 0) - (m.capSeries[a] || 0)).slice(0, 5);

  return `${subHeader("calendar")}
    ${statBlock([
      { k: "Days covered", v: String(dayList.length), n: `${longDate(from)} – ${longDate(to)}` },
      { k: "Days over cap", v: String(overCap), tone: overCap > dayList.length / 2 ? "bad" : "warn",
        n: `of ${dayList.length}` },
      { k: "No-spend days", v: String(zero), tone: zero > 0 ? "good" : "bad", n: "the cheapest kind" },
      { k: "Worst day", v: money(m.capSeries[worst[0]] || 0), tone: "bad", n: longDate(worst[0]) },
    ])}

    ${card("Daily spending", `Colour steps: green within the ${money(cap)} cap, red on the worst days`,
      heatmap(m.capSeries, from, to, cap))}

    ${card("The five most expensive days", "Tap one to see what happened",
      worst.map((d) => `<div class="row tap flat" data-day="${d}">
        <div class="row-main">
          <div class="row-title">${longDate(d)}</div>
          <div class="row-sub">${dayName(d)} · ${state.tx.filter((t) => t.counts && t.date.startsWith(d)).length} transactions</div>
        </div>
        <div class="row-val num-neg">${money(m.capSeries[d] || 0)}
          <span class="small">${((m.capSeries[d] || 0) / cap).toFixed(0)}× cap</span></div>
      </div>`).join(""))}

    ${card("Weekly totals", `Against a ${money(m.A.weeklyCap)} weekly cap`, (() => {
      const weeks = {};
      for (const d of dayList) {
        const k = weekKey(d);
        weeks[k] = (weeks[k] || 0) + (m.capSeries[d] || 0);
      }
      return Object.entries(weeks).sort().map(([k, v]) => `
        <div class="row flat">
          <div class="row-main">
            <div class="row-title">Week of ${longDate(k)}</div>
            ${miniBar(v, Math.max(m.A.weeklyCap, v), v > m.A.weeklyCap ? "bad" : "good")}
          </div>
          <div class="row-val ${v > m.A.weeklyCap ? "num-neg" : "num-pos"}">${money(v)}
            <span class="small">cap ${money0(m.A.weeklyCap)}</span></div>
        </div>`).join("");
    })())}`;
}

/* --------------------------------------------------------- recurring --- */
function renderRecurring() {
  const m = metrics();
  const detected = detectRecurring(state, m);
  const confident = detected.filter((r) => r.confident);
  const frequent = detected.filter((r) => !r.confident && r.hits >= 3);
  const confirmedKeys = new Set(state.recurring.map((r) => r.key));
  const monthlyTotal = sum(confident, (r) => r.monthlyCost);

  const row = (r, isConfident) => `
    <div class="row flat align-top">
      <div class="row-main">
        <div class="row-title">${esc(r.merchant)}</div>
        <div class="pill-row">
          ${pill(r.cadence || `every ~${r.gapDays}d`, isConfident ? "info" : "")}
          ${pill(r.hits + " seen")}
          ${pill(esc(r.category))}
          ${r.stable ? pill("stable amount", "good") : pill("amount varies", "warn")}
          ${confirmedKeys.has(r.key) ? pill("in forecast", "good") : ""}
        </div>
        <div class="row-sub">Last ${longDate(r.lastSeen)}${r.nextDate ? ` · next expected ${longDate(r.nextDate)}` : ""}</div>
      </div>
      <div class="row-val">${money(r.monthlyCost)}<span class="small">a month</span>
        ${r.cadence ? `<button class="btn btn-sm ${confirmedKeys.has(r.key) ? "btn-ghost" : "btn-accent"}"
          data-recurring="${esc(r.key)}" style="margin-top:6px">
          ${confirmedKeys.has(r.key) ? "Remove" : "Add"}</button>` : ""}</div>
    </div>`;

  return `${subHeader("recurring")}
    ${statBlock([
      { k: "Detected", v: String(confident.length), n: "stable cadence and amount" },
      { k: "Monthly cost", v: money(monthlyTotal), tone: "warn", n: "if all of it renews" },
      { k: "A year of it", v: money0(monthlyTotal * 12), tone: "bad", n: "the number that should sting" },
      { k: "In the forecast", v: String(state.recurring.length), n: "confirmed by you" },
    ])}

    ${confident.length ? card("Repeating on a schedule",
      "Two or more charges at a regular interval with a stable amount. Add one and it appears in the cashflow forecast.",
      confident.map((r) => row(r, true)).join("")
      + `<div class="note">Recurring costs are the cheapest thing to cut, because you only decide once. Everything
        here renews whether or not you thought about it this month.</div>`)
      : card("Repeating on a schedule", "Nothing detected yet",
        emptyState("Import more history and patterns appear here automatically. Two charges at a regular interval is enough.",
                   "Import bank messages", 'data-goto="import"'))}

    ${frequent.length ? card("Frequent, but not a subscription",
      "Same merchant, no reliable rhythm — a habit rather than a contract. Worth seeing anyway.",
      frequent.slice(0, 10).map((r) => row(r, false)).join("")) : ""}`;
}

/* ------------------------------------------------------------ import --- */
function renderImport() {
  const pending = state._import || null;

  return `${subHeader("import")}
    ${card("Paste bank messages", "One message or fifty — blank lines between them is enough", `
      <label class="field"><span>Bank SMS or notification text</span>
        <textarea id="smsBlob" rows="7" placeholder="Purchase of AED 13.50 with Debit Card 4001 at ENOC Site 39, Dubai on 25-08-2026 06:36. Avl Bal AED 3.45"></textarea></label>
      <div class="btn-row">
        <button class="btn btn-accent" id="smsParse">Read messages</button>
        <button class="btn btn-ghost" id="smsSample">Use a sample</button>
      </div>
      <div class="note">The parser pulls the amount, merchant, card, date and closing balance. Anything it cannot
        read is left for you to fix in the review step — nothing is saved until you confirm.</div>`)}

    ${card("Import a CSV", "Your own export, or a statement with recognisable headers", `
      <input type="file" id="csvFile" accept=".csv,text/csv" />
      <div class="note">Date and description columns are required; amount, credit, balance, category, split and note
        are used when present. Column names are matched loosely, so most bank exports work unedited.</div>`)}

    ${pending ? card(`Review ${pending.length} row${pending.length === 1 ? "" : "s"}`,
      "Untick anything you do not want. Rows flagged as duplicates are unticked already.", `
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th style="width:34px"></th><th>Date</th><th>Merchant</th>
          <th class="num">Amount</th><th>Category</th><th>Account</th></tr></thead>
        <tbody>${pending.map((c, i) => `<tr class="${c.duplicate ? "dim" : ""}">
          <td><input type="checkbox" class="imp-check" data-i="${i}" ${c.include ? "checked" : ""} /></td>
          <td>${shortDate(c.date)}</td>
          <td>${esc(c.merchant)}${c.duplicate ? `<div class="muted" style="font-size:11px">looks like a duplicate</div>` : ""}
            ${c.balanceAfter != null ? `<div class="muted" style="font-size:11px">balance after ${money(c.balanceAfter)}</div>` : ""}</td>
          <td class="num">${money(c.amount)}</td>
          <td><select class="imp-cat" data-i="${i}">
            ${CATEGORIES.map((x) => `<option ${x === c.category ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></td>
          <td><select class="imp-acc" data-i="${i}">
            <option value="">—</option>
            ${state.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === c.accountId ? "selected" : ""}>${esc(a.name.split(" —")[0])}</option>`).join("")}</select></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn btn-accent" id="impConfirm">Import ticked rows</button>
        <button class="btn btn-ghost" id="impCancel">Discard</button>
      </div>
      <div class="note">Rows linked to an account also move that balance. Leave the account blank for history you
        have already accounted for.</div>`) : ""}

    ${card("Export", "Everything on this device, in a format you can open anywhere", `
      <div class="btn-row">
        <button class="btn" id="expCsv">Transactions CSV</button>
        <button class="btn" id="expJson">Full backup JSON</button>
      </div>
      <div class="note">${state.settings.lastBackup
        ? `Last backup ${longDate(state.settings.lastBackup)}.`
        : "You have never taken a backup. Everything here lives in this browser's storage — one export is the whole insurance policy."}</div>`)}`;
}

/* ------------------------------------------------------------ income --- */
function renderIncome() {
  const m = metrics();
  const rows = state.income.slice().sort((a, b) => b.date.localeCompare(a.date));
  const sources = state.incomeSources;

  return `${subHeader("income")}
    ${statBlock([
      { k: "Received", v: money(m.incomeActual), tone: "good", n: "confirmed in the bank" },
      { k: "Expected", v: money(m.incomeExpected), tone: "warn", n: "not banked yet" },
      { k: "Concentration", v: pct(m.incomeConcentration),
        tone: m.incomeConcentration > 0.75 ? "warn" : "good", n: "from the largest source" },
      { k: "Sources", v: String(sources.filter((s) => s.active).length), n: "active" },
    ])}

    ${card("Sources", "What you expect, and when it lands",
      sources.map((s) => `<div class="row tap flat" data-source="${esc(s.id)}">
        <div class="row-main">
          <div class="row-title">${esc(s.name)}</div>
          <div class="row-sub wrap" style="white-space:normal">${esc(s.note)}</div>
        </div>
        <div class="row-val">${s.expectedMonthly ? money(s.expectedMonthly) : "irregular"}
          <span class="small">${s.dayOfMonth ? "day " + s.dayOfMonth : "no fixed date"}</span></div>
      </div>`).join(""),
      `<button class="btn btn-sm btn-ghost" id="srcAdd">＋</button>`)}

    ${card("Receipts", `${rows.length} recorded`,
      rows.map((i) => `<div class="row tap flat" data-income="${esc(i.id)}">
        <div class="row-main">
          <div class="row-title">${esc(i.name)}</div>
          <div class="row-sub wrap" style="white-space:normal">${shortDate(i.date)} · ${esc(i.note || "")}</div>
        </div>
        <div class="row-val ${i.status === "actual" ? "num-pos" : ""}">${money(i.amount)}
          <span class="small">${esc(i.status)}</span></div>
      </div>`).join(""),
      `<button class="btn btn-sm btn-accent" id="incAdd">＋</button>`)}

    ${card("Why this page matters", "",
      `<p class="verdict">Every other page in this app is about spending less. This one is the only page about
      earning more, and over a decade it matters more than all the others put together. ${pct(m.incomeConcentration, 0)}
      of income comes from a single employer; the ticket dealing proves you can earn outside it, but it is irregular
      and the plan deliberately refuses to count on it. Turning that into something regular is worth more than every
      cut on the advisor list combined.</p>`)}`;
}

/* ------------------------------------------------------------- rules --- */
function renderRules() {
  const learned = state.rules.filter((r) => r.source === "learned");
  const seeded = state.rules.filter((r) => r.source !== "learned");

  const row = (r) => `<div class="row tap flat" data-rule="${esc(r.id)}">
    <div class="row-main">
      <div class="row-title">contains “${esc(r.match)}”</div>
      <div class="row-sub">→ ${esc(r.category)} · ${esc(r.split)}</div>
    </div>
    <div class="row-val">${pill(r.source === "learned" ? "learned" : "built in",
      r.source === "learned" ? "good" : "")}</div>
  </div>`;

  return `${subHeader("rules")}
    ${card("How a merchant gets categorised", "", `
      <ol class="steps">
        <li>Your rules run first, newest to oldest — a correction you made today always beats an older one.</li>
        <li>If no rule matches, built-in merchant patterns make a guess.</li>
        <li>If nothing matches, it lands in Lifestyle &amp; Shopping, which is deliberately the least flattering
            default so miscategorised spending is easy to spot.</li>
      </ol>
      <div class="note">Recategorise a transaction by hand and a rule is written for you — but only when the guess
        was actually wrong, and only once per merchant, so this list stays short enough to read.</div>`)}

    ${card("Your rules", `${learned.length} learned from corrections`,
      learned.length ? learned.map(row).join("")
                     : emptyState("Nothing learned yet. Correct a transaction's category and a rule appears here."),
      `<button class="btn btn-sm btn-ghost" id="ruleAdd">＋</button>`)}

    ${card("Built-in rules", `${seeded.length} shipped with the app`, seeded.map(row).join(""))}`;
}

/* ----------------------------------------------------------- reports --- */
function renderReports() {
  const m = metrics();
  const months = allMonths();
  const sel = state._reportMonth || months[months.length - 1];
  const r = monthReport(sel, state, m);
  const series = months.map((k) => {
    const rep = monthReport(k, state, m);
    return { label: monthLabel(k).slice(0, 3), a: rep.income, b: rep.spend };
  });
  const prev = months[months.indexOf(sel) - 1];
  const prevRep = prev ? monthReport(prev, state, m) : null;
  const delta = (a, b) => b ? ((a - b) / Math.abs(b)) : 0;

  return `${subHeader("reports")}
    <div class="card">
      <div class="card-head">
        <div><h2>${esc(r.label)}</h2><div class="sub">${r.count} transactions over ${r.daysWithSpend} spending days</div></div>
        <button class="btn btn-sm btn-ghost" id="printReport">Print</button>
      </div>
      <div class="chips" style="margin-bottom:12px">
        ${months.map((k) => `<button class="chip ${k === sel ? "on" : ""}" data-report="${k}">${monthLabel(k)}</button>`).join("")}
      </div>
      ${statBlock([
        { k: "Income", v: money(r.income), tone: "good" },
        { k: "Spending", v: money(r.spend), tone: "bad",
          n: prevRep ? `${delta(r.spend, prevRep.spend) >= 0 ? "+" : ""}${pct(delta(r.spend, prevRep.spend), 0)} vs ${prevRep.label}` : "" },
        { k: "Net", v: money(r.net), tone: r.net >= 0 ? "good" : "bad" },
        { k: "Per spending day", v: money(r.perDay), tone: r.perDay > m.A.dailyCap ? "bad" : "good" },
      ])}
    </div>

    ${months.length > 1 ? card("Month by month", "Income against spending",
      columns(series, { labelA: "income", labelB: "spending" })) : ""}

    ${card("By category", `${r.categories.length} categories this month`, `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Category</th><th class="num">Total</th><th class="num">Share</th>
          ${prevRep ? `<th class="num">vs ${esc(prevRep.label)}</th>` : ""}</tr></thead>
        <tbody>${r.categories.map((c) => {
          const p = prevRep ? (prevRep.categories.find((x) => x.cat === c.cat) || { total: 0 }).total : null;
          const d = p != null ? c.total - p : null;
          return `<tr><td>${esc(c.cat)}</td><td class="num">${money(c.total)}</td>
            <td class="num">${pct(c.share)}</td>
            ${prevRep ? `<td class="num ${d > 0 ? "num-neg" : d < 0 ? "num-pos" : "muted"}">
              ${d === 0 ? "—" : signMoney(-d).replace("+", "−").replace("−−", "+")}</td>` : ""}</tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(r.spend)}</td><td class="num">100.0%</td>
          ${prevRep ? `<td class="num">${signMoney(prevRep.spend - r.spend)}</td>` : ""}</tr></tfoot>
      </table></div>`)}

    ${card("Personal against household", "", `
      <div class="donut-wrap">
        ${donut([{ label: "Personal", value: r.personal, color: "var(--s5)" },
                 { label: "Household", value: r.household, color: "var(--s2)" }], 120, 18)}
        <div class="legend">
          <div class="li"><span class="sw" style="background:var(--s5)"></span>
            <span style="flex:1">Personal</span><span class="mono muted">${money(r.personal)}</span></div>
          <div class="li"><span class="sw" style="background:var(--s2)"></span>
            <span style="flex:1">Household</span><span class="mono muted">${money(r.household)}</span></div>
        </div>
      </div>`)}

    ${card("Top merchants this month", "", `
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Merchant</th><th class="num">Total</th><th class="num">Times</th></tr></thead>
        <tbody>${r.merchants.slice(0, 12).map((x) => `<tr>
          <td>${esc(x.merchant)}</td><td class="num">${money(x.total)}</td>
          <td class="num">${x.count}</td></tr>`).join("")}</tbody>
      </table></div>`)}`;
}

/* -------------------------------------------------------------- SIPs --- */
function renderSips() {
  const m = metrics();
  const A = m.A;
  const active = state.sips.filter((s) => s.active);
  const monthlyAed = sum(active, (s) => toAedWith(A)(s.amountNative, s.ccy));
  const nextK = monthKey(todayISO());
  const contributions = state.invTx.slice().sort((a, b) => b.date.localeCompare(a.date));

  return `${subHeader("sips")}
    ${statBlock([
      { k: "Monthly total", v: money(monthlyAed), n: `INR ${fmt(sum(active, (s) => s.amountNative), 0)}` },
      { k: "Active plans", v: String(active.length), n: `of ${state.sips.length}` },
      { k: "A year of it", v: money0(monthlyAed * 12), tone: "good", n: "before any step-up" },
      { k: "Step-up", v: pct(A.sipStepUp, 0), n: "compounds the habit" },
    ])}

    ${card("Schedule", "Tap a plan to change the amount or pause it",
      state.sips.map((s) => {
        const h = state.holdings.find((x) => x.id === s.holdingId);
        const next = dayOfMonthISO(s.dayOfMonth >= Number(todayISO().slice(8)) ? nextK : addMonthsKey(nextK, 1), s.dayOfMonth);
        return `<div class="row tap flat" data-sip="${esc(s.id)}">
          <div class="row-main">
            <div class="row-title">${esc(h ? h.name : s.note)}</div>
            <div class="row-sub">${s.active ? `next ${longDate(next)} · day ${s.dayOfMonth}` : "paused"}</div>
          </div>
          <div class="row-val">${s.active ? money(toAedWith(A)(s.amountNative, s.ccy)) : "—"}
            <span class="small">${s.active ? `${esc(s.ccy)} ${fmt(s.amountNative, 0)}` : "cancelled"}</span></div>
        </div>`;
      }).join(""),
      `<button class="btn btn-sm btn-ghost" id="sipAdd">＋</button>`)}

    ${card("Contribution log", `${contributions.length} recorded`,
      contributions.length ? `<div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Date</th><th>Fund</th><th class="num">Amount</th><th class="num">Units</th><th>Note</th></tr></thead>
        <tbody>${contributions.map((t) => {
          const h = state.holdings.find((x) => x.id === t.holdingId);
          return `<tr><td>${shortDate(t.date)}</td><td>${esc(h ? h.name : "—")}</td>
            <td class="num">${esc(t.ccy)} ${fmt(t.amountNative)}</td>
            <td class="num">${t.units ? fmt(t.units, 3) : "—"}</td>
            <td class="muted" style="font-size:11.5px">${esc(t.note)}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td></td>
          <td class="num">INR ${fmt(sum(contributions, (t) => t.amountNative), 0)}</td>
          <td></td><td></td></tr></tfoot>
      </table></div>` : emptyState("No contributions logged yet."),
      `<button class="btn btn-sm btn-accent" id="contribAdd">＋ Log</button>`)}

    ${card("Why the step-up is the whole game", "", `
      <p class="verdict">A flat contribution loses to inflation every year without anyone noticing. Raising it
      ${pct(A.sipStepUp, 0)} annually costs nothing today, because the increase comes out of next year's raise rather
      than this year's budget. Over ${A.horizonYears} years that single habit is worth
      ${money0(futureValue(m.invested, m.monthly * 12, m.blended, A.sipStepUp, A.horizonYears)
             - futureValue(m.invested, m.monthly * 12, m.blended, 0, A.horizonYears))} more than staying flat.</p>`)}`;
}

/* ----------------------------------------------------------- history --- */
function renderHistory() {
  const m = metrics();
  const snaps = m.snaps;
  const first = snaps[0];

  return `${subHeader("history")}
    ${statBlock([
      { k: "Net worth", v: money(m.netWorth), n: "right now" },
      { k: "Since first check", v: signMoney(m.nwChangeSinceStart),
        tone: m.nwChangeSinceStart >= 0 ? "good" : "bad", n: first ? longDate(first.date) : "—" },
      { k: "Snapshots", v: String(snaps.length), n: "one a day, automatically" },
      { k: "Last change", v: signMoney(m.nwChange), tone: m.nwChange >= 0 ? "good" : "bad" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Net worth over time</h2><div class="sub">A snapshot is taken each day you open the app</div></div>
        <button class="btn btn-sm btn-ghost" id="snapNow">Snapshot now</button>
      </div>
      ${snaps.length > 1
        ? areaChart(snaps.map((s) => ({ label: shortDate(s.date), y: s.netWorth })))
        : emptyState("Only one snapshot so far. Come back tomorrow and the trend starts.")}
    </div>

    ${card("The record", `${snaps.length} entries`, `
      <div class="scroll-x"><table class="tbl wide">
        <thead><tr><th>Date</th><th class="num">Net worth</th><th class="num">Change</th>
          <th class="num">Cash</th><th class="num">Invested</th><th class="num">Debt</th></tr></thead>
        <tbody>${snaps.slice().reverse().map((s, i, arr) => {
          const prev = arr[i + 1];
          const d = prev ? s.netWorth - prev.netWorth : 0;
          return `<tr><td>${longDate(s.date)}${s.note ? `<div class="muted" style="font-size:11px">${esc(s.note)}</div>` : ""}</td>
            <td class="num">${money(s.netWorth)}</td>
            <td class="num ${d > 0 ? "num-pos" : d < 0 ? "num-neg" : "muted"}">${prev ? signMoney(d) : "—"}</td>
            <td class="num">${money(s.cash)}</td><td class="num">${money(s.invested)}</td>
            <td class="num">${money(s.liabilities)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="note">The number that matters is the trend, not any single reading. A month where the current
        account looked empty but units were bought and debt fell is a good month, and only this table proves it.</div>`)}`;
}

/* -------------------------------------------------------------- debt --- */
function renderDebt() {
  const m = metrics();
  const extra = state._debtExtra || 0;
  const avalanche = debtStrategy(state, m, "avalanche", extra);
  const snowball = debtStrategy(state, m, "snowball", extra);
  const A = m.A;

  return `${subHeader("debt")}
    ${statBlock([
      { k: "Outstanding", v: money(m.debtOutstanding), tone: m.debtOutstanding ? "warn" : "good" },
      { k: "Cleared", v: money(m.debtCleared), tone: "good", n: "so far" },
      { k: "Interest cost", v: money(avalanche.totalInterest),
        tone: avalanche.totalInterest ? "bad" : "good", n: "at current rates" },
      { k: "Debt free in", v: avalanche.payoffMonths + " mo", n: "on the schedule below" },
    ])}

    ${state.debts.map((d) => {
      const live = m.debts.find((x) => x.id === d.id);
      return `<div class="card">
        <div class="card-head">
          <div><h2>${esc(d.name)}</h2>
            <div class="sub">${pct(d.apr, 1)} APR · minimum ${money(d.minPayment)} on day ${d.dueDay}
              ${d.frozen ? " · frozen" : ""}</div></div>
          ${pill(live.outstanding > 0 ? money(live.outstanding) : "clear", live.outstanding > 0 ? "warn" : "good")}
        </div>
        <div class="bar ${live.outstanding === 0 ? "good" : "warn"}" style="margin-bottom:14px">
          <i style="width:${(live.progress * 100).toFixed(0)}%"></i></div>
        ${live.schedule.map((p) => `<div class="row tap flat" data-debt="${esc(p.id)}">
          <div class="avatar ${p.paid ? "paid" : ""}">${p.paid ? "✓" : "•"}</div>
          <div class="row-main">
            <div class="row-title">${longDate(p.date)}</div>
            <div class="row-sub wrap" style="white-space:normal">${esc(p.note)} · from ${esc(p.from)}</div>
          </div>
          <div class="row-val">${money(p.amount)}<span class="small">${p.paid ? "paid" : relativeDays(daysUntil(p.date))}</span></div>
        </div>`).join("")}
        <div class="note">${esc(d.note)}</div>
      </div>`;
    }).join("")}

    ${card("Avalanche against snowball", "Highest rate first, or smallest balance first", `
      <label class="field"><span>Extra a month, on top of the minimums</span>
        <input type="number" id="debtExtra" step="50" min="0" value="${extra}" /></label>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Strategy</th><th class="num">Months</th><th class="num">Interest</th>
          <th class="num">Total paid</th></tr></thead>
        <tbody>
          <tr><td>Avalanche — highest rate first</td><td class="num">${avalanche.payoffMonths}</td>
            <td class="num">${money(avalanche.totalInterest)}</td><td class="num">${money(avalanche.totalPaid)}</td></tr>
          <tr><td>Snowball — smallest balance first</td><td class="num">${snowball.payoffMonths}</td>
            <td class="num">${money(snowball.totalInterest)}</td><td class="num">${money(snowball.totalPaid)}</td></tr>
        </tbody>
      </table></div>
      <div class="note">${avalanche.totalInterest === snowball.totalInterest
        ? `With one interest-free debt the two strategies are identical — the comparison is here so that adding a
           real interest-bearing debt later answers the question properly.`
        : `Avalanche saves ${money(snowball.totalInterest - avalanche.totalInterest)} in interest; snowball clears the
           first balance sooner, which some people need in order to keep going. Both are defensible.`}</div>`)}

    ${card("The rule that actually matters", "",
      `<p class="verdict">Tabby charges nothing while the minimum lands on time, so punctuality — not size — is the
      whole risk here. Paying the full August statement early would cost
      ${money(A.tabbyFullAug - A.tabbyMinSep)} more in the month you can least afford it and save no fee at all.
      Two of the three payments fall in the same eight weeks as the rent cheque, which is why the schedule above
      funds each one from a different salary.</p>`)}`;
}

/* ---------------------------------------------------------- accounts --- */
function renderAccounts() {
  const m = metrics();
  const potsByAccount = {};
  for (const p of state.pots) (potsByAccount[p.accountId] = potsByAccount[p.accountId] || []).push(p);

  return `${subHeader("accounts")}
    ${statBlock([
      { k: "Total liquid", v: money(m.liquidCash), n: `${state.accounts.length} accounts` },
      { k: "Promised to pots", v: money(m.potsHeld), tone: "warn", n: `${state.pots.length} pots` },
      { k: "Safe to spend", v: money(m.safeToSpend), tone: m.safeToSpend < 500 ? "bad" : "good",
        n: "what is actually yours" },
      { k: "Runway", v: m.overdrawn ? "overdrawn" : Number.isFinite(m.runwayDays) ? m.runwayDays + " days" : "—",
        tone: m.overdrawn || m.runwayDays < 14 ? "bad" : m.runwayDays < 30 ? "warn" : "good",
        n: m.overdrawn ? "already inside pot money" : "at the current burn" },
    ])}

    ${card("Accounts", "Tap to confirm a balance from a bank message",
      state.accounts.map((a) => {
        const pots = potsByAccount[a.id] || [];
        const held = sum(pots, (p) => p.balance);
        return `<div class="acct">
          <div class="row tap flat" data-account="${esc(a.id)}">
            <div class="row-main">
              <div class="row-title">${esc(a.name)} ${a.locked ? pill("locked", "warn") : ""}</div>
              <div class="row-sub wrap" style="white-space:normal">${esc(a.note)}</div>
            </div>
            <div class="row-val">${money(a.balance)}<span class="small">${longDate(a.asOf)}</span></div>
          </div>
          ${pots.length ? `<div class="pots">
            ${pots.map((p) => `<div class="pot tap" data-pot="${esc(p.id)}">
              <div class="pot-top"><span>${esc(p.name)}</span><span class="mono">${money(p.balance)}</span></div>
              ${miniBar(p.balance, p.target, p.balance >= p.target ? "good" : "warn")}
              <div class="pot-sub">${money(p.balance)} of ${money(p.target)}${(() => {
                const o = state.obligations.find((x) => x.id === p.earmark);
                return o ? ` · held against ${esc(o.name)}` : "";
              })()} · ${esc(p.note)}</div>
            </div>`).join("")}
            <div class="pot-free ${a.balance - held < 0 ? "raided" : ""}">
              ${a.balance - held < 0
                ? `Overdrawn against its pots by <strong>${money(held - a.balance)}</strong> — money a pot had already claimed has been spent.`
                : `Free in this account: <strong>${money(a.balance - held)}</strong>`}
            </div>
          </div>` : ""}
        </div>`;
      }).join(""),
      `<button class="btn btn-sm btn-ghost" id="acctAdd">＋</button>`)}

    ${card("Pots", "Virtual envelopes. They never move money — they say what a balance is already promised to.",
      `<div class="btn-row"><button class="btn btn-sm btn-accent" id="potAdd">＋ New pot</button>
       <button class="btn btn-sm" id="allocate">Allocate a payday</button></div>
       <div class="note">This is why AED 6,090.70 in FAB 4002 is not AED 6,090.70 of spending power. Every pot is
        subtracted before the app tells you what is safe to spend, and the cashflow forecast starts from that same
        number rather than from the bank total.</div>`)}`;
}

/* ---------------------------------------------------------- settings --- */
function renderSettings() {
  const A = state.assumptions;
  const levers = [
    ["Currency and rates", [
      ["aedPerInr", "AED per INR", "Derived from the last confirmed SIP transfer. Refresh from the next receipt."],
      ["aedPerUsd", "AED per USD", "The dirham peg. Treat as fixed."],
    ]],
    ["Income and housing", [
      ["salary", "Net monthly salary", "The baseline every plan is built on."],
      ["salaryDay", "Salary day of month", "Used by the cashflow forecast."],
      ["rentCheque", "Rent cheque", "One cheque, as written on the lease."],
      ["rentChequesPerYear", "Rent cheques per year", "ASSUMPTION — confirm against the lease. Drives the whole rent accrual."],
    ]],
    ["Spending controls", [
      ["dailyCap", "Daily living cap", "What the burn rate is judged against."],
      ["weeklyCap", "Weekly cap", "The looser control for a whole week."],
      ["forecastDays", "Forecast horizon (days)", "How far the cashflow projection runs."],
    ]],
    ["Returns and inflation", [
      ["returnIndiaEq", "Indian equity return", "Nominal, before currency effects."],
      ["returnGlobalEq", "Global equity return", "Broad developed-market assumption."],
      ["returnCommodity", "Commodity return", "Applies to the silver holding."],
      ["returnCash", "Cash return", "Broker cash and savings."],
      ["inflation", "Inflation", "Used for the today's-money column."],
      ["scenarioAdj", "Scenario adjustment", "0 base · −0.03 bear · +0.02 bull."],
    ]],
    ["Wealth plan", [
      ["sipStepUp", "Annual SIP step-up", "The highest-leverage habit in the plan."],
      ["extraMonthly", "Extra monthly investment", "What you redirect on top of the SIP."],
      ["targetSavingsRate", "Target savings rate", "Scored on the advisor."],
      ["emergencyMonths", "Emergency target (months)", "Measured against essential spending."],
      ["horizonYears", "Plan horizon (years)", "Length of the projection."],
      ["swr", "Safe withdrawal rate", "For the independence target."],
    ]],
  ];

  return `${subHeader("settings")}
    ${levers.map(([group, rows]) => card(group, "",
      rows.map(([k, label, note]) => `
        <div class="kv lever">
          <span class="k">${esc(label)}<br><span class="muted" style="font-size:11.5px">${esc(note)}</span></span>
          <input class="inline-num" type="number" step="any" data-lever="${k}" value="${A[k]}" />
        </div>`).join(""))).join("")}

    ${card("Display", "",
      `<div class="kv"><span class="k">Cap measures</span>
        <select id="capMode" class="inline-sel">
          <option value="living" ${state.settings.capMode === "living" ? "selected" : ""}>Day-to-day living only</option>
          <option value="all" ${state.settings.capMode === "all" ? "selected" : ""}>All spending</option>
        </select></div>
       <div class="note">Day-to-day living excludes one-off travel and the utility bills, so the cap measures the
        part you actually decide each day.</div>`)}

    ${card("Data", "Everything stays on this device. Nothing is uploaded.", `
      <div class="btn-row">
        <button class="btn" id="expJson">Export backup</button>
        <button class="btn" id="importBtn">Import backup</button>
        <button class="btn" id="expCsv">Transactions CSV</button>
        <button class="btn btn-danger" id="resetBtn">Reset to workbook</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden />
      <div class="note ${!state.settings.lastBackup ? "warn" : ""}">
        ${state.settings.lastBackup
          ? `Last backup ${longDate(state.settings.lastBackup)}.`
          : "You have never taken a backup."}
        Seeded from Johnnys_Edge_Lifetime_Finance.xlsx as of ${longDate(state.asOf)}.
        Last saved ${new Date(state.updatedAt).toLocaleString("en-GB")}.
      </div>`)}`;
}

/* ------------------------------------------------------------ search --- */
function renderSearch() {
  const q = state._search || "";
  const results = q ? search(q) : [];
  const groups = [...new Set(results.map((r) => r.type))];

  return `${subHeader("search")}
    <div class="card">
      <label class="field"><span>Search everything</span>
        <input id="globalSearch" type="search" value="${esc(q)}"
          placeholder="A merchant, a bill, a goal, a fund…" autocomplete="off" /></label>
      ${q && !results.length ? emptyState(`Nothing matches “${q}”.`) : ""}
    </div>
    ${groups.map((g) => card(g, `${results.filter((r) => r.type === g).length} found`,
      results.filter((r) => r.type === g).map((r) => `
        <div class="row tap flat" data-goto="${esc(r.view)}">
          <div class="row-main">
            <div class="row-title">${esc(r.title)}</div>
            <div class="row-sub">${esc(r.sub)}</div>
          </div>
          <div class="row-val">${money(r.amount)}</div>
        </div>`).join(""))).join("")}`;
}

/* -------------------------------------------------------------- help --- */
function renderHelp() {
  return `${subHeader("help")}
    ${card("The one rule everything else follows", "",
      `<p class="verdict">A balance you confirm from a bank message is truth and overwrites whatever the app
      thought. Everything else — a transaction you record, a debt you settle, a pot you fill — adjusts from there.
      That is why nothing double-counts: confirmation sets, actions adjust.</p>`)}

    ${card("How money moves", "", `
      <ol class="steps">
        <li><strong>Confirming a balance always wins.</strong> Updating an account from a bank message sets it
            absolutely rather than adjusting it.</li>
        <li><strong>A transaction you record moves its account.</strong> New entries reduce the balance they were
            paid from. The seeded August history carries no account link, because those balances are already stated
            <em>after</em> those transactions.</li>
        <li><strong>Settling a debt does not make you richer.</strong> Marking a payment paid reduces both the
            balance and what you owe, so net worth stays flat.</li>
        <li><strong>Expected money is never cash.</strong> A salary you have not received is an event in the
            forecast, never a balance.</li>
        <li><strong>Pots are promises.</strong> They never move money; they subtract from what the app calls safe
            to spend.</li>
      </ol>`)}

    ${card("What counts as spending", "", `
      <p class="verdict">Transfers between your own accounts, salary credits and fully refunded charges are recorded
      for the audit trail but never totalled as expenditure. That is the difference between a ledger you can trust
      and a number that flatters you. The daily cap measures day-to-day living only — food, fuel, shops, grooming —
      because one-off travel and a quarterly utility bill are not decisions you make each morning.</p>`)}

    ${card("The two assumptions most likely to be wrong", "", `
      <ol class="steps">
        <li><strong>Rent cheques per year is set to ${state.assumptions.rentChequesPerYear}.</strong> The lease shows
            one cheque of ${money(state.assumptions.rentCheque)} due 22 Oct 2026 but not the cadence. It drives the
            monthly rent accrual, the essentials ratio and the emergency-fund target. One phone call settles it.</li>
        <li><strong>AED per INR is ${state.assumptions.aedPerInr}</strong>, derived from
            ${money(462.40)} funding INR 12,000 on 10 Aug 2026. Refresh it from the next transfer receipt.</li>
      </ol>`)}

    ${card("Keyboard and gestures", "", `
      <ul class="steps">
        <li><kbd>/</kbd> jumps to search · <kbd>N</kbd> records a transaction · <kbd>Esc</kbd> closes a sheet</li>
        <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes the last change, including a bulk import</li>
        <li>Add the app to your home screen and it works with no connection at all</li>
      </ul>`)}`;
}
