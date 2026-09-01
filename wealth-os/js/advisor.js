/* ============================================================
   Wealth OS — the advisor
   Rules, not a chat box. Each one re-decides itself from the live position,
   so an item closes when the data says it is closed — never because someone
   ticked it off.
   ============================================================ */
"use strict";

/* Rules, not a chat box. Each one re-decides itself from the live position,
   so an item closes when the data says it is closed. */

function advice(m = metrics(), s = state) {
  const A = m.A;
  const sGlobal = () => s;
  const out = [];
  const add = (o) => out.push({ id: o.id, ...o });

  /* ---- urgent, this week ---- */
  add({
    id: "rent-gap", group: "Urgent", title: `Earn ${money(m.earnPerWeek)} a week and bank it`,
    open: m.rentGap > 0.01, impact: m.rentGap, effort: "High", by: m.rentDeadline,
    status: m.rentGap > 0.01 ? "OPEN" : "CLOSED",
    why: `Spendable cash of ${money(m.spendableNow)} plus ${money(m.inflowsBeforeDeadline)} of salary, less `
       + `${money(m.committedBeforeDeadline)} of bills, ${money(m.rentToFund)} still owed on the cheque and `
       + `the ${money(A.safetyBuffer)} buffer, leaves a living pool of ${money(m.livingPool)} against a `
       + `${money(m.minLivingNeed)} minimum. The gap is ${money(m.rentGap)} across ${m.daysToRentDeadline} `
       + `days. It closes through income, not cuts — the daily cap is already at the survival floor.`,
  });

  add({
    id: "rent-ringfence", group: "Urgent", title: "Do not touch the rent vault in FAB 4002",
    open: m.rentHeld > 0, impact: m.rentHeld, effort: "None", by: m.rentDeadline,
    status: m.rentHeld > 0 ? "IN FORCE" : "RELEASED",
    why: `Every dirham of the ${money(m.rentHeld)} in FAB 4002 is committed to the October cheque — the whole `
       + `balance, not part of it. Money accumulates there, then moves to FAB 4001 shortly before the 22nd. `
       + `Treating that balance as available is the single most likely way this plan fails, and a refund that `
       + `never lands is the second.`,
  });
  add({
    id: "tabby-min", group: "Urgent", title: "Let the no-fee minimum run on 3 Sep — do not pay the full statement",
    open: !s.debtPayments[0].paid, impact: A.tabbyFullAug - A.tabbyMinSep, effort: "None", by: "2026-09-03",
    status: s.debtPayments[0].paid ? "DONE" : "SCHEDULED",
    why: `Paying the full August statement costs ${money(A.tabbyFullAug - A.tabbyMinSep)} more in the month you can `
       + `least afford it, and saves no fee at all — Tabby is free while the minimum lands on time.`,
  });
  add({
    id: "salary-confirm", group: "Urgent", title: "Confirm the AED 2,906.70 salary actually credits",
    open: (s.income.find((i) => i.id === "i6") || {}).status === "estimate",
    impact: 2906.70, effort: "Low", by: "2026-08-26",
    status: (s.income.find((i) => i.id === "i6") || {}).status === "estimate" ? "UNCONFIRMED" : "CONFIRMED",
    why: "Every downstream number assumes it arrives. Until it is on a statement it is a hope, and this app "
       + "deliberately refuses to call it cash.",
  });

  /* ---- spending ---- */
  const dining = m.budget.find((b) => b.id === "b6") || { rate: 0, plan: 0 };
  add({
    id: "dining", group: "Spending", title: "Bring dining back to the plan",
    open: dining.rate > dining.plan, impact: Math.max(0, dining.rate - dining.plan), effort: "Medium", by: "2026-09-30",
    status: dining.rate > dining.plan ? "OVER PLAN" : "ON PLAN",
    why: `Dining is running at ${money(dining.rate)} a month against a plan of ${money(dining.plan)}. It is the `
       + `largest genuinely controllable category in the ledger and the fastest route to closing the gap above.`,
  });
  add({
    id: "telecom", group: "Spending", title: "Cancel one of the two telecom lines",
    open: true, impact: 323.95, effort: "Low", by: "2026-09-30", status: "TWO LINES ACTIVE",
    why: "du and Etisalat are both paid every month for one person. Cancelling the smaller line is a permanent "
       + "saving that needs no willpower at all — the best kind.",
  });
  const capDaily = A.dailyCap;
  add({
    id: "burn", group: "Spending", title: "Bring the daily burn under the damage-control cap",
    open: m.dailyBurn > capDaily, impact: Math.max(0, (m.dailyBurn - capDaily) * 30.44), effort: "High", by: "2026-09-25",
    status: m.dailyBurn > capDaily ? "ABOVE CAP" : "WITHIN CAP",
    why: `The plan caps living costs at ${money(capDaily)} a day. The confirmed ledger shows ${money(m.dailyBurn)} a `
       + `day on food, fuel and shops. Over eight weeks that difference is roughly the size of the rent shortfall.`,
  });
  add({
    id: "netflix", group: "Spending", title: "Cancel the Netflix retry properly",
    open: true, impact: 35, effort: "None", by: "2026-09-01", status: "OPEN",
    why: "The AED 35 charge was declined, not paid. Leaving it to retry against an account holding rent money is "
       + "the smallest and most avoidable own goal in the file.",
  });
  const fees = m.categories.find((c) => c.cat === "Bank Fees");
  add({
    id: "fees", group: "Spending", title: "Stop paying transfer fees",
    open: !!(fees && fees.total > 0), impact: (fees ? fees.total : 0) * m.runRate, effort: "Low", by: "2026-09-30",
    status: fees && fees.total > 0 ? "LEAKING" : "CLEAN",
    why: "Small, but a fee buys nothing. The ledger shows money moving between your own accounts several times a "
       + "week; batch it into one weekly transfer instead.",
  });
  const unrec = m.categories.find((c) => c.cat === "Unreconciled");
  add({
    id: "unreconciled", group: "Spending", title: "Give every unreconciled movement a name",
    open: !!(unrec && unrec.total > 0), impact: unrec ? unrec.total : 0, effort: "Low", by: "2026-09-07",
    status: unrec && unrec.total > 0 ? "OPEN" : "CLEAN",
    why: "A control item rather than a money item. A ledger where every dirham has a merchant is a ledger you can "
       + "trust on the day it matters.",
  });

  /* ---- structure ---- */
  add({
    id: "rent-accrual", group: "Structure", title: "Start a monthly rent accrual",
    open: m.rentToFund > 0.01, impact: A.rentCheque * A.rentChequesPerYear / 12, effort: "Medium", by: "2026-11-01",
    status: m.rentToFund > 0.01 ? "NOT STARTED" : "FUNDED",
    why: `The cheque is not an emergency, it is a subscription with a known date. Moving ${money(A.rentCheque * A.rentChequesPerYear / 12)} `
       + `into FAB 4002 on payday turns every future cheque from a crisis into a transfer. This is the highest-value `
       + `structural change available to you.`,
  });
  add({
    id: "lease-cadence", group: "Structure", title: "Confirm how many rent cheques the lease requires",
    open: true, impact: 0, effort: "None", by: "2026-09-07", status: "ASSUMED — CONFIRM",
    why: `The rent accrual, the essentials ratio and the emergency-fund target all rest on ${A.rentChequesPerYear} `
       + `cheques a year. That is an assumption, not a fact, and it is one phone call to settle.`,
  });
  add({
    id: "emergency-1k", group: "Structure", title: "Get the emergency fund to AED 1,000",
    open: m.emergency < 1000, impact: Math.max(0, 1000 - m.emergency), effort: "Medium", by: "2027-03-31",
    status: m.emergency < 1000 ? "UNFUNDED" : "REACHED",
    why: `${money(m.emergency)} is not a buffer. Until there is a real one, every unexpected cost lands on the card `
       + `or on the rent money.`,
  });
  add({
    id: "one-account", group: "Structure", title: "Move to one spending account with a weekly allowance",
    open: true, impact: 0, effort: "Low", by: "2026-10-01", status: "RECOMMENDED",
    why: "The ledger shows constant small transfers out of the rent account. Each one is a decision, and each one "
       + "erodes the ring-fence. Make one weekly transfer, then spend only what landed.",
  });

  /* ---- investing ---- */
  const brokerCash = m.holdings.find((h) => h.cls === "Broker cash");
  add({
    id: "sweep", group: "Investing", title: "Sweep the idle rupee cash into the next SIP",
    open: !!(brokerCash && brokerCash.aed > 1), impact: brokerCash ? brokerCash.aed : 0, effort: "None", by: "2026-09-10",
    status: brokerCash && brokerCash.aed > 1 ? "IDLE" : "SWEPT",
    why: "Settlement cash in the broker account earns nothing. It is small, but sweeping it costs nothing and it is "
       + "the only free money in the file.",
  });
  add({
    id: "concentration", group: "Investing", title: "Reduce single fund-house concentration",
    open: m.houseConcentration > 0.80, impact: Math.max(0, (m.houseConcentration - 0.80) * m.invested),
    effort: "Medium", by: "2027-03-31",
    status: m.houseConcentration > 0.80 ? "CONCENTRATED" : "DIVERSIFIED",
    why: `${pct(m.houseConcentration)} of the portfolio sits with ${m.topHouse[0]}. Market risk is diversified; `
       + `operational and manager risk is not. Fix it by directing future instalments elsewhere — never by selling, `
       + `which costs exit load and tax for nothing.`,
  });
  add({
    id: "sip-hold", group: "Investing", title: "Decide on the SIP on 8 Sep, not before",
    open: m.rentGap > 0.01, impact: A.sipAed * 2, effort: "None", by: "2026-09-08",
    status: m.rentGap > 0.01 ? "CONDITIONAL" : "SAFE TO CONTINUE",
    why: "A paused SIP is cheap to restart; a missed rent cheque is not. But pausing early, while the gap might "
       + "still be closed by earning, gives up compounding for nothing. Decide on real balances.",
  });
  const amana = m.holdings.find((h) => h.cls === "Global equity");
  add({
    id: "amana", group: "Investing", title: "Consolidate the 41 open Amana positions",
    open: !!(amana && amana.units > 15), impact: 20.47 * A.aedPerUsd, effort: "Medium", by: "2026-09-30",
    status: amana && amana.units > 15 ? "TOO MANY POSITIONS" : "TIDY",
    why: `Forty-one open positions on an account worth ${money(amana ? amana.aed : 0)} is a lot of moving parts, and `
       + `the statement shows floating and overnight fees quietly working against you. Fewer, larger, longer-held `
       + `positions cost less to carry.`,
  });
  const withStep = futureValue(m.invested, m.monthly * 12, m.blended, A.sipStepUp, A.horizonYears);
  const noStep   = futureValue(m.invested, m.monthly * 12, m.blended, 0, A.horizonYears);
  add({
    id: "stepup", group: "Investing", title: "Raise the SIP automatically every year",
    open: true, impact: withStep - noStep, effort: "None", by: "2027-01-01",
    status: A.sipStepUp > 0 ? "IN PLAN" : "NOT SET",
    why: `A ${pct(A.sipStepUp, 0)} annual step-up is worth ${money0(withStep - noStep)} more at the `
       + `${A.horizonYears}-year horizon than a flat contribution. It costs nothing today because the increase comes `
       + `out of next year's raise.`,
  });

  /* ---- cashflow: the things only a day-by-day projection can see ---- */
  const fc = forecast(sGlobal(), m);
  add({
    id: "runway", group: "Cashflow", title: "Cash runs out before the next payday",
    open: fc.firstNegative != null,
    impact: fc.firstNegative ? Math.abs(fc.minBalance) : 0,
    effort: "High", by: fc.firstNegative || fc.minDate,
    status: fc.firstNegative ? `NEGATIVE IN ${fc.daysUntilNegative} DAYS` : "SOLVENT",
    why: fc.firstNegative
      ? `The day-by-day forecast turns negative on ${longDate(fc.firstNegative)} and bottoms out at `
        + `${money(fc.minBalance)} on ${longDate(fc.minDate)}. That is spendable cash only — the rent `
        + `vault is already excluded. Something has to move before that date: an inflow, a deferred `
        + `bill, or a lower burn rate.`
      : `The forecast stays positive for the whole ${fc.days}-day window, bottoming at `
        + `${money(fc.minBalance)} on ${longDate(fc.minDate)}. Keep it that way.`,
  });
  add({
    id: "minbalance", group: "Cashflow", title: "Protect the thinnest day in the forecast",
    open: fc.minBalance < 500,
    impact: Math.max(0, 500 - fc.minBalance), effort: "Medium", by: fc.minDate,
    status: fc.minBalance < 500 ? "THIN" : "COMFORTABLE",
    why: `The forecast's lowest point is ${money(fc.minBalance)} on ${longDate(fc.minDate)}. A buffer `
       + `under AED 500 leaves no room for a bill arriving a day early, and that is exactly how a `
       + `late fee happens on a debt that is otherwise free.`,
  });

  /* ---- subscriptions and repeat spending ---- */
  const rec = detectRecurring(sGlobal(), m).filter((r) => r.confident);
  const recMonthly = sum(rec, (r) => r.monthlyCost);
  add({
    id: "subs", group: "Spending", title: "Review what renews automatically",
    open: recMonthly > 0, impact: recMonthly, effort: "Low", by: "2026-09-30",
    status: rec.length ? `${rec.length} DETECTED` : "NONE FOUND",
    why: rec.length
      ? `${rec.length} merchants repeat on a regular cadence, costing about ${money(recMonthly)} a month `
        + `— roughly ${money0(recMonthly * 12)} a year. Recurring costs are the cheapest thing to cut `
        + `because you only decide once.`
      : "Nothing in the ledger repeats on a stable cadence yet. Import more history and this fills in.",
  });

  /* ---- income ---- */
  add({
    id: "income-concentration", group: "Structure", title: "Build a second income that is not a favour",
    open: m.incomeConcentration > 0.75, impact: 0, effort: "High", by: "2027-06-30",
    status: m.incomeConcentration > 0.75 ? `${pct(m.incomeConcentration, 0)} FROM ONE SOURCE` : "DIVERSIFIED",
    why: `${pct(m.incomeConcentration, 0)} of income comes from one employer. The ticket dealing shows you `
       + `can earn outside the salary, but it is irregular and this plan deliberately does not count on it. `
       + `Every recommendation on this page is about spending less; this is the only one about earning more, `
       + `and over a decade it matters more than all the others combined.`,
  });

  add({
    id: "grocery-transfer", group: "Structure",
    title: "Plan for the grocery bill moving across on 15 September",
    open: true, impact: A.groceryTransfer, effort: "Medium", by: A.partnerLastWorkingDay,
    status: todayISO() >= A.partnerLastWorkingDay ? "IN EFFECT" : "COMING",
    why: `Her last working day is ${longDate(A.partnerLastWorkingDay)}, and about `
       + `${money(A.groceryTransfer)} a month of groceries transfers to this household from then. It is `
       + `certain, it recurs, and it lands in the middle of the rent window — which makes it the one `
       + `forecast change on this list that is not a choice. Get the real figure when it firms up; the `
       + `midpoint is standing in for it.`,
  });
  add({
    id: "hr-maternity", group: "Structure", title: "Confirm with HR that maternity is not excluded",
    open: true, impact: 0, effort: "None", by: addDaysISO(todayISO(), 14),
    status: "UNCONFIRMED",
    why: "Her Essential Benefits Plan is active with no waiting period, and the mandated sub-limit is "
       + "AED 7,000 for a normal delivery with a 10% co-payment. Whether maternity is excluded on this "
       + "specific tier is a five-minute call — and the difference between a sub-limit you assumed and "
       + "one you confirmed is thousands of dirhams. Worth doing regardless of timing.",
  });

  /* ---- housekeeping the app can check for itself ---- */
  const st = sGlobal();
  const lastBackup = st.settings.lastBackup;
  add({
    id: "backup", group: "Structure", title: "Export a backup",
    open: !lastBackup || diffDays(lastBackup.slice(0, 10), todayISO()) > 30,
    impact: 0, effort: "None", by: addDaysISO(todayISO(), 7),
    status: lastBackup ? `LAST ${longDate(lastBackup)}` : "NEVER",
    why: "Everything here lives in this browser's storage. Clearing site data, switching phone or using "
       + "a private window loses it. One export a month is the whole insurance policy.",
  });

  /* Impacts are not all the same kind of number: some are a monthly saving,
     some a one-off amount, one is a twenty-year total. Rank on a common
     monthly-equivalent so a lifetime figure never outranks the rent. */
  const SCALE = {
    "gap-sep": "once", "rent-ringfence": "once", "tabby-min": "once", "salary-confirm": "once",
    dining: "month", telecom: "month", burn: "month", netflix: "month", fees: "month",
    unreconciled: "once", "rent-accrual": "month", "lease-cadence": "once",
    "emergency-1k": "once", "one-account": "once", sweep: "once", concentration: "once",
    "sip-hold": "month", amana: "once", stepup: "life",
    runway: "once", minbalance: "once", subs: "month",
    "income-concentration": "once", backup: "once",
    "rent-gap": "once", "grocery-transfer": "month", "hr-maternity": "once",
  };
  const perMonth = (x) => x.scale === "life" ? x.impact / (A.horizonYears * 12)
                        : x.scale === "once" ? x.impact / 12
                        : x.impact;
  const rank = (x) => x.group === "Urgent" ? 1
                    : perMonth(x) >= 200 ? 2
                    : perMonth(x) >= 40 ? 3 : 4;
  return out
    .map((x) => ({ ...x, scale: SCALE[x.id] || "once", dismissed: s.dismissed.includes(x.id) }))
    .map((x) => ({ ...x, priority: rank(x), monthly: perMonth(x) }))
    .sort((a, b) => (a.priority - b.priority) || (b.monthly - a.monthly));
}

function impactUnit(r) {
  return r.scale === "month" ? "a month" : r.scale === "life" ? "over the horizon" : "one-off";
}

function verdict(m) {
  return `Health score ${m.health.toFixed(0)} out of 100, grade ${m.grade}. Net worth is ${money(m.netWorth)}, of `
       + `which ${money(m.invested)} actually compounds. The balance sheet is not the problem — the calendar is. `
       + `${money(m.rentToFund)} of rent still has to be found before 21 October, ${money(m.extraCashNeeded)} before `
       + `15 September, and free cash outside rent and emergency stands at ${money(m.looseCash)}. Do four things in `
       + `order: hold the rent ring-fence, close the September gap by earning or by pausing the SIP, let the Tabby `
       + `minimums run to zero by 3 November without ever paying a fee, and start accruing rent monthly so October `
       + `2027 is a transfer instead of a crisis. Then, and only then, raise the SIP.`;
}
