/* ============================================================
   Wealth OS — the engine
   One pure function turns state into every number the UI shows, so no two
   views can ever disagree about what the position is. Everything below is
   derived; nothing here writes to state.
   ============================================================ */
"use strict";

function rentToFundRaw(A, rentHeld) {
  return Math.max(0, round2(A.rentCheque - rentHeld));
}

const toAedWith = (A) => (v, ccy) =>
  ccy === "INR" ? v * A.aedPerInr : ccy === "USD" ? v * A.aedPerUsd : v;

/* ============================================================== metrics == */
function metrics(s = state) {
  const A = s.assumptions;
  const toAed = toAedWith(A);

  /* ---------------------------------------------------------- cash ----- */
  /* Only dirham accounts count as household liquid cash. The rupee account
     exists to fund the SIP and is never available for a bill here. */
  const liquidCash = sum(s.accounts.filter((a) => a.ccy === "AED"), (a) => a.balance);
  const foreignCash = sum(s.accounts.filter((a) => a.ccy !== "AED"), (a) => toAed(a.balance, a.ccy));
  const emergency  = sum(s.pots.filter((p) => p.kind === "emergency"), (p) => p.balance);
  const rentHeld   = sum(s.pots.filter((p) => p.kind === "vault"), (p) => p.balance);
  const potsHeld   = sum(s.pots, (p) => p.balance);
  /* Safe to spend is the only cash figure that is honestly yours: everything
     in a pot is already promised to something with a date on it. */
  const safeToSpend = round2(liquidCash - potsHeld);
  const looseCash   = round2(liquidCash - rentHeld - emergency);

  /* --------------------------------------------------- investments ----- */
  const holdings = s.holdings.map((h) => ({
    ...h, aed: toAed(h.value, h.ccy), costAed: toAed(h.cost, h.ccy),
  }));
  const invested = sum(holdings, (h) => h.aed);
  const investedCost = sum(holdings, (h) => h.costAed);
  const investedGain = invested - investedCost;
  const investedReturn = safeDiv(investedGain, investedCost);

  const byClass = {};
  for (const h of holdings) byClass[h.cls] = (byClass[h.cls] || 0) + h.aed;
  const allocation = Object.keys(ALLOC_TARGETS).map((cls) => {
    const value = byClass[cls] || 0;
    const actual = safeDiv(value, invested);
    return { cls, value, actual, target: ALLOC_TARGETS[cls], drift: actual - ALLOC_TARGETS[cls] };
  });
  const byHouse = {};
  for (const h of holdings) byHouse[h.house] = (byHouse[h.house] || 0) + h.aed;
  const topHouse = Object.entries(byHouse).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
  const houseConcentration = safeDiv(topHouse[1], invested);
  const largestFund = invested ? Math.max(...holdings.map((h) => h.aed)) / invested : 0;
  const inrExposure = safeDiv(sum(holdings.filter((h) => h.ccy === "INR"), (h) => h.aed), invested);

  /* ---------------------------------------------------------- debt ----- */
  const debts = s.debts.map((d) => {
    const paid = sum(s.debtPayments.filter((p) => p.debtId === d.id && p.paid), (p) => p.amount);
    const schedule = s.debtPayments.filter((p) => p.debtId === d.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = schedule.find((p) => !p.paid) || null;
    return { ...d, paid, outstanding: Math.max(0, round2(d.balance - paid)), schedule, next,
             progress: safeDiv(paid, d.balance) };
  });
  const debtOutstanding = sum(debts, (d) => d.outstanding);
  const debtCleared = sum(debts, (d) => d.paid);

  /* ------------------------------------------------- balance sheet ----- */
  /* Total assets is dirham cash plus investments, exactly as the workbook
     defines it. The rupee SIP-funding account is money in transit and sits in
     neither total. Net worth then nets the debt off — the workbook headlines
     the gross figure, so both are reported and the difference is stated. */
  const totalAssets = round2(liquidCash + invested);
  const netWorth = round2(totalAssets - debtOutstanding);
  const rentToFund = Math.max(0, round2(A.rentCheque - rentHeld));

  /* -------------------------------------------------------- ledger ----- */
  const spend = s.tx.filter((t) => t.counts);
  const dates = s.tx.map((t) => t.date.slice(0, 10)).sort();
  const firstDate = dates[0] || todayISO();
  const lastDate = dates[dates.length - 1] || todayISO();
  const days = Math.max(1, diffDays(firstDate, lastDate) + 1);
  const runRate = 30.44 / days;

  const byCat = {};
  for (const t of spend) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const totalSpend = sum(spend, (t) => t.amount);
  const categories = Object.entries(byCat)
    .map(([cat, total]) => ({
      cat, total, share: safeDiv(total, totalSpend), perDay: total / days,
      personal: sum(spend.filter((t) => t.category === cat && t.split === "Personal"), (t) => t.amount),
      household: sum(spend.filter((t) => t.category === cat && t.split !== "Personal"), (t) => t.amount),
      count: spend.filter((t) => t.category === cat).length,
    }))
    .sort((a, b) => b.total - a.total);

  const byMerchant = {};
  for (const t of spend) {
    const k = merchantKey(t.merchant) || t.merchant;
    byMerchant[k] = byMerchant[k] || { key: k, merchant: t.merchant, total: 0, count: 0, dates: [] };
    byMerchant[k].total += t.amount;
    byMerchant[k].count += 1;
    byMerchant[k].dates.push(t.date.slice(0, 10));
  }
  const merchants = Object.values(byMerchant)
    .map((m) => ({ ...m, avg: m.total / m.count }))
    .sort((a, b) => b.total - a.total);

  const oneOff = byCat["Travel"] || 0;
  const utilities = byCat["Utilities & Telecom"] || 0;
  const livingSpend = totalSpend - oneOff - utilities;
  const dailyBurn = livingSpend / days;
  const monthlyRunRate = totalSpend * runRate;
  const personalShare = safeDiv(
    sum(spend.filter((t) => t.split === "Personal"), (t) => t.amount), totalSpend);

  /* daily series, used by the heatmap, the streak and the cap tracker */
  const byDay = {};
  for (const t of spend) {
    const d = t.date.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + t.amount;
  }
  const livingByDay = {};
  for (const t of spend) {
    if (t.category === "Travel" || t.category === "Utilities & Telecom") continue;
    const d = t.date.slice(0, 10);
    livingByDay[d] = (livingByDay[d] || 0) + t.amount;
  }
  const capSeries = (s.settings.capMode === "all" ? byDay : livingByDay);
  const todaySpend = capSeries[todayISO()] || 0;
  const thisWeek = weekKey(todayISO());
  const weekSpend = sum(Object.entries(capSeries)
    .filter(([d]) => weekKey(d) === thisWeek), ([, v]) => v);

  /* Longest run of days with no spending, counting back from the last day
     the ledger covers rather than from today, so a stale ledger cannot
     manufacture a streak. */
  let noSpendStreak = 0;
  for (let d = lastDate; diffDays(firstDate, d) >= 0; d = addDaysISO(d, -1)) {
    if ((capSeries[d] || 0) > 0) break;
    noSpendStreak++;
  }

  /* -------------------------------------------------------- income ----- */
  const incomeRows = s.income.map((i) => ({ ...i }));
  const incomeActual = sum(incomeRows.filter((i) => i.status === "actual"), (i) => i.amount);
  const incomeExpected = sum(incomeRows.filter((i) => i.status !== "actual"), (i) => i.amount);
  const bySource = {};
  for (const i of incomeRows) {
    const src = s.incomeSources.find((x) => x.id === i.sourceId);
    const k = src ? src.name : "Unattributed";
    bySource[k] = (bySource[k] || 0) + i.amount;
  }
  const incomeTotal = incomeActual + incomeExpected;
  const incomeConcentration = incomeTotal
    ? Math.max(...Object.values(bySource)) / incomeTotal : 1;

  /* -------------------------------------------------------- budget ----- */
  const budget = s.budget.map((b) => {
    const actual = b.cat ? (byCat[b.cat] || 0) : 0;
    const rate = actual * runRate;
    return { ...b, actual, rate, variance: rate - b.plan, usage: safeDiv(rate, b.plan, actual ? 2 : 0) };
  });
  const grp = (g, k) => sum(budget.filter((b) => b.group === g), (b) => b[k]);
  const essential = grp("Essential", "plan");
  const lifestyle = grp("Lifestyle", "plan");
  const wealthOut = grp("Debt & Wealth", "plan");
  const lifestyleRate = grp("Lifestyle", "rate");
  const income = A.salary;
  const totalOutflow = essential + lifestyle + wealthOut;
  const surplus = income - totalOutflow;
  const sipPlan = (budget.find((b) => b.id === "b13") || {}).plan || 0;
  const emgPlan = (budget.find((b) => b.id === "b14") || {}).plan || 0;
  const savingsRate = safeDiv(sipPlan + emgPlan, income);

  /* ------------------------------------------------- the rent gap -------
     This is the workbook's headline number and the app reproduces it exactly,
     so the two can never disagree about the one figure that matters.

       living pool = spendable + inflows − commitments − rent still to fund − buffer
       gap         = minimum living need over the window − that pool

     A negative pool is not an error: it means the rent cannot be funded and
     the month lived through on the money in hand. */
  const rentDeadline = A.rentDeadline || "2026-10-21";
  const daysToRentDeadline = Math.max(0, diffDays(todayISO(), rentDeadline));

  /* Salary dates strictly after today and on or before the deadline. */
  let inflowsBeforeDeadline = 0;
  for (let k = monthKey(todayISO()); k <= monthKey(rentDeadline); k = addMonthsKey(k, 1)) {
    for (const src of s.incomeSources) {
      if (!src.active || !src.expectedMonthly || !src.dayOfMonth) continue;
      const when = dayOfMonthISO(k, src.dayOfMonth);
      if (when > todayISO() && when <= rentDeadline) inflowsBeforeDeadline += src.expectedMonthly;
    }
  }

  /* Everything dated before the deadline except the rent cheque itself.
     An item already committed to autopay is excluded here — the workbook
     treats it as settled — but the day-by-day forecast still charges it. */
  const committedBeforeDeadline = sum(
    s.obligations.filter((o) => !o.paid && !o.autopayCommitted
      && o.due <= rentDeadline && o.priority !== "Critical_rent" && o.id !== "o-rent"),
    (o) => o.amount);
  const autopayCommitted = sum(
    s.obligations.filter((o) => !o.paid && o.autopayCommitted && o.due <= rentDeadline),
    (o) => o.amount);

  const safetyBuffer = A.safetyBuffer || 0;
  const spendableNow = round2(liquidCash - potsHeld);
  const livingPool = round2(spendableNow + inflowsBeforeDeadline - committedBeforeDeadline
                            - rentToFundRaw(A, rentHeld) - safetyBuffer);
  const minLivingNeed = daysToRentDeadline * A.dailyCap;
  const rentGap = Math.max(0, round2(minLivingNeed - livingPool));
  const earnPerDay = daysToRentDeadline ? rentGap / daysToRentDeadline : 0;
  const earnPerWeek = earnPerDay * 7;
  const dailyLimitToRent = daysToRentDeadline ? livingPool / daysToRentDeadline : 0;
  const safeDailyLimit = Math.max(0, dailyLimitToRent);

  /* ------------------------------------------- near-term funding gap --- */
  const nearBills = 813.28 + A.tabbyMinSep + 590.98 + 323.95;
  const availableToSep = looseCash + 2906;
  const billsGap = Math.max(0, nearBills + A.survivalToSep25 - availableToSep);
  const extraCashNeeded = billsGap + A.sipAed;

  /* ------------------------------------------------------ coverage ----- */
  /* From 15 September the grocery bill moves onto this household. The
     emergency-fund target has to be sized on the household that will exist,
     not the one that exists today. */
  const groceryTransferLive = todayISO() >= (A.partnerLastWorkingDay || "9999-12-31");
  const essentialForward = essential + (A.groceryTransfer || 0);
  const emergencyTarget = (A.monthlyEssentials || essentialForward) * A.emergencyMonths;
  const emergencyCover = safeDiv(emergency, essential);
  const liquidityMonths = safeDiv(looseCash, essential);
  const debtToAssets = safeDiv(debtOutstanding, totalAssets);
  /* How long the free cash lasts at the pace the ledger actually shows. */
  const runwayDays = safeToSpend <= 0 ? 0
                   : dailyBurn > 0 ? Math.floor(safeToSpend / dailyBurn) : Infinity;
  const overdrawn = safeToSpend < 0;

  /* -------------------------------------------------- health score ----- */
  const comp = [
    { key: "Liquidity", label: "Free cash against one month of essentials",
      score: clamp(liquidityMonths * 100, 0, 100), weight: 0.20 },
    { key: "Emergency", label: "Emergency cover against the six-month target",
      score: clamp(safeDiv(emergency, emergencyTarget) * 100, 0, 100), weight: 0.20 },
    { key: "Debt", label: "Exposure against total assets",
      score: clamp((1 - debtToAssets) * 100, 0, 100), weight: 0.15 },
    { key: "Savings", label: "Savings rate achieved against target",
      score: clamp(safeDiv(savingsRate, A.targetSavingsRate) * 100, 0, 100), weight: 0.20 },
    { key: "Balance", label: "Does the plan fit the salary",
      score: surplus >= 0 ? 100 : clamp(100 + safeDiv(surplus, Math.max(1, income)) * 100, 0, 100),
      weight: 0.15 },
    { key: "Discipline", label: "Lifestyle plan against actual run rate",
      score: clamp(lifestyleRate ? (lifestyle / lifestyleRate) * 100 : 100, 0, 100), weight: 0.10 },
  ];
  const health = sum(comp, (c) => c.score * c.weight);
  const grade = health >= 80 ? "A" : health >= 65 ? "B" : health >= 50 ? "C" : health >= 35 ? "D" : "E";

  /* ---------------------------------------------------- projection ----- */
  const blended = (invested
    ? (sum(holdings.filter((h) => h.ccy === "INR" && h.cls !== "Broker cash" && h.cls !== "Commodity"), (h) => h.aed) * A.returnIndiaEq
      + sum(holdings.filter((h) => h.cls === "Commodity"), (h) => h.aed) * A.returnCommodity
      + sum(holdings.filter((h) => h.cls === "Global equity"), (h) => h.aed) * A.returnGlobalEq
      + sum(holdings.filter((h) => h.cls === "Crypto"), (h) => h.aed) * (A.returnCrypto || A.returnGlobalEq)
      + sum(holdings.filter((h) => h.cls === "Broker cash"), (h) => h.aed) * A.returnCash) / invested
    : A.returnIndiaEq) + A.scenarioAdj;

  const monthly = sipPlan + A.extraMonthly;
  const projection = project(invested, monthly * 12, blended, A.sipStepUp, A.inflation, A.horizonYears);
  const annualEssential = essential * 12;
  const fiTarget = safeDiv(annualEssential, A.swr);
  const fiIndex = projection.findIndex((p) => p.realClosing >= fiTarget);
  const yearsToFI = fiIndex === -1 ? null : fiIndex + 1;

  /* ------------------------------------------------ net worth trend ---- */
  const snaps = s.snapshots.slice().sort((a, b) => a.date.localeCompare(b.date));
  const firstSnap = snaps[0] || null;
  const prevSnap = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const nwChange = prevSnap ? netWorth - prevSnap.netWorth : 0;
  const nwChangeSinceStart = firstSnap ? netWorth - firstSnap.netWorth : 0;

  return {
    A, liquidCash, emergency, rentHeld, potsHeld, safeToSpend, looseCash,
    holdings, invested, investedCost, investedGain, investedReturn, allocation,
    byHouse, topHouse, houseConcentration, largestFund, inrExposure,
    debts, debtOutstanding, debtCleared, totalAssets, netWorth, rentToFund,
    spend, firstDate, lastDate, days, runRate, categories, merchants, totalSpend,
    livingSpend, dailyBurn, monthlyRunRate, personalShare, byDay, livingByDay,
    capSeries, todaySpend, weekSpend, noSpendStreak,
    incomeRows, incomeActual, incomeExpected, bySource, incomeTotal, incomeConcentration,
    budget, essential, lifestyle, wealthOut, lifestyleRate, income, totalOutflow,
    surplus, savingsRate, sipPlan, emgPlan,
    nearBills, availableToSep, billsGap, extraCashNeeded,
    foreignCash, rentDeadline, daysToRentDeadline, inflowsBeforeDeadline,
    committedBeforeDeadline, autopayCommitted, safetyBuffer, spendableNow,
    livingPool, minLivingNeed, rentGap, earnPerDay, earnPerWeek,
    dailyLimitToRent, safeDailyLimit,
    emergencyTarget, emergencyCover, liquidityMonths, debtToAssets, runwayDays,
    groceryTransferLive, essentialForward,
    comp, health, grade, blended, monthly, projection, annualEssential, fiTarget, yearsToFI, overdrawn,
    snaps, nwChange, nwChangeSinceStart,
  };
}

/* Year-end contributions, growth on the opening balance — deliberately the
   same convention as the workbook, so the two never disagree. */
function project(p0, c1, r, g, infl, n) {
  const out = [];
  let opening = p0, contribution = c1, cumulative = 0;
  for (let y = 1; y <= n; y++) {
    const growth = opening * r;
    const closing = opening + contribution + growth;
    cumulative += contribution;
    out.push({ year: y, calendar: 2026 + y, opening, contribution, growth, closing,
               realClosing: closing / Math.pow(1 + infl, y), cumulative });
    opening = closing;
    contribution *= (1 + g);
  }
  return out;
}

/* Closed form of the same series, for the sensitivity table. */
function futureValue(p0, c1, r, g, n) {
  if (Math.abs(r - g) < 1e-4) return p0 * Math.pow(1 + r, n) + c1 * n * Math.pow(1 + r, n - 1);
  return p0 * Math.pow(1 + r, n) + c1 * (Math.pow(1 + r, n) - Math.pow(1 + g, n)) / (r - g);
}

/* ============================================================= forecast == */
/* A day-by-day projection of the cash balance. Everything with a date lands
   on its date; everything recurring is projected forward; day-to-day living
   is spread evenly at whichever burn rate you chose. The point is to find
   the day the balance goes negative before it actually does.

   Opening balance is `safeToSpend`, not the bank total: money in a pot is
   already promised, and a forecast that spends the rent is worthless. */
function forecast(s = state, m = metrics(s), opts = {}) {
  const A = s.assumptions;
  const days = opts.days || A.forecastDays || 90;
  const start = opts.start || todayISO();
  const end = addDaysISO(start, days);
  const burnMode = opts.burnMode || A.forecastBurnMode || "actual";
  const dailyBurn = burnMode === "plan"
    ? (m.lifestyle + (m.budget.find((b) => b.id === "b3") || { plan: 0 }).plan
       + (m.budget.find((b) => b.id === "b4") || { plan: 0 }).plan) / 30.44
    : m.dailyBurn;

  const events = [];
  const push = (date, label, amount, kind, note) => {
    if (date < start || date > end) return;
    events.push({ date, label, amount, kind, note });
  };

  /* --- income -------------------------------------------------------------
     A dated income row — actual or still estimated — always overrides the
     recurring assumption for that source in that month. August is the case
     that matters: AED 2,906 is the *remainder* of the August cycle, not an
     extra salary on top of it, and counting both would invent nearly eight
     thousand dirhams. The override has to apply regardless of status: once
     the AED 2,906 is confirmed and marked "actual", it stops being pushed as
     a future event (it is already sitting in the account balance) — but it
     must keep suppressing the generic recurring push, or confirming income
     would paradoxically summon a second, full-salary phantom event. */
  const overridden = new Set();
  for (const i of s.income) {
    if (i.sourceId) overridden.add(`${i.sourceId}|${monthKey(i.date)}`);
    if (i.status === "actual") continue;   // already in the balance; don't project it again
    if (i.date < start || i.date > end) continue;
    push(i.date, i.name, i.amount, "income", i.note || "");
  }
  for (let k = monthKey(start); k <= monthKey(end); k = addMonthsKey(k, 1)) {
    for (const src of s.incomeSources) {
      if (!src.active || !src.expectedMonthly || !src.dayOfMonth) continue;
      if (overridden.has(`${src.id}|${k}`)) continue;
      push(dayOfMonthISO(k, src.dayOfMonth), src.name, src.expectedMonthly, "income",
           "Expected, not banked — the forecast marks it as an estimate.");
    }
  }

  /* --- scheduled debt payments ------------------------------------------
     Pushed before obligations because the debt schedule is the authoritative
     record of what Tabby takes and when. */
  const claimed = new Set();
  const claimKey = (date, amount) => `${date}|${Math.round(Math.abs(amount) * 100)}`;
  for (const d of s.debtPayments) {
    if (d.paid) continue;
    const debt = s.debts.find((x) => x.id === d.debtId);
    push(d.date, `${debt ? debt.name : "Debt"} payment`, -d.amount, "debt", d.note || "");
    claimed.add(claimKey(d.date, d.amount));
  }

  /* --- SIP instalments ---------------------------------------------------- */
  for (let k = monthKey(start); k <= monthKey(end); k = addMonthsKey(k, 1)) {
    const activeSips = s.sips.filter((x) => x.active);
    if (!activeSips.length) continue;
    const day = activeSips[0].dayOfMonth || 10;
    const aed = round2(sum(activeSips, (x) => toAedWith(A)(x.amountNative, x.ccy)));
    const when = dayOfMonthISO(k, day);
    push(when, "Nippon SIP", -aed, "invest",
         "Investing, not spending — but it still has to clear the account.");
    claimed.add(claimKey(when, aed));
  }

  /* --- dated obligations ------------------------------------------------
     Two guards here. First, an obligation already represented by a debt
     payment or a SIP instalment is skipped, or the same money would leave
     the account twice. Second, the opening balance already excludes every
     pot, so charging a bill in full would penalise the same dirham twice —
     once by holding it back, once by spending it. Money earmarked for a bill
     is netted off that bill, and only the shortfall reaches the forecast. */
  for (const o of s.obligations) {
    if (o.paid) continue;
    if (claimed.has(claimKey(o.due, o.amount))) continue;
    const earmarked = sum(s.pots.filter((p) => p.earmark === o.id), (p) => p.balance);
    const due = Math.max(0, round2(o.amount - earmarked));
    if (due <= 0) continue;
    const note = earmarked > 0
      ? `${money(earmarked)} already held in a pot; ${money(due)} still to find. ${o.note || ""}`.trim()
      : (o.note || "");
    push(o.due, o.name, -due, o.priority === "Critical" ? "critical" : "bill", note);
  }

  /* --- confirmed recurring bills not already covered by an obligation -- */
  const obligationNames = new Set(s.obligations.map((o) => merchantKey(o.name)));
  for (const r of s.recurring) {
    if (!r.active || r.dismissed) continue;
    if (obligationNames.has(merchantKey(r.merchant))) continue;
    let d = r.nextDate;
    for (let guard = 0; d && d <= end && guard < 40; guard++) {
      push(d, r.merchant, -r.amount, "recurring", `Detected ${r.cadence} pattern.`);
      d = r.cadence === "weekly" ? addDaysISO(d, 7)
        : r.cadence === "fortnightly" ? addDaysISO(d, 14)
        : addDaysISO(d, 30);
    }
  }

  /* --- walk the days ---------------------------------------------------- */
  events.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  const series = [];
  let balance = opts.opening != null ? opts.opening : m.safeToSpend;
  let minBalance = balance, minDate = start, firstNegative = null;
  const byDate = {};
  for (const e of events) (byDate[e.date] = byDate[e.date] || []).push(e);

  for (let i = 0; i <= days; i++) {
    const d = addDaysISO(start, i);
    const todays = byDate[d] || [];
    const moves = sum(todays, (e) => e.amount);
    if (i > 0) balance -= dailyBurn;
    balance += moves;
    if (balance < minBalance) { minBalance = balance; minDate = d; }
    if (balance < 0 && !firstNegative) firstNegative = d;
    series.push({ date: d, balance, moves, events: todays, burn: i > 0 ? dailyBurn : 0 });
  }

  return {
    start, end, days, dailyBurn, burnMode, series, events,
    opening: opts.opening != null ? opts.opening : m.safeToSpend,
    closing: series[series.length - 1].balance,
    minBalance, minDate, firstNegative,
    daysUntilNegative: firstNegative ? diffDays(start, firstNegative) : null,
    totalIn: sum(events.filter((e) => e.amount > 0), (e) => e.amount),
    totalOut: -sum(events.filter((e) => e.amount < 0), (e) => e.amount),
    burnTotal: dailyBurn * days,
  };
}

/* ==================================================== recurring detection = */
/* Two or more charges from the same merchant at a regular interval is a
   subscription whether or not anyone called it one. Detection is deliberately
   conservative: it proposes, and you confirm. */
function detectRecurring(s = state, m = metrics(s)) {
  const groups = {};
  for (const t of s.tx) {
    if (!t.counts) continue;
    const k = merchantKey(t.merchant) || t.merchant;
    (groups[k] = groups[k] || []).push(t);
  }
  const minHits = s.assumptions.recurringMinHits || 2;
  const out = [];

  for (const [key, rows] of Object.entries(groups)) {
    if (rows.length < minHits) continue;
    const sorted = rows.slice().sort((a, b) => a.date.localeCompare(b.date));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(diffDays(sorted[i - 1].date.slice(0, 10), sorted[i].date.slice(0, 10)));
    }
    const typicalGap = median(gaps.filter((g) => g > 0));
    const amounts = sorted.map((r) => r.amount);
    const typicalAmount = median(amounts);
    const spread = typicalAmount ? stdev(amounts) / typicalAmount : 1;

    /* A cadence only counts if the gaps cluster and the amounts do too.
       Groceries every three days at wildly different amounts is a habit,
       not a subscription — it is reported separately as a frequent merchant. */
    const cadence = typicalGap >= 25 && typicalGap <= 35 ? "monthly"
                  : typicalGap >= 12 && typicalGap <= 17 ? "fortnightly"
                  : typicalGap >= 6 && typicalGap <= 8 ? "weekly" : null;
    const last = sorted[sorted.length - 1].date.slice(0, 10);
    const stable = spread < 0.25;

    out.push({
      key,
      merchant: sorted[sorted.length - 1].merchant,
      category: sorted[sorted.length - 1].category,
      amount: round2(typicalAmount),
      total: round2(sum(amounts)),
      hits: sorted.length,
      gapDays: Math.round(typicalGap || 0),
      cadence,
      stable,
      confident: !!cadence && stable,
      lastSeen: last,
      nextDate: cadence
        ? addDaysISO(last, cadence === "weekly" ? 7 : cadence === "fortnightly" ? 14 : 30)
        : null,
      monthlyCost: cadence === "weekly" ? typicalAmount * 4.33
                 : cadence === "fortnightly" ? typicalAmount * 2.17
                 : cadence === "monthly" ? typicalAmount
                 : typicalAmount * (30.44 / Math.max(1, typicalGap || 30)),
    });
  }
  return out.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

/* ==================================================== debt strategies ==== */
/* Avalanche pays the highest rate first, snowball the smallest balance.
   With a single 0% debt they are identical — the comparison exists so that
   adding a real interest-bearing debt later answers the question properly. */
function debtStrategy(s = state, m = metrics(s), order = "avalanche", extra = 0) {
  const live = m.debts.filter((d) => d.outstanding > 0.01).map((d) => ({ ...d }));
  if (!live.length) return { months: [], payoffMonths: 0, totalInterest: 0, totalPaid: 0 };
  live.sort(order === "snowball"
    ? (a, b) => a.outstanding - b.outstanding
    : (a, b) => (b.apr - a.apr) || (a.outstanding - b.outstanding));

  const months = [];
  let guard = 0;
  let totalInterest = 0, totalPaid = 0;
  while (live.some((d) => d.outstanding > 0.01) && guard < 360) {
    guard++;
    let pool = sum(live, (d) => Math.min(d.minPayment, d.outstanding)) + extra;
    const row = { month: guard, payments: [], interest: 0 };
    for (const d of live) {
      if (d.outstanding <= 0.01) continue;
      const interest = round2(d.outstanding * (d.apr / 12));
      d.outstanding = round2(d.outstanding + interest);
      row.interest += interest;
      totalInterest += interest;
    }
    for (const d of live) {
      if (d.outstanding <= 0.01 || pool <= 0) continue;
      const pay = round2(Math.min(pool, d.outstanding));
      d.outstanding = round2(d.outstanding - pay);
      pool -= pay;
      totalPaid += pay;
      row.payments.push({ id: d.id, name: d.name, pay, left: d.outstanding });
    }
    row.remaining = round2(sum(live, (d) => d.outstanding));
    months.push(row);
  }
  return { months, payoffMonths: months.length, totalInterest: round2(totalInterest),
           totalPaid: round2(totalPaid), order, extra };
}

/* ========================================================== reporting ==== */
function monthReport(k, s = state, m = metrics(s)) {
  const inMonth = (d) => monthKey(d) === k;
  const tx = s.tx.filter((t) => t.counts && inMonth(t.date));
  const income = s.income.filter((i) => inMonth(i.date));
  const byCat = {};
  for (const t of tx) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const spend = sum(tx, (t) => t.amount);
  const inc = sum(income, (i) => i.amount);
  const byMerch = {};
  for (const t of tx) {
    const key = merchantKey(t.merchant) || t.merchant;
    byMerch[key] = byMerch[key] || { merchant: t.merchant, total: 0, count: 0 };
    byMerch[key].total += t.amount;
    byMerch[key].count++;
  }
  const dayCount = new Set(tx.map((t) => t.date.slice(0, 10))).size || 1;
  return {
    key: k, label: monthLabel(k), spend, income: inc, net: inc - spend,
    savingsRate: safeDiv(inc - spend, inc),
    categories: Object.entries(byCat).map(([cat, total]) => ({
      cat, total, share: safeDiv(total, spend) })).sort((a, b) => b.total - a.total),
    merchants: Object.values(byMerch).sort((a, b) => b.total - a.total),
    count: tx.length, daysWithSpend: dayCount, perDay: spend / dayCount,
    personal: sum(tx.filter((t) => t.split === "Personal"), (t) => t.amount),
    household: sum(tx.filter((t) => t.split !== "Personal"), (t) => t.amount),
  };
}

function allMonths(s = state) {
  return [...new Set(s.tx.map((t) => monthKey(t.date)))].sort();
}

/* ============================================================== search === */
function search(q, s = state, m = metrics(s)) {
  const needle = String(q || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const hit = (text) => String(text || "").toLowerCase().includes(needle);
  const out = [];
  for (const t of s.tx) {
    if (hit(t.merchant) || hit(t.note) || hit(t.category)) {
      out.push({ type: "Transaction", id: t.id, title: t.merchant, view: "money",
                 sub: `${shortDate(t.date)} · ${t.category}`, amount: t.amount });
    }
  }
  for (const o of s.obligations) {
    if (hit(o.name) || hit(o.note)) {
      out.push({ type: "Obligation", id: o.id, title: o.name, view: "more",
                 sub: `due ${longDate(o.due)}`, amount: o.amount });
    }
  }
  for (const g of s.goals) {
    if (hit(g.name) || hit(g.note)) {
      out.push({ type: "Goal", id: g.id, title: g.name, view: "plan",
                 sub: `by ${longDate(g.deadline)}`, amount: g.target || 0 });
    }
  }
  for (const h of s.holdings) {
    if (hit(h.name) || hit(h.house)) {
      out.push({ type: "Holding", id: h.id, title: h.name, view: "invest",
                 sub: h.house, amount: toAedWith(s.assumptions)(h.value, h.ccy) });
    }
  }
  for (const b of s.budget) {
    if (hit(b.line) || hit(b.note)) {
      out.push({ type: "Budget", id: b.id, title: b.line, view: "budget",
                 sub: b.group, amount: b.plan });
    }
  }
  return out.slice(0, 60);
}

/* ============================================================ rules ===== */
/* User rules beat built-in patterns, and the newest rule beats an older one,
   so a correction you make today always wins over a guess made last month. */
function classify(merchant, s = state) {
  const text = String(merchant || "").toLowerCase();
  for (let i = s.rules.length - 1; i >= 0; i--) {
    const r = s.rules[i];
    if (r.match && text.includes(String(r.match).toLowerCase())) {
      return { category: r.category, split: r.split || "Personal", ruleId: r.id };
    }
  }
  return { category: categorise(merchant), split: "Personal", ruleId: null };
}

/* Called when a transaction is recategorised by hand. It writes a rule only
   when the guess was actually wrong, and only once per merchant, so the rule
   list stays short enough to read. */
function learnRule(merchant, category, split, s = state) {
  const key = merchantKey(merchant);
  if (!key) return null;
  const guess = classify(merchant, s);
  if (guess.category === category && guess.split === split) return null;
  const existing = s.rules.find((r) => merchantKey(r.match) === key);
  if (existing) {
    existing.category = category;
    existing.split = split;
    existing.source = "learned";
    return existing;
  }
  const rule = { id: uid(), match: key, category, split, source: "learned" };
  s.rules.push(rule);
  return rule;
}
