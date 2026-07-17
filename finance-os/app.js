/* ============================================================
   Finance OS — AI-powered Financial Operating System
   Single-owner, local-first, refresh-on-demand ONLY.
   No background sync. No polling. Data updates when YOU press Refresh.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   0. Tiny helpers
------------------------------------------------------------ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (arr, f = (x) => x) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);

const CCY = "AED";
function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-US");
}
function money(n) { return CCY + " " + fmt(n); }
function signMoney(n) { return (n >= 0 ? "+" : "−") + CCY + " " + fmt(Math.abs(n)); }
function compact(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K";
  return String(Math.round(v));
}
function pct(n, d = 1) { return (Number(n) || 0).toFixed(d) + "%"; }

function toLocalISO(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todayISO() { return toLocalISO(new Date()); }
function monthKey(d) { return String(d).slice(0, 7); }
function thisMonth() { return todayISO().slice(0, 7); }
function addMonthsKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function shortDate(iso) {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
function daysFromToday(iso) {
  return Math.round((new Date(iso) - new Date(todayISO())) / 86400000);
}
function parseFlexDate(s) {
  if (!s) return null;
  s = String(s).trim().replace(/["']/g, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); // dd/mm/yyyy (UAE default)
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    if (Number(mo) > 12 && Number(d) <= 12) { const t = d; d = mo; mo = t; } // mm/dd fallback
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const t = new Date(s);
  return isNaN(t) ? null : t.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------
   1. Categories & the AI transaction engine (rules + learning)
------------------------------------------------------------ */
const CATEGORIES = [
  "Income", "Business Income", "Investment Income",
  "Rent", "Groceries", "Food Delivery", "Dining", "Transport", "Fuel",
  "Utilities", "Telecom", "Insurance", "Subscriptions", "Shopping",
  "Entertainment", "Health", "Education", "Travel", "Family",
  "Fees & Charges", "Transfers", "Other"
];
const INCOME_CATS = ["Income", "Business Income", "Investment Income"];
const DISCRETIONARY = ["Food Delivery", "Dining", "Entertainment", "Subscriptions", "Shopping"];

const RULES = [
  [/salary|payroll|wages/i, "Income"],
  [/dividend|coupon|interest income|profit share/i, "Investment Income"],
  [/mendtech|mendonca/i, "Business Income"],
  [/talabat|deliveroo|zomato|careem food|noon food|instashop/i, "Food Delivery"],
  [/carrefour|lulu|spinneys|union coop|choithram|west zone|grandiose|viva\b/i, "Groceries"],
  [/mcdonald|kfc|starbucks|costa|tim horton|restaurant|cafe|caffe|burger|pizza|shawarma|eatery/i, "Dining"],
  [/adnoc|enoc|eppco|petrol|fuel/i, "Fuel"],
  [/salik|rta\b|careem|uber|taxi|metro|parking|darb/i, "Transport"],
  [/dewa|sewa|addc|fewa|empower|chiller|electricity|water bill/i, "Utilities"],
  [/etisalat|\bdu\b|du telecom|virgin mobile/i, "Telecom"],
  [/netflix|spotify|youtube premium|icloud|apple\.com\/bill|google one|prime video|osn|shahid|anghami|chatgpt|claude\.ai|anthropic/i, "Subscriptions"],
  [/amazon|noon(?!.?food)|namshi|shein|sharaf dg|ikea|ace hardware|dragon mart/i, "Shopping"],
  [/rent\b|ejari|landlord/i, "Rent"],
  [/insurance|takaful|sukoon|daman|orient ins/i, "Insurance"],
  [/pharmacy|clinic|hospital|dental|aster|nmc|mediclinic|life pharmacy/i, "Health"],
  [/school|nursery|tuition|udemy|coursera/i, "Education"],
  [/cinema|vox|reel|novo|leisure|theme park|img world|ferrari world/i, "Entertainment"],
  [/flydubai|emirates air|etihad|air arabia|airbnb|booking\.com|hotel/i, "Travel"],
  [/bank charge|vat\b|fee\b|charges|commission/i, "Fees & Charges"],
  [/transfer|tt\b|remit|western union|lulu exchange|al ansari/i, "Transfers"],
  [/binance|bybit|crypto|mutual fund|zerodha|groww|amana|sarwa|stake\b/i, "Investment Income"],
];

function merchantKey(desc) {
  return String(desc || "").toLowerCase().replace(/[0-9#*]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 2).join(" ");
}
function categorize(desc, amount) {
  const key = merchantKey(desc);
  const learned = state && state.settings ? state.settings.catOverrides[key] : null;
  if (learned) return learned;
  for (const [re, cat] of RULES) if (re.test(desc)) return cat;
  return amount > 0 ? "Income" : "Other";
}
function learnCategory(desc, cat) {
  const key = merchantKey(desc);
  if (key) { state.settings.catOverrides[key] = cat; }
}

/* ------------------------------------------------------------
   2. State
------------------------------------------------------------ */
const LS_KEY = "mts-finance-os-v1";
let state = null;

function blankState() {
  return {
    meta: { created: todayISO(), demo: false, lastRefresh: null },
    accounts: [],      // {id,name,type:cash|bank|credit|loan,balance}  credit/loan = amount owed (positive)
    assets: [],        // {id,name,type:property|vehicle|other,value}
    investments: [],   // {id,name,platform,invested,value}
    transactions: [],  // {id,date,desc,amount(+in/-out),category,hash,src}
    goals: [],         // {id,name,target,saved}
    biz: {
      cashBalance: 0,
      receivables: [],   // {id,client,amount,due}
      upcoming: [],      // {id,name,amount,due}
      txns: []           // {id,date,desc,amount(+received/-paid)}
    },
    snapshots: [],     // {date, netWorth, cash, invest, assets, liab, bizCash, monthSpend}
    insights: [],
    brief: null,
    cfoLog: [],        // {role:'user'|'cfo', text, src}
    settings: { theme: "dark", apiKey: "", catOverrides: {} }
  };
}

function seedState() {
  const s = blankState();
  s.meta.demo = true;
  const rnd = (i, base, spread) => Math.round(base + (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * spread);

  s.accounts = [
    { id: uid(), name: "Emirates NBD — Personal", type: "bank", balance: 18500 },
    { id: uid(), name: "Cash wallet", type: "cash", balance: 1200 },
    { id: uid(), name: "ENBD Credit Card", type: "credit", balance: 3400 },
    { id: uid(), name: "Car Loan", type: "loan", balance: 28000 },
  ];
  s.assets = [
    { id: uid(), name: "Family car", type: "vehicle", value: 62000 },
  ];
  s.investments = [
    { id: uid(), name: "Crypto portfolio", platform: "Binance", invested: 15000, value: 18250 },
    { id: uid(), name: "Indian mutual funds", platform: "Mutual Funds", invested: 22000, value: 25400 },
    { id: uid(), name: "US stocks", platform: "Amana", invested: 8000, value: 7620 },
  ];
  s.goals = [
    { id: uid(), name: "Emergency fund", target: 30000, saved: 12000 },
    { id: uid(), name: "Property down payment", target: 150000, saved: 23000 },
    { id: uid(), name: "Investment portfolio", target: 100000, saved: 51270 },
  ];

  // Personal transactions — 3 months of realistic UAE life
  const tm = thisMonth();
  const months = [addMonthsKey(tm, -2), addMonthsKey(tm, -1), tm];
  let i = 0;
  const T = (mo, day, desc, amount) => {
    const date = `${mo}-${String(day).padStart(2, "0")}`;
    if (date > todayISO()) return;
    const t = { id: uid() + i++, date, desc, amount, category: "", src: "seed" };
    t.category = categorize(desc, amount);
    t.hash = txHash(t);
    s.transactions.push(t);
  };
  months.forEach((mo, mi) => {
    T(mo, 1, "SALARY TRANSFER", 12000);
    T(mo, 2, "RENT EJARI PAYMENT", -4500);
    T(mo, 3, "DEWA BILL", -rnd(mi + 1, 420, 90));
    T(mo, 4, "ETISALAT MOBILE", -rnd(mi + 2, 300, 40));
    T(mo, 5, "CARREFOUR MALL OF EMIRATES", -rnd(mi + 3, 520, 160));
    T(mo, 7, "TALABAT ORDER", -rnd(mi + 4, 95, 40));
    T(mo, 8, "ADNOC STATION 118", -rnd(mi + 5, 210, 60));
    T(mo, 9, "NETFLIX.COM", -39);
    T(mo, 10, "SPOTIFY AB", -21);
    T(mo, 11, "LULU HYPERMARKET", -rnd(mi + 6, 340, 120));
    T(mo, 12, "SALIK RECHARGE", -50);
    T(mo, 13, "TALABAT ORDER", -rnd(mi + 7, 85, 30));
    T(mo, 14, "STARBUCKS JBR", -rnd(mi + 8, 48, 20));
    T(mo, 15, "AMAZON.AE", -rnd(mi + 9, 260, 180));
    T(mo, 16, "CAR INSURANCE TAKAFUL", mi === 0 ? -2800 : 0);
    T(mo, 17, "LIFE PHARMACY", -rnd(mi + 10, 120, 70));
    T(mo, 18, "ADNOC STATION 204", -rnd(mi + 11, 190, 50));
    T(mo, 19, "VOX CINEMAS", -rnd(mi + 12, 110, 50));
    T(mo, 20, "TALABAT ORDER", -rnd(mi + 13, 105, 45));
    T(mo, 21, "CARREFOUR CITY CENTRE", -rnd(mi + 14, 410, 140));
    T(mo, 23, "SHAWARMA STATION", -rnd(mi + 15, 55, 20));
    T(mo, 24, "MENDTECH OWNER DRAW", mi === 1 ? 5000 : 0);
    T(mo, 26, "DIVIDEND CREDIT — MF", mi === 2 ? 380 : 0);
    T(mo, 27, "NOON.COM ORDER", -rnd(mi + 16, 180, 120));
  });
  s.transactions = s.transactions.filter((t) => t.amount !== 0);

  // Mendtech (business) — simple cash flow
  s.biz.cashBalance = 42500;
  s.biz.receivables = [
    { id: uid(), client: "Al Barsha villa — AMC renewal", amount: 8500, due: addDaysISO(-6) },
    { id: uid(), client: "Marina apartment renovation", amount: 12000, due: addDaysISO(10) },
    { id: uid(), client: "JVC building — plumbing contract", amount: 6400, due: addDaysISO(24) },
  ];
  s.biz.upcoming = [
    { id: uid(), name: "Team salaries", amount: 15000, due: monthEndISO() },
    { id: uid(), name: "Van insurance renewal", amount: 2800, due: addDaysISO(18) },
    { id: uid(), name: "Trade license renewal", amount: 6200, due: addDaysISO(41) },
  ];
  months.forEach((mo, mi) => {
    const B = (day, desc, amount) => {
      const date = `${mo}-${String(day).padStart(2, "0")}`;
      if (date > todayISO()) return;
      s.biz.txns.push({ id: uid() + i++, date, desc, amount });
    };
    B(3, "AMC invoice collected", rnd(mi + 20, 14000, 6000));
    B(9, "Handyman jobs — cash", rnd(mi + 21, 4200, 1800));
    B(12, "AC service contract", rnd(mi + 22, 6800, 2500));
    B(6, "Team salaries", -15000);
    B(10, "Spare parts & materials", -rnd(mi + 23, 5200, 2200));
    B(15, "Fuel & Salik (vans)", -rnd(mi + 24, 1400, 500));
    B(20, "Marketing & misc", -rnd(mi + 25, 900, 500));
  });

  // Snapshot history (10 weekly points ending near current position)
  const m = computeMetricsFor(s);
  for (let w = 9; w >= 0; w--) {
    const d = new Date(); d.setDate(d.getDate() - w * 7);
    const factor = 1 - w * 0.012 - (((w * 7919) % 97) / 97) * 0.008;
    s.snapshots.push({
      date: toLocalISO(d),
      netWorth: Math.round(m.netWorth * factor),
      cash: Math.round(m.cash * (1 - w * 0.01)),
      invest: Math.round(m.investValue * (1 - w * 0.018)),
      assets: m.assetsTotal,
      liab: Math.round(m.liabilities * (1 + w * 0.004)),
      bizCash: Math.round(s.biz.cashBalance * (1 - w * 0.009)),
      monthSpend: 0
    });
  }
  return s;
}
function addDaysISO(days) { const d = new Date(); d.setDate(d.getDate() + days); return toLocalISO(d); }
function monthEndISO() { const d = new Date(); return toLocalISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function txHash(t) { return [t.date, Math.round(t.amount * 100), merchantKey(t.desc)].join("|"); }

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { state = JSON.parse(raw); return; }
  } catch (e) { console.warn("state load failed", e); }
  state = seedState();
  saveState();
}
let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { console.error("save failed", e); }
  }, 120);
}

/* ------------------------------------------------------------
   3. Metrics engine
------------------------------------------------------------ */
function computeMetricsFor(s) {
  const cash = sum(s.accounts.filter((a) => a.type === "bank" || a.type === "cash"), (a) => a.balance);
  const creditDebt = sum(s.accounts.filter((a) => a.type === "credit"), (a) => a.balance);
  const loans = sum(s.accounts.filter((a) => a.type === "loan"), (a) => a.balance);
  const liabilities = creditDebt + loans;
  const investValue = sum(s.investments, (i) => i.value);
  const investCost = sum(s.investments, (i) => i.invested);
  const assetsTotal = sum(s.assets, (a) => a.value);
  const bizCash = Number(s.biz.cashBalance) || 0;
  const netWorth = cash + investValue + assetsTotal + bizCash - liabilities;

  const tm = thisMonth();
  const txThis = s.transactions.filter((t) => monthKey(t.date) === tm);
  const monthIncome = sum(txThis.filter((t) => t.amount > 0), (t) => t.amount);
  const monthSpend = -sum(txThis.filter((t) => t.amount < 0), (t) => t.amount);
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthSpend) / monthIncome) * 100 : 0;

  // trailing 3 full months average spend / savings
  const trail = [1, 2, 3].map((k) => addMonthsKey(tm, -k));
  const trailSpend = trail.map((mo) => -sum(s.transactions.filter((t) => monthKey(t.date) === mo && t.amount < 0), (t) => t.amount));
  const trailIncome = trail.map((mo) => sum(s.transactions.filter((t) => monthKey(t.date) === mo && t.amount > 0), (t) => t.amount));
  const usable = trailSpend.filter((v) => v > 0).length || 1;
  const avgSpend = sum(trailSpend) / usable || monthSpend || 1;
  const avgSavings = (sum(trailIncome) - sum(trailSpend)) / usable;

  // business
  const bizThis = s.biz.txns.filter((t) => monthKey(t.date) === tm);
  const bizIn = sum(bizThis.filter((t) => t.amount > 0), (t) => t.amount);
  const bizOut = -sum(bizThis.filter((t) => t.amount < 0), (t) => t.amount);
  const bizTrailOut = trail.map((mo) => -sum(s.biz.txns.filter((t) => monthKey(t.date) === mo && t.amount < 0), (t) => t.amount));
  const bizUse = bizTrailOut.filter((v) => v > 0).length || 1;
  const bizBurn = sum(bizTrailOut) / bizUse || bizOut || 1;
  const receivablesTotal = sum(s.biz.receivables, (r) => r.amount);
  const overdue = s.biz.receivables.filter((r) => daysFromToday(r.due) < 0);
  const upcoming60 = sum(s.biz.upcoming.filter((u) => daysFromToday(u.due) <= 60), (u) => u.amount);
  // keep the larger of specific planned costs vs statistical burn (they overlap — don't double count)
  const safeWithdraw = Math.max(0, bizCash - Math.max(upcoming60, bizBurn * 1.5));
  const runwayMonths = bizBurn > 0 ? bizCash / bizBurn : 99;

  const pnl = investValue - investCost;
  const pnlPct = investCost > 0 ? (pnl / investCost) * 100 : 0;
  const emergencyMonths = avgSpend > 0 ? cash / avgSpend : 0;

  return {
    cash, creditDebt, loans, liabilities, investValue, investCost, pnl, pnlPct,
    assetsTotal, bizCash, netWorth, monthIncome, monthSpend, savingsRate,
    avgSpend, avgSavings, bizIn, bizOut, bizBurn, receivablesTotal,
    overdueCount: overdue.length, overdueTotal: sum(overdue, (r) => r.amount),
    upcoming60, safeWithdraw, runwayMonths, emergencyMonths
  };
}
const M = () => computeMetricsFor(state);

function spendByCategory(mo) {
  const map = {};
  state.transactions.forEach((t) => {
    if (monthKey(t.date) === mo && t.amount < 0) map[t.category] = (map[t.category] || 0) - t.amount;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}
const SUB_ELIGIBLE = ["Subscriptions", "Telecom", "Entertainment", "Insurance", "Fees & Charges", "Other"];
function detectSubscriptions() {
  const byKey = {};
  state.transactions.forEach((t) => {
    if (t.amount >= 0) return;
    const k = merchantKey(t.desc);
    (byKey[k] = byKey[k] || []).push(t);
  });
  const subs = [];
  Object.entries(byKey).forEach(([k, list]) => {
    const cat = list[0].category;
    const catSub = cat === "Subscriptions";
    if (!catSub && !SUB_ELIGIBLE.includes(cat)) return; // rent/groceries/fuel etc. are recurring, not subscriptions
    const months = new Set(list.map((t) => monthKey(t.date)));
    const avg = -sum(list, (t) => t.amount) / list.length;
    const similar = list.every((t) => Math.abs(-t.amount - avg) <= Math.max(3, avg * 0.05));
    if (catSub || (months.size >= 2 && similar)) subs.push({ name: list[0].desc, monthly: Math.round(avg), n: months.size });
  });
  return subs.sort((a, b) => b.monthly - a.monthly);
}

/* ------------------------------------------------------------
   4. Refresh pipeline (ONLY place data is re-evaluated)
------------------------------------------------------------ */
function healthScore(m) {
  let sc = 0;
  sc += clamp(m.savingsRate / 30, 0, 1) * 25;                    // savings rate up to 30%
  sc += clamp(m.emergencyMonths / 6, 0, 1) * 25;                 // 6 months buffer
  const debtRatio = m.netWorth + m.liabilities > 0 ? m.liabilities / (m.netWorth + m.liabilities) : 1;
  sc += clamp(1 - debtRatio / 0.5, 0, 1) * 20;                   // <50% leverage
  const alloc = state.investments.map((i) => i.value);
  const maxShare = m.investValue > 0 ? Math.max(...alloc, 0) / m.investValue : 0;
  sc += (m.investValue > 0 ? clamp(1 - (maxShare - 0.4) / 0.6, 0, 1) : 0.4) * 15;  // diversification
  sc += clamp(m.runwayMonths / 6, 0, 1) * 15;                    // business runway
  return Math.round(sc);
}

function generateInsights(m, prev) {
  const out = [];
  const push = (type, ic, html) => out.push({ type, ic, html });

  if (prev) {
    const d = m.netWorth - prev.netWorth;
    if (Math.abs(d) > 0)
      push(d >= 0 ? "opp" : "risk", d >= 0 ? "▲" : "▼",
        `Net worth ${d >= 0 ? "grew" : "fell"} <b>${signMoney(d)}</b> since last refresh (${shortDate(prev.date)}).`);
  }
  if (m.emergencyMonths < 3)
    push("risk", "⚠", `Emergency buffer covers only <b>${m.emergencyMonths.toFixed(1)} months</b> of spending — target 3–6 months.`);
  if (m.overdueCount > 0)
    push("risk", "⏰", `<b>${m.overdueCount} overdue invoice${m.overdueCount > 1 ? "s" : ""}</b> worth ${money(m.overdueTotal)} — chase payment this week.`);
  if (m.runwayMonths < 3)
    push("risk", "🏢", `Mendtech runway is <b>${m.runwayMonths.toFixed(1)} months</b> at current burn (${money(m.bizBurn)}/mo).`);
  const maxInv = state.investments.slice().sort((a, b) => b.value - a.value)[0];
  if (maxInv && m.investValue > 0 && maxInv.value / m.investValue > 0.45)
    push("risk", "◮", `Concentration risk: <b>${esc(maxInv.platform)}</b> is ${pct((maxInv.value / m.investValue) * 100, 0)} of your portfolio.`);

  const subs = detectSubscriptions();
  const subTotal = sum(subs, (s2) => s2.monthly);
  if (subTotal > 0)
    push("action", "↻", `Subscriptions cost <b>${money(subTotal)}/month</b> (${subs.length} services). Review for cuts.`);
  const disc = sum(spendByCategory(thisMonth()).filter(([c]) => DISCRETIONARY.includes(c)), (x) => x[1]);
  if (disc > m.monthIncome * 0.2 && m.monthIncome > 0)
    push("action", "✂", `Discretionary spending is <b>${money(disc)}</b> this month (${pct((disc / m.monthIncome) * 100, 0)} of income).`);
  if (m.savingsRate >= 25)
    push("opp", "◆", `Strong savings rate of <b>${pct(m.savingsRate, 0)}</b> — you could invest ~${money(Math.max(0, m.monthIncome - m.monthSpend))} this month.`);
  if (m.safeWithdraw > 3000)
    push("opp", "▦", `You can safely withdraw <b>${money(m.safeWithdraw)}</b> from Mendtech after covering 60-day expenses + buffer.`);
  const worst = state.investments.slice().sort((a, b) => (a.value - a.invested) / Math.max(1, a.invested) - (b.value - b.invested) / Math.max(1, b.invested))[0];
  if (worst && worst.value < worst.invested)
    push("info", "▽", `<b>${esc(worst.name)}</b> is underperforming: ${signMoney(worst.value - worst.invested)} (${pct(((worst.value - worst.invested) / worst.invested) * 100, 1)}).`);
  const goal = state.goals[0];
  if (goal && m.avgSavings > 0) {
    const left = Math.max(0, goal.target - goal.saved);
    const mos = Math.ceil(left / m.avgSavings);
    push("info", "◎", `<b>${esc(goal.name)}</b>: ${money(left)} to go — about <b>${mos} month${mos === 1 ? "" : "s"}</b> at your current pace.`);
  }
  return out.slice(0, 7);
}

function doRefresh() {
  const btn = $("#refreshBtn");
  btn.classList.add("spinning"); btn.disabled = true;

  setTimeout(() => {
    const m = M();
    const prev = state.snapshots.length ? state.snapshots[state.snapshots.length - 1] : null;
    const prevForDiff = prev && prev.date !== todayISO() ? prev : (state.snapshots[state.snapshots.length - 2] || prev);

    const snap = {
      date: todayISO(), netWorth: m.netWorth, cash: m.cash, invest: m.investValue,
      assets: m.assetsTotal, liab: m.liabilities, bizCash: m.bizCash, monthSpend: m.monthSpend
    };
    if (prev && prev.date === todayISO()) state.snapshots[state.snapshots.length - 1] = snap;
    else state.snapshots.push(snap);
    if (state.snapshots.length > 400) state.snapshots = state.snapshots.slice(-400);

    state.insights = generateInsights(m, prevForDiff);
    state.brief = buildBrief(m, prevForDiff);
    state.meta.lastRefresh = new Date().toISOString();
    saveState();

    btn.classList.remove("spinning"); btn.disabled = false;
    renderAll();
    openBriefModal();
    toast("Refreshed — dashboards updated", "ok");
  }, 650);
}

function buildBrief(m, prev) {
  return {
    at: new Date().toISOString(),
    score: healthScore(m),
    personal: {
      netWorth: m.netWorth, cash: m.cash, invest: m.investValue, pnl: m.pnl, pnlPct: m.pnlPct,
      monthSpend: m.monthSpend, savingsRate: m.savingsRate,
      delta: prev ? m.netWorth - prev.netWorth : 0
    },
    business: {
      cash: m.bizCash, inMonth: m.bizIn, outMonth: m.bizOut,
      receivables: m.receivablesTotal, upcoming60: m.upcoming60,
      forecast30: bizForecast(30), forecast60: bizForecast(60), forecast90: bizForecast(90)
    }
  };
}
function bizForecast(days) {
  const m = M();
  const inflow = sum(state.biz.receivables.filter((r) => daysFromToday(r.due) <= days), (r) => r.amount);
  const outflow = sum(state.biz.upcoming.filter((u) => daysFromToday(u.due) <= days), (u) => u.amount);
  const burnExtra = Math.max(0, (days / 30) - (outflow > 0 ? 1 : 0)) * 0; // upcoming list is the plan; avoid double count
  return Math.round(m.bizCash + inflow - outflow - burnExtra);
}

/* ------------------------------------------------------------
   5. SVG chart builders (dataviz spec: thin marks, hairline grid,
      surface gaps, tooltips, no dual axes)
------------------------------------------------------------ */
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

let tipEl = null;
function showTip(x, y, html) {
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tooltip"; document.body.appendChild(tipEl); }
  tipEl.innerHTML = html;
  tipEl.style.left = clamp(x, 70, window.innerWidth - 70) + "px";
  tipEl.style.top = y + "px";
  tipEl.style.display = "block";
}
function hideTip() { if (tipEl) tipEl.style.display = "none"; }

function sparklineSVG(values, w = 96, h = 30, color = "var(--accent)") {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (w - 6) + 3,
    h - 4 - ((v - min) / span) * (h - 8)
  ]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
  </svg>`;
}

function areaChartSVG(series, opts = {}) {
  // series: [{date, value}]
  const W = 640, H = 220, padL = 8, padR = 54, padT = 16, padB = 26;
  if (!series || series.length < 2) return `<div class="empty">Not enough history yet — press Refresh a few days apart.</div>`;
  const vals = series.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  const spread = max - min || Math.abs(max) || 1;
  min -= spread * 0.12; max += spread * 0.08;
  const X = (i) => padL + (i / (series.length - 1)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = series.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ");
  const area = line + ` L ${X(series.length - 1).toFixed(1)} ${H - padB} L ${padL} ${H - padB} Z`;

  const ticks = [0, 0.5, 1].map((f) => min + f * (max - min));
  const grid = ticks.map((v) =>
    `<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${W - padR + 6}" y2="${Y(v).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>
     <text x="${W - padR + 10}" y="${(Y(v) + 4).toFixed(1)}" font-size="11" fill="var(--muted)">${compact(v)}</text>`
  ).join("");

  const lastI = series.length - 1;
  const firstLbl = shortDate(series[0].date), lastLbl = shortDate(series[lastI].date);
  const color = opts.color || "var(--accent)";
  const id = "g" + uid();
  const dataAttr = esc(JSON.stringify(series.map((p) => ({ d: p.date, v: p.value }))));

  return `<svg viewBox="0 0 ${W} ${H}" class="area-chart" data-series="${dataAttr}" data-padl="${padL}" data-padr="${padR}" data-w="${W}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${X(lastI).toFixed(1)}" cy="${Y(series[lastI].value).toFixed(1)}" r="4.4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
    <line class="xh" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="var(--baseline)" stroke-width="1" opacity="0"/>
    <circle class="xh-dot" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    <text x="${padL}" y="${H - 8}" font-size="11" fill="var(--muted)">${firstLbl}</text>
    <text x="${W - padR + 4}" y="${H - 8}" font-size="11" fill="var(--muted)" text-anchor="end">${lastLbl}</text>
  </svg>`;
}

function attachAreaHover(container) {
  $$(".area-chart", container).forEach((svg) => {
    const series = JSON.parse(svg.dataset.series);
    const padL = +svg.dataset.padl, padR = +svg.dataset.padr, W = +svg.dataset.w;
    const xh = $(".xh", svg), dot = $(".xh-dot", svg);
    const vals = series.map((p) => p.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    const spread = max - min || Math.abs(max) || 1;
    min -= spread * 0.12; max += spread * 0.08;
    const H = 220, padT = 16, padB = 26;
    const Y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

    const move = (clientX, clientY) => {
      const r = svg.getBoundingClientRect();
      const fx = ((clientX - r.left) / r.width) * W;
      const i = clamp(Math.round(((fx - padL) / (W - padL - padR)) * (series.length - 1)), 0, series.length - 1);
      const px = padL + (i / (series.length - 1)) * (W - padL - padR);
      xh.setAttribute("x1", px); xh.setAttribute("x2", px); xh.setAttribute("opacity", "1");
      dot.setAttribute("cx", px); dot.setAttribute("cy", Y(series[i].v)); dot.setAttribute("opacity", "1");
      showTip(r.left + (px / W) * r.width, r.top + 8 + window.scrollY - window.scrollY, `<small>${shortDate(series[i].d)}</small><b>${money(series[i].v)}</b>`);
    };
    svg.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    svg.addEventListener("touchmove", (e) => { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    const out = () => { xh.setAttribute("opacity", "0"); dot.setAttribute("opacity", "0"); hideTip(); };
    svg.addEventListener("mouseleave", out);
    svg.addEventListener("touchend", out);
  });
}

function donutSVG(segments, centerTop, centerBottom) {
  // segments: [{label, value, color}]
  const size = 210, cx = size / 2, cy = size / 2, r = 78, sw = 26;
  const total = sum(segments, (s) => s.value) || 1;
  let angle = -90;
  const gapDeg = 2.4;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const sweep = (s.value / total) * 360 - gapDeg;
    const a0 = (angle + gapDeg / 2) * Math.PI / 180;
    const a1 = (angle + gapDeg / 2 + Math.max(sweep, 0.5)) * Math.PI / 180;
    angle += (s.value / total) * 360;
    const large = sweep > 180 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}"
      fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="butt"
      data-tip="${esc(s.label)}|${s.value}" class="donut-seg"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" style="max-width:230px;margin:0 auto;">
    ${arcs}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--ink)">${esc(centerTop)}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(centerBottom)}</text>
  </svg>`;
}
function attachDonutHover(container) {
  $$(".donut-seg", container).forEach((seg) => {
    const [label, value] = seg.dataset.tip.split("|");
    const show = (e) => {
      const p = e.touches ? e.touches[0] : e;
      showTip(p.clientX, p.clientY, `<small>${esc(label)}</small><b>${money(+value)}</b>`);
    };
    seg.addEventListener("mousemove", show);
    seg.addEventListener("touchstart", show, { passive: true });
    seg.addEventListener("mouseleave", hideTip);
    seg.addEventListener("touchend", hideTip);
  });
}

function columnsSVG(months, seriesA, seriesB, labelA, labelB) {
  // paired columns: A income, B spending
  const W = 640, H = 200, padL = 8, padR = 46, padT = 14, padB = 26;
  const n = months.length;
  const maxV = Math.max(...seriesA, ...seriesB, 1);
  const band = (W - padL - padR) / n;
  const bw = Math.min(20, band / 2 - 6);
  const Y = (v) => padT + (1 - v / (maxV * 1.12)) * (H - padT - padB);
  const base = H - padB;

  let bars = "";
  months.forEach((mo, i) => {
    const cxm = padL + band * i + band / 2;
    const ax = cxm - bw - 1, bx = cxm + 1;
    const ah = base - Y(seriesA[i]), bh = base - Y(seriesB[i]);
    bars += `<path d="${roundedColPath(ax, base, bw, ah)}" fill="var(--s2)" class="col" data-tip="${monthLabel(mo)} — ${labelA}|${seriesA[i]}"/>`;
    bars += `<path d="${roundedColPath(bx, base, bw, bh)}" fill="var(--s8)" class="col" data-tip="${monthLabel(mo)} — ${labelB}|${seriesB[i]}"/>`;
    bars += `<text x="${cxm}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${monthLabel(mo).split(" ")[0]}</text>`;
  });
  const ticks = [0.5, 1].map((f) => {
    const v = maxV * f;
    return `<line x1="${padL}" y1="${Y(v)}" x2="${W - padR + 4}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${W - padR + 8}" y="${Y(v) + 4}" font-size="11" fill="var(--muted)">${compact(v)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}">
    ${ticks}
    <line x1="${padL}" y1="${base}" x2="${W - padR + 4}" y2="${base}" stroke="var(--baseline)" stroke-width="1"/>
    ${bars}
  </svg>
  <div class="legend">
    <span class="lg"><span class="sw" style="background:var(--s2)"></span>${labelA}</span>
    <span class="lg"><span class="sw" style="background:var(--s8)"></span>${labelB}</span>
  </div>`;
}
function roundedColPath(x, base, w, h) {
  const rr = Math.min(4, w / 2, Math.max(0, h));
  const top = base - Math.max(h, 0);
  if (h <= 0.5) return `M ${x} ${base} h ${w} v -1 h -${w} Z`;
  return `M ${x} ${base} V ${top + rr} Q ${x} ${top} ${x + rr} ${top} H ${x + w - rr} Q ${x + w} ${top} ${x + w} ${top + rr} V ${base} Z`;
}
function attachColHover(container) {
  $$(".col", container).forEach((c) => {
    const [label, value] = c.dataset.tip.split("|");
    const show = (e) => {
      const p = e.touches ? e.touches[0] : e;
      showTip(p.clientX, p.clientY, `<small>${esc(label)}</small><b>${money(+value)}</b>`);
    };
    c.addEventListener("mousemove", show);
    c.addEventListener("touchstart", show, { passive: true });
    c.addEventListener("mouseleave", hideTip);
    c.addEventListener("touchend", hideTip);
  });
}

function scoreRingSVG(score, size = 54) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const col = score >= 70 ? "var(--good)" : score >= 45 ? "var(--warn)" : "var(--bad)";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="score-ring">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="6"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="6"
      stroke-linecap="round" stroke-dasharray="${(c * score / 100).toFixed(1)} ${c.toFixed(1)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

/* ------------------------------------------------------------
   6. Views
------------------------------------------------------------ */
const PLATFORM_COLORS = ["var(--s1)", "var(--s3)", "var(--s5)", "var(--s2)", "var(--s7)", "var(--s8)"];

function renderAll() {
  renderTopbar();
  renderHome();
  renderMoney();
  renderInvest();
  renderBiz();
  renderCFO();
  renderSettings();
}

function renderTopbar() {
  const lr = state.meta.lastRefresh;
  $("#lastRefreshLabel").textContent = lr
    ? "Refreshed " + new Date(lr).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "Never refreshed — press Refresh";
}

/* ---------- HOME ---------- */
function renderHome() {
  const m = M();
  const v = $("#view-home");
  const snaps = state.snapshots;
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const delta = prev ? m.netWorth - prev.netWorth : 0;
  const deltaPct = prev && prev.netWorth ? (delta / Math.abs(prev.netWorth)) * 100 : 0;
  const series = snaps.map((s) => ({ date: s.date, value: s.netWorth }));
  if (!series.length || series[series.length - 1].date !== todayISO()) series.push({ date: todayISO(), value: m.netWorth });

  const score = state.brief ? state.brief.score : healthScore(m);

  v.innerHTML = `
    <div class="card hero chart-card">
      <div class="hero-label">Total net worth</div>
      <div class="hero-value"><span class="ccy">${CCY}</span>${fmt(m.netWorth)}</div>
      <div class="hero-delta ${delta >= 0 ? "up" : "down"}">${prev ? `${signMoney(delta)} (${pct(Math.abs(deltaPct))}) <small>vs ${shortDate(prev.date)}</small>` : `<small>Press Refresh to start tracking growth</small>`}</div>
      <div class="mt8">${areaChartSVG(series)}</div>
    </div>

    <div class="tile-grid">
      ${tile("Cash available", money(m.cash), null, sparkFrom("cash"))}
      ${tile("Investments", money(m.investValue), subDelta(m.pnl, pct(m.pnlPct)), sparkFrom("invest"))}
      ${tile("Spent this month", money(m.monthSpend), { text: "avg " + money(m.avgSpend) + "/mo", cls: "" })}
      ${tile("Mendtech cash", money(m.bizCash), { text: m.runwayMonths >= 12 ? "12+ months runway" : m.runwayMonths.toFixed(1) + " months runway", cls: m.runwayMonths < 3 ? "down" : "" }, sparkFrom("bizCash"))}
      ${tile("Savings rate", pct(m.savingsRate, 0), { text: money(Math.max(0, m.monthIncome - m.monthSpend)) + " saved", cls: m.savingsRate >= 20 ? "up" : "" })}
      `+ `<div class="tile"><div class="t-label">Financial health</div>
        <div class="score-wrap mt8">${scoreRingSVG(score)}<div><div class="score-num">${score}<span class="muted" style="font-size:12px">/100</span></div>
        <div class="t-sub">${score >= 70 ? "Strong" : score >= 45 ? "Stable — improve buffers" : "Needs attention"}</div></div></div>
      </div>
    </div>

    ${state.insights.length ? `
      <div class="section-title">AI insights & risks <button class="mini-link" data-act="go-cfo">Ask the CFO →</button></div>
      ${state.insights.map((i) => `<div class="insight ${i.type}"><span class="i-ic">${i.ic}</span><div>${i.html}</div></div>`).join("")}
    ` : `
      <div class="section-title">AI insights & risks</div>
      <div class="card flat"><div class="empty"><span class="e-ic">✦</span>Press <b>Refresh</b> to generate your executive brief, insights and health score.</div></div>
    `}

    <div class="section-title">Financial goals <button class="mini-link" data-act="add-goal">+ Add</button></div>
    <div class="card">
      ${state.goals.length ? state.goals.map(goalRow).join("") : `<div class="empty">No goals yet — add your first target.</div>`}
    </div>

    <div class="section-title">Accounts & liabilities <button class="mini-link" data-act="add-account">+ Add</button></div>
    <div class="card">
      <div class="row-list">
        ${state.accounts.map((a) => `
          <div class="rowi clickable" data-act="edit-account" data-id="${a.id}">
            <div class="r-ic">${{ bank: "🏦", cash: "💵", credit: "💳", loan: "📄" }[a.type] || "•"}</div>
            <div class="r-main"><div class="r-title">${esc(a.name)}</div><div class="r-sub">${a.type === "credit" ? "Credit card — owed" : a.type === "loan" ? "Loan — outstanding" : "Available"}</div></div>
            <div class="r-amt ${a.type === "credit" || a.type === "loan" ? "" : "pos"}">${a.type === "credit" || a.type === "loan" ? "−" : ""}${money(a.balance)}</div>
          </div>`).join("") || `<div class="empty">Add your bank, cash, cards and loans.</div>`}
      </div>
    </div>

    <div class="section-title">Property & vehicles <button class="mini-link" data-act="add-asset">+ Add</button></div>
    <div class="card">
      <div class="row-list">
        ${state.assets.map((a) => `
          <div class="rowi clickable" data-act="edit-asset" data-id="${a.id}">
            <div class="r-ic">${{ property: "🏠", vehicle: "🚗" }[a.type] || "◆"}</div>
            <div class="r-main"><div class="r-title">${esc(a.name)}</div><div class="r-sub">${a.type}</div></div>
            <div class="r-amt">${money(a.value)}</div>
          </div>`).join("") || `<div class="empty">Track property, vehicles and other assets here.</div>`}
      </div>
    </div>
    ${state.meta.demo ? `<p class="small muted" style="margin:6px 4px 20px">Demo data loaded so you can explore — replace with your real numbers, or reset in <b>More → Data</b>.</p>` : ""}
  `;
  attachAreaHover(v);
}
function tile(label, value, sub, spark) {
  return `<div class="tile">
    <div class="t-label">${label}</div>
    <div class="t-value">${value}</div>
    ${sub ? `<div class="t-sub ${sub.cls || ""}">${sub.text}</div>` : ""}
    ${spark ? `<div class="mt8">${spark}</div>` : ""}
  </div>`;
}
function subDelta(v, extra) {
  return { text: `${signMoney(v)} (${extra})`, cls: v >= 0 ? "up" : "down" };
}
function sparkFrom(field) {
  const vals = state.snapshots.slice(-12).map((s) => s[field]).filter((x) => typeof x === "number");
  return vals.length > 2 ? sparklineSVG(vals, 110, 26, "var(--accent)") : "";
}
function goalRow(g) {
  const m = M();
  const p = clamp((g.saved / Math.max(1, g.target)) * 100, 0, 100);
  let eta = "";
  if (g.saved < g.target && m.avgSavings > 0) {
    const mos = Math.ceil((g.target - g.saved) / m.avgSavings);
    const d = new Date(); d.setMonth(d.getMonth() + mos);
    eta = `≈ ${mos} months at current pace (${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })})`;
  } else if (g.saved >= g.target) eta = "✓ Achieved";
  return `<div class="goal clickable" data-act="edit-goal" data-id="${g.id}" style="cursor:pointer">
    <div class="g-top"><b>${esc(g.name)}</b><span>${money(g.saved)} / ${money(g.target)}</span></div>
    <div class="g-track"><div class="g-fill" style="width:${p}%"></div></div>
    ${eta ? `<div class="g-eta">${eta}</div>` : ""}
  </div>`;
}

/* ---------- MONEY ---------- */
let moneyMonth = thisMonth();
let moneyFilter = "";
function renderMoney() {
  const v = $("#view-money");
  const mo = moneyMonth;
  const tx = state.transactions.filter((t) => monthKey(t.date) === mo).sort((a, b) => b.date.localeCompare(a.date));
  const inc = sum(tx.filter((t) => t.amount > 0), (t) => t.amount);
  const out = -sum(tx.filter((t) => t.amount < 0), (t) => t.amount);
  const cats = spendByCategory(mo);
  const maxCat = cats.length ? cats[0][1] : 1;

  const histMonths = [];
  for (let k = 5; k >= 0; k--) histMonths.push(addMonthsKey(thisMonth(), -k));
  const incS = histMonths.map((m2) => sum(state.transactions.filter((t) => monthKey(t.date) === m2 && t.amount > 0), (t) => t.amount));
  const outS = histMonths.map((m2) => -sum(state.transactions.filter((t) => monthKey(t.date) === m2 && t.amount < 0), (t) => t.amount));

  const list = moneyFilter ? tx.filter((t) => t.category === moneyFilter) : tx;

  v.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <button class="btn small" data-act="mo-prev">‹</button>
        <h3 style="margin:0">${monthLabel(mo)}</h3>
        <button class="btn small" data-act="mo-next" ${mo >= thisMonth() ? "disabled style='opacity:.4'" : ""}>›</button>
      </div>
      <div class="tile-grid mt16" style="grid-template-columns:repeat(3,1fr)">
        <div class="tile flat" style="box-shadow:none"><div class="t-label">In</div><div class="t-value" style="font-size:17px;color:var(--good-text)">${compact(inc)}</div></div>
        <div class="tile flat" style="box-shadow:none"><div class="t-label">Out</div><div class="t-value" style="font-size:17px">${compact(out)}</div></div>
        <div class="tile flat" style="box-shadow:none"><div class="t-label">Net</div><div class="t-value" style="font-size:17px;color:${inc - out >= 0 ? "var(--good-text)" : "var(--bad-text)"}">${signMoney(inc - out).replace("AED ", "")}</div></div>
      </div>
    </div>

    <div class="card chart-card">
      <h3>Cash flow — last 6 months</h3>
      ${columnsSVG(histMonths, incS, outS, "Income", "Spending")}
    </div>

    <div class="card">
      <h3>Where it went — ${monthLabel(mo)}</h3>
      ${cats.length ? cats.slice(0, 8).map(([c, amt]) => `
        <div class="hbar clickable" data-act="filter-cat" data-cat="${esc(c)}" style="cursor:pointer">
          <div class="hb-top"><span>${esc(c)}${moneyFilter === c ? " ✓" : ""}</span><span>${money(amt)}</span></div>
          <div class="hb-track"><div class="hb-fill" style="width:${(amt / maxCat) * 100}%;background:var(--s1)"></div></div>
        </div>`).join("") : `<div class="empty">No spending recorded for this month.</div>`}
      ${moneyFilter ? `<button class="btn small mt8" data-act="filter-cat" data-cat="">Clear filter</button>` : ""}
    </div>

    <div class="section-title">Transactions ${moneyFilter ? "— " + esc(moneyFilter) : ""}
      <span><button class="mini-link" data-act="import-csv">⇪ Import CSV</button>&nbsp;&nbsp;<button class="mini-link" data-act="add-txn">+ Add</button></span>
    </div>
    <div class="card">
      <div class="row-list">
        ${list.slice(0, 60).map((t) => `
          <div class="rowi clickable" data-act="edit-txn" data-id="${t.id}">
            <div class="r-ic">${t.amount > 0 ? "↓" : "↑"}</div>
            <div class="r-main"><div class="r-title">${esc(t.desc)}</div><div class="r-sub">${shortDate(t.date)} · ${esc(t.category)}</div></div>
            <div class="r-amt ${t.amount > 0 ? "pos" : "neg"}">${t.amount > 0 ? "+" : ""}${fmt(t.amount)}</div>
          </div>`).join("") || `<div class="empty"><span class="e-ic">↔</span>No transactions${moneyFilter ? " in this category" : ""}. Import a bank CSV or add one manually.</div>`}
      </div>
      ${list.length > 60 ? `<p class="small muted tar mt8">Showing 60 of ${list.length}</p>` : ""}
    </div>
  `;
  attachColHover(v);
}

/* ---------- INVEST ---------- */
function renderInvest() {
  const v = $("#view-invest");
  const m = M();
  const byPlatform = {};
  state.investments.forEach((i) => { byPlatform[i.platform] = (byPlatform[i.platform] || 0) + i.value; });
  const segs = Object.entries(byPlatform).map(([label, value], i) => ({ label, value, color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] }));
  const sorted = state.investments.slice().sort((a, b) => b.value - a.value);
  const perf = (i) => i.invested > 0 ? ((i.value - i.invested) / i.invested) * 100 : 0;
  const best = state.investments.slice().sort((a, b) => perf(b) - perf(a))[0];
  const worst = state.investments.slice().sort((a, b) => perf(a) - perf(b))[0];

  v.innerHTML = `
    <div class="tile-grid" style="grid-template-columns:1fr 1fr">
      ${tile("Portfolio value", money(m.investValue), subDelta(m.pnl, pct(m.pnlPct)))}
      ${tile("Invested", money(m.investCost), { text: state.investments.length + " holdings", cls: "" })}
      ${best ? tile("Best performer", esc(best.platform), { text: `${esc(best.name)} ${pct(perf(best))}`, cls: "up" }) : ""}
      ${worst ? tile("Worst performer", esc(worst.platform), { text: `${esc(worst.name)} ${pct(perf(worst))}`, cls: perf(worst) < 0 ? "down" : "" }) : ""}
    </div>

    <div class="card chart-card mt8">
      <h3>Allocation</h3>
      ${segs.length ? donutSVG(segs, compact(m.investValue), "total value") : `<div class="empty">Add holdings to see allocation.</div>`}
      <div class="legend" style="justify-content:center">
        ${segs.map((s) => `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} <b>${pct((s.value / Math.max(1, m.investValue)) * 100, 0)}</b></span>`).join("")}
      </div>
    </div>

    <div class="section-title">Holdings <button class="mini-link" data-act="add-inv">+ Add</button></div>
    <div class="card">
      <div class="row-list">
        ${sorted.map((i) => {
          const p = perf(i), g = i.value - i.invested;
          return `<div class="rowi clickable" data-act="edit-inv" data-id="${i.id}">
            <div class="r-ic">${{ Binance: "₿", "Mutual Funds": "◫", Amana: "◮", Stocks: "◮" }[i.platform] || "◆"}</div>
            <div class="r-main"><div class="r-title">${esc(i.name)}</div><div class="r-sub">${esc(i.platform)} · invested ${money(i.invested)}</div></div>
            <div class="r-amt">${money(i.value)}<small style="color:${g >= 0 ? "var(--good-text)" : "var(--bad-text)"}">${signMoney(g)} (${pct(p)})</small></div>
          </div>`;
        }).join("") || `<div class="empty"><span class="e-ic">◮</span>Add Binance, mutual funds, stocks or Amana holdings.<br>Update values whenever you refresh.</div>`}
      </div>
    </div>
    <p class="small muted" style="margin:4px 4px 16px">Values are updated manually or via statement import — Finance OS never auto-syncs in the background. Update a holding, then press <b>Refresh</b> to re-run analysis.</p>
  `;
  attachDonutHover(v);
}

/* ---------- BIZ (Mendtech cash flow) ---------- */
function renderBiz() {
  const v = $("#view-biz");
  const m = M();
  const f30 = bizForecast(30), f60 = bizForecast(60), f90 = bizForecast(90);
  const rec = state.biz.receivables.slice().sort((a, b) => a.due.localeCompare(b.due));
  const upc = state.biz.upcoming.slice().sort((a, b) => a.due.localeCompare(b.due));
  const bizTx = state.biz.txns.slice().sort((a, b) => b.date.localeCompare(a.date));

  v.innerHTML = `
    <div class="card hero">
      <div class="hero-label">Mendtech cash position</div>
      <div class="hero-value" style="font-size:34px"><span class="ccy">${CCY}</span>${fmt(m.bizCash)}</div>
      <div class="hero-delta ${m.runwayMonths < 3 ? "down" : "up"}">${m.runwayMonths >= 12 ? "12+" : m.runwayMonths.toFixed(1)} months runway <small>at ${money(m.bizBurn)}/mo burn</small></div>
      <div class="btn-row mt8">
        <button class="btn small" data-act="edit-bizcash">Update balance</button>
        <button class="btn small" data-act="add-biztxn">+ Cash in / out</button>
      </div>
    </div>

    <div class="tile-grid" style="grid-template-columns:repeat(2,1fr)">
      ${tile("Received — " + monthLabel(thisMonth()).split(" ")[0], money(m.bizIn), { text: "", cls: "up" })}
      ${tile("Paid — " + monthLabel(thisMonth()).split(" ")[0], money(m.bizOut), null)}
      ${tile("Outstanding invoices", money(m.receivablesTotal), m.overdueCount ? { text: m.overdueCount + " overdue (" + money(m.overdueTotal) + ")", cls: "down" } : { text: rec.length + " open", cls: "" })}
      ${tile("Safe to withdraw", money(m.safeWithdraw), { text: "after 60-day costs + buffer", cls: "" })}
    </div>

    <div class="card mt8">
      <h3>Cash forecast</h3>
      <div class="tile-grid" style="grid-template-columns:repeat(3,1fr)">
        ${[["30 days", f30], ["60 days", f60], ["90 days", f90]].map(([l, val]) => `
          <div class="tile flat" style="box-shadow:none"><div class="t-label">${l}</div>
          <div class="t-value" style="font-size:17px;color:${val < 0 ? "var(--bad-text)" : "inherit"}">${compact(val)}</div></div>`).join("")}
      </div>
      <p class="small muted mt8">Cash + expected collections − planned expenses in each window.</p>
    </div>

    <div class="section-title">Outstanding client payments <button class="mini-link" data-act="add-rec">+ Add</button></div>
    <div class="card">
      <div class="row-list">
        ${rec.map((r) => {
          const d = daysFromToday(r.due);
          return `<div class="rowi clickable" data-act="edit-rec" data-id="${r.id}">
            <div class="r-ic">${d < 0 ? "⏰" : "🧾"}</div>
            <div class="r-main"><div class="r-title">${esc(r.client)}</div>
              <div class="r-sub" style="${d < 0 ? "color:var(--bad-text)" : ""}">${d < 0 ? Math.abs(d) + " days overdue" : d === 0 ? "Due today" : "Due " + shortDate(r.due)}</div></div>
            <div class="r-amt pos">${money(r.amount)}</div>
          </div>`;
        }).join("") || `<div class="empty">No outstanding invoices 🎉</div>`}
      </div>
    </div>

    <div class="section-title">Upcoming expenses <button class="mini-link" data-act="add-upc">+ Add</button></div>
    <div class="card">
      <div class="row-list">
        ${upc.map((u) => `
          <div class="rowi clickable" data-act="edit-upc" data-id="${u.id}">
            <div class="r-ic">📤</div>
            <div class="r-main"><div class="r-title">${esc(u.name)}</div><div class="r-sub">Due ${shortDate(u.due)} (${daysFromToday(u.due)}d)</div></div>
            <div class="r-amt">−${money(u.amount)}</div>
          </div>`).join("") || `<div class="empty">No planned expenses.</div>`}
      </div>
    </div>

    <div class="section-title">Recent business cash</div>
    <div class="card">
      <div class="row-list">
        ${bizTx.slice(0, 20).map((t) => `
          <div class="rowi">
            <div class="r-ic">${t.amount > 0 ? "↓" : "↑"}</div>
            <div class="r-main"><div class="r-title">${esc(t.desc)}</div><div class="r-sub">${shortDate(t.date)}</div></div>
            <div class="r-amt ${t.amount > 0 ? "pos" : "neg"}">${t.amount > 0 ? "+" : ""}${fmt(t.amount)}</div>
          </div>`).join("") || `<div class="empty">Record cash received & paid to power the forecast.</div>`}
      </div>
    </div>
    <p class="small muted" style="margin:4px 4px 16px">Zoho Books / Wio auto-import is a next-phase upgrade (needs a small relay). For now: paste totals here or ask Claude to prep a monthly summary from Zoho.</p>
  `;
}

/* ---------- CFO ---------- */
function renderCFO() {
  const v = $("#view-cfo");
  if (!$("#cfoWrap", v)) {
    v.innerHTML = `
      <div id="cfoWrap">
        <div id="cfoLog"></div>
        <div class="chips" id="cfoChips"></div>
        <div id="cfoInputRow">
          <input id="cfoInput" type="text" placeholder="Ask your CFO anything…" autocomplete="off" />
          <button id="cfoSend" title="Send">➤</button>
        </div>
      </div>`;
    $("#cfoSend", v).addEventListener("click", sendCFO);
    $("#cfoInput", v).addEventListener("keydown", (e) => { if (e.key === "Enter") sendCFO(); });
  }
  const chips = ["How much money do I have?", "What changed since last refresh?", "Where did I spend the most?", "Show my subscriptions", "How much can I withdraw from Mendtech?", "Can I afford AED 5,000?", "Which investment is underperforming?", "How close am I to my property goal?"];
  $("#cfoChips").innerHTML = chips.map((c) => `<button data-chip="${esc(c)}">${esc(c)}</button>`).join("");
  renderCfoLog();
}
function renderCfoLog() {
  const log = $("#cfoLog");
  if (!log) return;
  if (!state.cfoLog.length) {
    log.innerHTML = `<div class="msg cfo">Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, Johnson. I'm your private CFO — I answer from your latest refreshed numbers.\n\nTry a quick question below, or type anything.<span class="src">Local engine · add a Claude API key in More for deeper analysis</span></div>`;
  } else {
    log.innerHTML = state.cfoLog.map((msg) =>
      `<div class="msg ${msg.role}">${esc(msg.text)}${msg.src ? `<span class="src">${esc(msg.src)}</span>` : ""}</div>`
    ).join("");
  }
  log.scrollTop = log.scrollHeight;
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const v = $("#view-settings");
  const overrides = Object.entries(state.settings.catOverrides);
  v.innerHTML = `
    <div class="section-title">Assistant</div>
    <div class="card">
      <div class="field">
        <label>Claude API key (optional)</label>
        <input id="apiKeyInput" type="password" placeholder="sk-ant-…" value="${esc(state.settings.apiKey)}" autocomplete="off" />
        <div class="hint">Stored only on this device. With a key, the AI CFO uses Claude (claude-opus-4-8) for free-form analysis; without it, the built-in engine answers from your data. Never synced anywhere.</div>
      </div>
      <button class="btn small" data-act="save-key">Save key</button>
      ${state.settings.apiKey ? `<button class="btn small danger" data-act="clear-key">Remove</button>` : ""}
    </div>

    <div class="section-title">Appearance</div>
    <div class="card">
      <div class="seg" style="margin-bottom:0">
        <button data-theme-set="dark" class="${state.settings.theme === "dark" ? "active" : ""}">Dark</button>
        <button data-theme-set="light" class="${state.settings.theme === "light" ? "active" : ""}">Light</button>
      </div>
    </div>

    <div class="section-title">Learned merchant rules</div>
    <div class="card">
      ${overrides.length ? overrides.map(([k, c]) => `
        <div class="rowi"><div class="r-main"><div class="r-title">${esc(k)}</div><div class="r-sub">→ ${esc(c)}</div></div>
        <button class="btn small danger" data-act="del-rule" data-key="${esc(k)}">✕</button></div>`).join("")
      : `<div class="empty">When you correct a transaction's category, Finance OS learns the merchant and applies it to future imports.</div>`}
    </div>

    <div class="section-title">Data</div>
    <div class="card">
      <div class="btn-row">
        <button class="btn" data-act="export-data">⇩ Export backup</button>
        <button class="btn" data-act="import-data">⇪ Restore backup</button>
      </div>
      <hr class="sep"/>
      <div class="btn-row">
        <button class="btn" data-act="reload-demo">Load demo data</button>
        <button class="btn danger" data-act="wipe">Erase everything</button>
      </div>
      <p class="small muted mt8">All data lives in this browser (localStorage). Nothing is uploaded. Export a backup before clearing your browser.</p>
    </div>

    <div class="section-title">About</div>
    <div class="card">
      <p class="small"><b>Finance OS v1</b> — single-owner financial command centre.<br>
      <span class="muted">No background sync. No tracking. Data refreshes only when you press Refresh. Built for Johnson · Mendonca Technical Services.</span></p>
    </div>
  `;
}

/* ------------------------------------------------------------
   7. Modals & forms
------------------------------------------------------------ */
function openModal(title, bodyHTML, onMount) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
  </div></div>`;
  const bd = $(".modal-backdrop", root);
  bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(); });
  $(".modal-close", root).addEventListener("click", closeModal);
  if (onMount) onMount(root);
}
function closeModal() { $("#modalRoot").innerHTML = ""; }

function fieldHTML(id, label, type = "text", value = "", extra = "") {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}/></div>`;
}
function selectHTML(id, label, options, value) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}">
    ${options.map((o) => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}
  </select></div>`;
}
function delSaveButtons(canDelete) {
  return `<div class="btn-row"><button class="btn primary" id="mSave">Save</button>${canDelete ? `<button class="btn danger" id="mDelete">Delete</button>` : ""}</div>`;
}

function accountModal(id) {
  const a = state.accounts.find((x) => x.id === id) || { name: "", type: "bank", balance: "" };
  openModal(id ? "Edit account" : "Add account", `
    ${fieldHTML("mName", "Name", "text", a.name, 'placeholder="e.g. Emirates NBD"')}
    ${selectHTML("mType", "Type", ["bank", "cash", "credit", "loan"], a.type)}
    ${fieldHTML("mBal", a.type === "credit" || a.type === "loan" ? "Amount owed (AED)" : "Balance (AED)", "number", a.balance)}
    ${delSaveButtons(!!id)}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), name: $("#mName").value.trim() || "Account", type: $("#mType").value, balance: Math.abs(Number($("#mBal").value) || 0) };
      if (id) Object.assign(state.accounts.find((x) => x.id === id), rec);
      else state.accounts.push(rec);
      saveState(); closeModal(); renderAll(); toast("Account saved", "ok");
    });
    if (id) $("#mDelete", root).addEventListener("click", () => {
      state.accounts = state.accounts.filter((x) => x.id !== id);
      saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
    });
  });
}
function assetModal(id) {
  const a = state.assets.find((x) => x.id === id) || { name: "", type: "property", value: "" };
  openModal(id ? "Edit asset" : "Add asset", `
    ${fieldHTML("mName", "Name", "text", a.name, 'placeholder="e.g. Apartment — JVC"')}
    ${selectHTML("mType", "Type", ["property", "vehicle", "other"], a.type)}
    ${fieldHTML("mVal", "Current value (AED)", "number", a.value)}
    ${delSaveButtons(!!id)}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), name: $("#mName").value.trim() || "Asset", type: $("#mType").value, value: Math.abs(Number($("#mVal").value) || 0) };
      if (id) Object.assign(state.assets.find((x) => x.id === id), rec);
      else state.assets.push(rec);
      saveState(); closeModal(); renderAll(); toast("Asset saved", "ok");
    });
    if (id) $("#mDelete", root).addEventListener("click", () => {
      state.assets = state.assets.filter((x) => x.id !== id);
      saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
    });
  });
}
function investModal(id) {
  const a = state.investments.find((x) => x.id === id) || { name: "", platform: "Binance", invested: "", value: "" };
  openModal(id ? "Edit holding" : "Add holding", `
    ${fieldHTML("mName", "Name", "text", a.name, 'placeholder="e.g. BTC + ETH"')}
    ${selectHTML("mPlat", "Platform", ["Binance", "Mutual Funds", "Amana", "Stocks", "Gold", "Other"], a.platform)}
    <div class="form-grid2">
      ${fieldHTML("mInv", "Amount invested (AED)", "number", a.invested)}
      ${fieldHTML("mVal", "Current value (AED)", "number", a.value)}
    </div>
    ${delSaveButtons(!!id)}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), name: $("#mName").value.trim() || "Holding", platform: $("#mPlat").value, invested: Math.abs(Number($("#mInv").value) || 0), value: Math.abs(Number($("#mVal").value) || 0) };
      if (id) Object.assign(state.investments.find((x) => x.id === id), rec);
      else state.investments.push(rec);
      saveState(); closeModal(); renderAll(); toast("Holding saved", "ok");
    });
    if (id) $("#mDelete", root).addEventListener("click", () => {
      state.investments = state.investments.filter((x) => x.id !== id);
      saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
    });
  });
}
function goalModal(id) {
  const g = state.goals.find((x) => x.id === id) || { name: "", target: "", saved: "" };
  openModal(id ? "Edit goal" : "Add goal", `
    ${fieldHTML("mName", "Goal", "text", g.name, 'placeholder="e.g. Property down payment"')}
    <div class="form-grid2">
      ${fieldHTML("mTarget", "Target (AED)", "number", g.target)}
      ${fieldHTML("mSaved", "Saved so far (AED)", "number", g.saved)}
    </div>
    ${delSaveButtons(!!id)}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), name: $("#mName").value.trim() || "Goal", target: Math.abs(Number($("#mTarget").value) || 0), saved: Math.abs(Number($("#mSaved").value) || 0) };
      if (id) Object.assign(state.goals.find((x) => x.id === id), rec);
      else state.goals.push(rec);
      saveState(); closeModal(); renderAll(); toast("Goal saved", "ok");
    });
    if (id) $("#mDelete", root).addEventListener("click", () => {
      state.goals = state.goals.filter((x) => x.id !== id);
      saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
    });
  });
}
function txnModal(id) {
  const t = state.transactions.find((x) => x.id === id) || { date: todayISO(), desc: "", amount: "", category: "Other" };
  const isIncome = t.amount > 0;
  openModal(id ? "Edit transaction" : "Add transaction", `
    ${fieldHTML("mDate", "Date", "date", t.date)}
    ${fieldHTML("mDesc", "Description", "text", t.desc, 'placeholder="e.g. Carrefour"')}
    ${fieldHTML("mAmt", "Amount (AED)", "number", Math.abs(t.amount) || "", 'step="0.01"')}
    <div class="seg"><button id="segOut" class="${!isIncome ? "active" : ""}">Money out</button><button id="segIn" class="${isIncome ? "active" : ""}">Money in</button></div>
    ${selectHTML("mCat", "Category", CATEGORIES, t.category)}
    ${delSaveButtons(!!id)}
  `, (root) => {
    let dir = isIncome ? 1 : -1;
    $("#segOut", root).addEventListener("click", () => { dir = -1; $("#segOut").classList.add("active"); $("#segIn").classList.remove("active"); });
    $("#segIn", root).addEventListener("click", () => { dir = 1; $("#segIn").classList.add("active"); $("#segOut").classList.remove("active"); });
    $("#mDesc", root).addEventListener("change", () => {
      if (!id) $("#mCat").value = categorize($("#mDesc").value, dir);
    });
    $("#mSave", root).addEventListener("click", () => {
      const desc = $("#mDesc").value.trim() || "Transaction";
      const cat = $("#mCat").value;
      const rec = {
        id: id || uid(), date: $("#mDate").value || todayISO(), desc,
        amount: dir * Math.abs(Number($("#mAmt").value) || 0), category: cat, src: id ? t.src : "manual"
      };
      rec.hash = txHash(rec);
      const auto = categorize(desc, rec.amount);
      if (cat !== auto) learnCategory(desc, cat); // learn correction
      if (id) Object.assign(state.transactions.find((x) => x.id === id), rec);
      else state.transactions.push(rec);
      saveState(); closeModal(); renderAll(); toast("Transaction saved", "ok");
    });
    if (id) $("#mDelete", root).addEventListener("click", () => {
      state.transactions = state.transactions.filter((x) => x.id !== id);
      saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
    });
  });
}
function recModal(id) {
  const r = state.biz.receivables.find((x) => x.id === id) || { client: "", amount: "", due: todayISO() };
  openModal(id ? "Edit client payment" : "Outstanding client payment", `
    ${fieldHTML("mClient", "Client / job", "text", r.client)}
    <div class="form-grid2">
      ${fieldHTML("mAmt", "Amount (AED)", "number", r.amount)}
      ${fieldHTML("mDue", "Due date", "date", r.due)}
    </div>
    ${delSaveButtons(!!id)}
    ${id ? `<button class="btn block mt8" id="mCollect" style="border-color:var(--good);color:var(--good-text)">✓ Mark collected (adds to cash)</button>` : ""}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), client: $("#mClient").value.trim() || "Client", amount: Math.abs(Number($("#mAmt").value) || 0), due: $("#mDue").value || todayISO() };
      if (id) Object.assign(state.biz.receivables.find((x) => x.id === id), rec);
      else state.biz.receivables.push(rec);
      saveState(); closeModal(); renderAll(); toast("Saved", "ok");
    });
    if (id) {
      $("#mDelete", root).addEventListener("click", () => {
        state.biz.receivables = state.biz.receivables.filter((x) => x.id !== id);
        saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
      });
      $("#mCollect", root).addEventListener("click", () => {
        const rr = state.biz.receivables.find((x) => x.id === id);
        state.biz.cashBalance = (Number(state.biz.cashBalance) || 0) + rr.amount;
        state.biz.txns.push({ id: uid(), date: todayISO(), desc: "Collected: " + rr.client, amount: rr.amount });
        state.biz.receivables = state.biz.receivables.filter((x) => x.id !== id);
        saveState(); closeModal(); renderAll(); toast("Collected " + money(rr.amount), "ok");
      });
    }
  });
}
function upcModal(id) {
  const u = state.biz.upcoming.find((x) => x.id === id) || { name: "", amount: "", due: todayISO() };
  openModal(id ? "Edit upcoming expense" : "Upcoming expense", `
    ${fieldHTML("mName", "Expense", "text", u.name)}
    <div class="form-grid2">
      ${fieldHTML("mAmt", "Amount (AED)", "number", u.amount)}
      ${fieldHTML("mDue", "Due date", "date", u.due)}
    </div>
    ${delSaveButtons(!!id)}
    ${id ? `<button class="btn block mt8" id="mPay">✓ Mark paid (deducts from cash)</button>` : ""}
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      const rec = { id: id || uid(), name: $("#mName").value.trim() || "Expense", amount: Math.abs(Number($("#mAmt").value) || 0), due: $("#mDue").value || todayISO() };
      if (id) Object.assign(state.biz.upcoming.find((x) => x.id === id), rec);
      else state.biz.upcoming.push(rec);
      saveState(); closeModal(); renderAll(); toast("Saved", "ok");
    });
    if (id) {
      $("#mDelete", root).addEventListener("click", () => {
        state.biz.upcoming = state.biz.upcoming.filter((x) => x.id !== id);
        saveState(); closeModal(); renderAll(); toast("Deleted", "ok");
      });
      $("#mPay", root).addEventListener("click", () => {
        const uu = state.biz.upcoming.find((x) => x.id === id);
        state.biz.cashBalance = (Number(state.biz.cashBalance) || 0) - uu.amount;
        state.biz.txns.push({ id: uid(), date: todayISO(), desc: "Paid: " + uu.name, amount: -uu.amount });
        state.biz.upcoming = state.biz.upcoming.filter((x) => x.id !== id);
        saveState(); closeModal(); renderAll(); toast("Paid " + money(uu.amount), "ok");
      });
    }
  });
}
function bizCashModal() {
  openModal("Update Mendtech cash balance", `
    ${fieldHTML("mBal", "Current total cash (bank + cash) — AED", "number", state.biz.cashBalance)}
    <div class="btn-row"><button class="btn primary" id="mSave">Save</button></div>
  `, (root) => {
    $("#mSave", root).addEventListener("click", () => {
      state.biz.cashBalance = Number($("#mBal").value) || 0;
      saveState(); closeModal(); renderAll(); toast("Balance updated", "ok");
    });
  });
}
function bizTxnModal() {
  openModal("Business cash in / out", `
    ${fieldHTML("mDate", "Date", "date", todayISO())}
    ${fieldHTML("mDesc", "Description", "text", "", 'placeholder="e.g. AMC invoice collected"')}
    ${fieldHTML("mAmt", "Amount (AED)", "number", "")}
    <div class="seg"><button id="segIn" class="active">Received</button><button id="segOut">Paid</button></div>
    <div class="btn-row"><button class="btn primary" id="mSave">Save</button></div>
  `, (root) => {
    let dir = 1;
    $("#segIn", root).addEventListener("click", () => { dir = 1; $("#segIn").classList.add("active"); $("#segOut").classList.remove("active"); });
    $("#segOut", root).addEventListener("click", () => { dir = -1; $("#segOut").classList.add("active"); $("#segIn").classList.remove("active"); });
    $("#mSave", root).addEventListener("click", () => {
      const amt = dir * Math.abs(Number($("#mAmt").value) || 0);
      state.biz.txns.push({ id: uid(), date: $("#mDate").value || todayISO(), desc: $("#mDesc").value.trim() || (dir > 0 ? "Cash received" : "Cash paid"), amount: amt });
      state.biz.cashBalance = (Number(state.biz.cashBalance) || 0) + amt;
      saveState(); closeModal(); renderAll(); toast("Recorded", "ok");
    });
  });
}

/* ---------- CSV import ---------- */
function csvModal() {
  openModal("Import bank / card statement (CSV)", `
    <div class="field"><label>Paste CSV or choose a file</label>
      <textarea id="csvText" placeholder="Date,Description,Amount\n01/07/2026,CARREFOUR,−230.50\n…"></textarea>
    </div>
    <div class="field"><input type="file" id="csvFile" accept=".csv,text/csv" /></div>
    <p class="hint">Finance OS auto-detects the date, description and amount columns (or debit / credit columns), auto-categorises every line, and skips duplicates.</p>
    <div class="btn-row"><button class="btn primary" id="mImport">Analyse & import</button></div>
    <div id="csvResult" class="mt8"></div>
  `, (root) => {
    $("#csvFile", root).addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { $("#csvText").value = rd.result; };
      rd.readAsText(f);
    });
    $("#mImport", root).addEventListener("click", () => {
      const res = importCSV($("#csvText").value);
      $("#csvResult").innerHTML = `<div class="insight ${res.added ? "opp" : "info"}"><span class="i-ic">${res.added ? "✓" : "ℹ"}</span>
        <div><b>${res.added} imported</b>, ${res.dupes} duplicates skipped, ${res.bad} lines unreadable.<br>
        <span class="small muted">Auto-categorised: ${esc(res.catSummary)}</span></div></div>`;
      if (res.added) { saveState(); renderAll(); toast(res.added + " transactions imported", "ok"); }
    });
  });
}
function parseCSVText(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (cell !== "" || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
function importCSV(text) {
  const rows = parseCSVText(text || "");
  if (rows.length < 1) return { added: 0, dupes: 0, bad: 0, catSummary: "nothing to import" };

  const sample = rows.slice(0, Math.min(rows.length, 12));
  const nCols = Math.max(...rows.map((r) => r.length));
  const scoreDate = [], scoreNum = [], scoreText = [];
  for (let c = 0; c < nCols; c++) {
    let d = 0, n = 0, tlen = 0;
    sample.forEach((r) => {
      const val = (r[c] || "").trim();
      if (parseFlexDate(val)) d++;
      const num = parseFloat(val.replace(/[",\sAED]/gi, "").replace(/[()]/g, "-").replace("−", "-"));
      if (!isNaN(num) && /\d/.test(val) && !parseFlexDate(val)) n++;
      tlen += val.replace(/[\d\W]/g, "").length;
    });
    scoreDate.push(d); scoreNum.push(n); scoreText.push(tlen);
  }
  const dateCol = scoreDate.indexOf(Math.max(...scoreDate));
  let amtCol = -1, best = -1;
  scoreNum.forEach((n, c) => { if (c !== dateCol && n > best) { best = n; amtCol = c; } });
  let debitCol = -1, creditCol = -1;
  const header = rows[0].map((h) => h.toLowerCase());
  header.forEach((h, c) => {
    if (/debit|withdraw|out/.test(h)) debitCol = c;
    if (/credit|deposit|in\b/.test(h)) creditCol = c;
  });
  let descCol = -1; best = -1;
  scoreText.forEach((t, c) => { if (c !== dateCol && c !== amtCol && t > best) { best = t; descCol = c; } });

  const startRow = parseFlexDate((rows[0][dateCol] || "").trim()) ? 0 : 1;
  const existing = new Set(state.transactions.map((t) => t.hash));
  let added = 0, dupes = 0, bad = 0;
  const catCount = {};
  const num = (s) => {
    if (!s) return NaN;
    let v = String(s).replace(/[",\s]|AED|aed/g, "").replace("−", "-");
    if (/^\(.*\)$/.test(v)) v = "-" + v.slice(1, -1);
    return parseFloat(v);
  };
  for (let r = startRow; r < rows.length; r++) {
    const row2 = rows[r];
    const date = parseFlexDate((row2[dateCol] || "").trim());
    let amount;
    if (debitCol >= 0 || creditCol >= 0) {
      const dV = num(row2[debitCol]), cV = num(row2[creditCol]);
      amount = (!isNaN(cV) && cV !== 0 ? Math.abs(cV) : 0) - (!isNaN(dV) && dV !== 0 ? Math.abs(dV) : 0);
      if (amount === 0 && isNaN(dV) && isNaN(cV)) amount = NaN;
    } else amount = num(row2[amtCol]);
    const desc = (row2[descCol] || "").trim() || "Imported transaction";
    if (!date || isNaN(amount) || amount === 0) { bad++; continue; }
    const t = { id: uid() + r, date, desc, amount, category: categorize(desc, amount), src: "csv" };
    t.hash = txHash(t);
    if (existing.has(t.hash)) { dupes++; continue; }
    existing.add(t.hash);
    state.transactions.push(t);
    catCount[t.category] = (catCount[t.category] || 0) + 1;
    added++;
  }
  const catSummary = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} ×${n}`).join(", ") || "—";
  return { added, dupes, bad, catSummary };
}

/* ---------- Executive brief modal ---------- */
function openBriefModal() {
  const b = state.brief;
  if (!b) return;
  const p = b.personal, z = b.business;
  openModal("Executive brief", `
    <div class="score-wrap" style="margin-bottom:14px">${scoreRingSVG(b.score, 62)}
      <div><div class="score-num">${b.score}/100</div><div class="small muted">Financial health score</div></div>
    </div>
    <div class="section-title" style="margin-top:0">Personal</div>
    ${briefRow("Net worth", money(p.netWorth), p.delta ? signMoney(p.delta) : "")}
    ${briefRow("Cash available", money(p.cash))}
    ${briefRow("Investments", money(p.invest), signMoney(p.pnl) + " (" + pct(p.pnlPct) + ")")}
    ${briefRow("Spending this month", money(p.monthSpend))}
    ${briefRow("Savings rate", pct(p.savingsRate, 0))}
    <div class="section-title">Mendtech</div>
    ${briefRow("Cash position", money(z.cash))}
    ${briefRow("Received / paid (month)", money(z.inMonth) + " / " + money(z.outMonth))}
    ${briefRow("Outstanding receivables", money(z.receivables))}
    ${briefRow("Forecast 30 / 60 / 90d", compact(z.forecast30) + " / " + compact(z.forecast60) + " / " + compact(z.forecast90))}
    <div class="section-title">Top insights</div>
    ${state.insights.slice(0, 4).map((i) => `<div class="insight ${i.type}"><span class="i-ic">${i.ic}</span><div>${i.html}</div></div>`).join("") || '<p class="small muted">All clear.</p>'}
    <button class="btn primary block mt8" id="briefClose">Done</button>
  `, (root) => {
    $("#briefClose", root).addEventListener("click", closeModal);
  });
}
function briefRow(k, v, extra) {
  return `<div class="rowi" style="padding:8px 2px"><div class="r-main"><div class="r-title" style="font-weight:500;color:var(--ink-2)">${k}</div></div>
    <div class="r-amt">${v}${extra ? `<small>${extra}</small>` : ""}</div></div>`;
}

/* ------------------------------------------------------------
   8. AI CFO — local engine + optional Claude API
------------------------------------------------------------ */
function cfoLocalAnswer(q) {
  const m = M();
  const t = q.toLowerCase();
  const num = (t.match(/([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?/i) || [])[1];
  let amount = num ? parseFloat(num.replace(/,/g, "")) : null;
  if (amount && /k|thousand/i.test(t)) amount *= 1000;
  if (amount && /m|million/i.test(t)) amount *= 1e6;

  if (/how much (money|cash)|money do i have|cash.*(today|now)|available/.test(t) && !/withdraw|mendtech|business/.test(t)) {
    return `You have ${money(m.cash)} in personal cash across ${state.accounts.filter(a => a.type === "bank" || a.type === "cash").length} accounts, plus ${money(m.bizCash)} in Mendtech.\n\nAfter credit cards (${money(m.creditDebt)}), your free personal position is ${money(m.cash - m.creditDebt)}.`;
  }
  if (/withdraw|take out|draw.*mendtech|from (the )?business/.test(t)) {
    return `Safe withdrawal from Mendtech: ${money(m.safeWithdraw)}.\n\nThat keeps back ${money(Math.round(Math.max(m.upcoming60, m.bizBurn * 1.5)))} — the larger of your 60-day planned expenses (${money(m.upcoming60)}) or a 1.5-month burn buffer (${money(Math.round(m.bizBurn * 1.5))}). Current business cash: ${money(m.bizCash)}.`;
  }
  if (/afford/.test(t)) {
    if (!amount) return `Tell me the amount — e.g. "Can I afford AED 5,000?"`;
    const buffer = m.avgSpend * 2;
    const free = m.cash - m.creditDebt - buffer;
    if (amount <= free) return `Yes — ${money(amount)} is affordable. After keeping a 2-month spending buffer (${money(buffer)}) and clearing cards, you'd still have ${money(free - amount)} free.`;
    if (amount <= free + m.safeWithdraw) return `Tight. Personal free cash after a 2-month buffer is ${money(Math.max(0, free))}. You could cover ${money(amount)} by also drawing ${money(amount - Math.max(0, free))} from Mendtech (safe limit ${money(m.safeWithdraw)}).`;
    return `Not comfortably. ${money(amount)} exceeds your free cash (${money(Math.max(0, free))}) plus safe business withdrawal (${money(m.safeWithdraw)}). Consider phasing it or waiting ${m.avgSavings > 0 ? "~" + Math.ceil((amount - free - m.safeWithdraw) / m.avgSavings) + " months" : "until savings recover"}.`;
  }
  if (/invest this month|how much can i invest/.test(t)) {
    const spare = Math.max(0, m.monthIncome - m.monthSpend);
    return `This month you've saved ${money(spare)} so far (income ${money(m.monthIncome)} − spend ${money(m.monthSpend)}).\n\nKeeping your emergency buffer intact, you could invest ~${money(Math.round(spare * 0.8))} and hold the rest as cash. Your 3-month average savings is ${money(Math.round(m.avgSavings))}/month.`;
  }
  if (/what changed|since (my |the )?last refresh|update me/.test(t)) {
    const s = state.snapshots;
    if (s.length < 2) return `I need at least two refreshes to compare. Press Refresh today and again in a few days.`;
    const a = s[s.length - 2], b2 = s[s.length - 1];
    const d = (x, y) => signMoney(y - x);
    return `Since ${shortDate(a.date)}:\n• Net worth ${d(a.netWorth, b2.netWorth)} → ${money(b2.netWorth)}\n• Cash ${d(a.cash, b2.cash)}\n• Investments ${d(a.invest, b2.invest)}\n• Mendtech cash ${d(a.bizCash, b2.bizCash)}\n• Liabilities ${d(a.liab, b2.liab)}`;
  }
  if (/spend.*most|most.*spen[dt]|top spending|biggest.*(expense|spend)/.test(t)) {
    const cats = spendByCategory(thisMonth());
    if (!cats.length) return `No spending recorded this month yet.`;
    return `Top spending this month:\n${cats.slice(0, 5).map(([c, v], i) => `${i + 1}. ${c} — ${money(v)}`).join("\n")}\n\nTotal: ${money(m.monthSpend)} (avg ${money(m.avgSpend)}/month).`;
  }
  if (/subscription/.test(t)) {
    const subs = detectSubscriptions();
    if (!subs.length) return `No recurring subscriptions detected yet — I need a couple of months of transactions to spot them.`;
    return `Detected subscriptions (~${money(sum(subs, (s) => s.monthly))}/month):\n${subs.slice(0, 8).map((s) => `• ${s.name} — ${money(s.monthly)}/mo`).join("\n")}`;
  }
  if (/unnecessary|waste|cut.*spend|reduce.*spend/.test(t)) {
    const cats = spendByCategory(thisMonth()).filter(([c]) => DISCRETIONARY.includes(c));
    const total = sum(cats, (x) => x[1]);
    const subs = detectSubscriptions();
    return `Discretionary spending this month: ${money(total)}.\n${cats.map(([c, v]) => `• ${c} — ${money(v)}`).join("\n") || "• None recorded"}\n\nPlus ${money(sum(subs, (s) => s.monthly))}/month in subscriptions. Cutting 30% of discretionary spend would free ~${money(Math.round(total * 0.3))}/month toward your goals.`;
  }
  if (/underperform|worst.*invest|losing/.test(t)) {
    if (!state.investments.length) return `No holdings tracked yet — add them in the Invest tab.`;
    const perf = (i) => i.invested > 0 ? ((i.value - i.invested) / i.invested) * 100 : 0;
    const w = state.investments.slice().sort((a, b) => perf(a) - perf(b))[0];
    return `Weakest holding: ${w.name} (${w.platform}) at ${signMoney(w.value - w.invested)} (${pct(perf(w))}).\n\nPortfolio overall: ${signMoney(m.pnl)} (${pct(m.pnlPct)}) on ${money(m.investCost)} invested.`;
  }
  if (/portfolio|investment.*(perform|doing)|how.*invest.*doing/.test(t)) {
    const perf = (i) => i.invested > 0 ? ((i.value - i.invested) / i.invested) * 100 : 0;
    const lines = state.investments.slice().sort((a, b) => perf(b) - perf(a)).map((i) => `• ${i.name} (${i.platform}): ${money(i.value)} — ${pct(perf(i))}`);
    return `Portfolio: ${money(m.investValue)} (${signMoney(m.pnl)}, ${pct(m.pnlPct)}).\n${lines.join("\n")}`;
  }
  if (/property|goal|close am i/.test(t)) {
    if (!state.goals.length) return `No goals set — add one on the Home tab.`;
    const g = state.goals.find((x) => /propert|house|home|down/i.test(x.name)) || state.goals[0];
    const p = (g.saved / Math.max(1, g.target)) * 100;
    const left = Math.max(0, g.target - g.saved);
    const eta = m.avgSavings > 0 ? `At ${money(Math.round(m.avgSavings))}/month you'll get there in ~${Math.ceil(left / m.avgSavings)} months.` : `Set a monthly saving pace to get an ETA.`;
    return `${g.name}: ${pct(p, 0)} funded — ${money(g.saved)} of ${money(g.target)} (${money(left)} to go).\n${eta}`;
  }
  if (/business|mendtech|cash flow|runway/.test(t)) {
    return `Mendtech position:\n• Cash: ${money(m.bizCash)} (${m.runwayMonths >= 12 ? "12+" : m.runwayMonths.toFixed(1)} months runway)\n• This month: +${money(m.bizIn)} in / −${money(m.bizOut)} out\n• Receivables: ${money(m.receivablesTotal)}${m.overdueCount ? ` (${m.overdueCount} overdue!)` : ""}\n• Forecast 30/60/90d: ${compact(bizForecast(30))} / ${compact(bizForecast(60))} / ${compact(bizForecast(90))}\n• Safe to withdraw: ${money(m.safeWithdraw)}`;
  }
  if (/health|score/.test(t)) {
    const sc = healthScore(m);
    return `Financial health: ${sc}/100.\n• Savings rate ${pct(m.savingsRate, 0)}\n• Emergency buffer ${m.emergencyMonths.toFixed(1)} months\n• Liabilities ${money(m.liabilities)}\n• Business runway ${m.runwayMonths >= 12 ? "12+" : m.runwayMonths.toFixed(1)} months\n\nBiggest lever: ${m.emergencyMonths < 3 ? "build your emergency fund to 3+ months" : m.savingsRate < 20 ? "push savings rate above 20%" : "keep compounding — you're in good shape"}.`;
  }
  return `I can answer things like:\n• "How much money do I have?"\n• "Can I afford AED 20,000?"\n• "How much can I withdraw from Mendtech?"\n• "Where did I spend the most?"\n• "Show my subscriptions" / "unnecessary spending"\n• "Which investment is underperforming?"\n• "What changed since last refresh?"\n\nAdd a Claude API key in More → Assistant for open-ended analysis.`;
}

function cfoSnapshotJSON() {
  const m = M();
  return JSON.stringify({
    currency: CCY, date: todayISO(),
    personal: {
      netWorth: m.netWorth, cash: m.cash, creditCardDebt: m.creditDebt, loans: m.loans,
      investments: state.investments.map((i) => ({ name: i.name, platform: i.platform, invested: i.invested, value: i.value })),
      assets: state.assets.map((a) => ({ name: a.name, type: a.type, value: a.value })),
      monthIncome: m.monthIncome, monthSpend: m.monthSpend, savingsRatePct: Math.round(m.savingsRate),
      avgMonthlySpend: Math.round(m.avgSpend), avgMonthlySavings: Math.round(m.avgSavings),
      spendByCategoryThisMonth: Object.fromEntries(spendByCategory(thisMonth())),
      subscriptions: detectSubscriptions().slice(0, 10),
      goals: state.goals,
      emergencyBufferMonths: +m.emergencyMonths.toFixed(1)
    },
    business_mendtech: {
      cash: m.bizCash, receivedThisMonth: m.bizIn, paidThisMonth: m.bizOut,
      avgMonthlyBurn: Math.round(m.bizBurn),
      receivables: state.biz.receivables, upcomingExpenses: state.biz.upcoming,
      forecast: { d30: bizForecast(30), d60: bizForecast(60), d90: bizForecast(90) },
      safeWithdrawal: m.safeWithdraw, runwayMonths: +m.runwayMonths.toFixed(1)
    },
    recentSnapshots: state.snapshots.slice(-6),
    healthScore: healthScore(m)
  });
}

async function cfoClaudeAnswer(question) {
  const key = state.settings.apiKey;
  const sys = `You are the private CFO for Johnson, owner of Mendonca Technical Services (Mendtech), a Dubai home-maintenance company. Answer using ONLY the financial snapshot below (AED). Be direct, specific and numeric; give a clear recommendation when asked for judgement. Keep answers under 150 words, plain text (no markdown headers). Never invent numbers not derivable from the snapshot.\n\nFINANCIAL SNAPSHOT:\n${cfoSnapshotJSON()}`;
  const history = state.cfoLog.slice(-8).map((msg) => ({ role: msg.role === "user" ? "user" : "assistant", content: msg.text }));
  history.push({ role: "user", content: question });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: sys,
      messages: history
    })
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error("API " + res.status + ": " + errBody.slice(0, 160));
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  if (!text) throw new Error("Empty response");
  return text;
}

let cfoBusy = false;
async function sendCFO(presetText) {
  if (cfoBusy) return;
  const input = $("#cfoInput");
  const q = (typeof presetText === "string" ? presetText : input.value).trim();
  if (!q) return;
  input.value = "";
  state.cfoLog.push({ role: "user", text: q });
  renderCfoLog();
  cfoBusy = true;

  const useClaude = !!state.settings.apiKey;
  const log = $("#cfoLog");
  log.insertAdjacentHTML("beforeend", `<div class="msg cfo thinking" id="cfoThinking">${useClaude ? "Analysing with Claude…" : "Crunching your numbers…"}</div>`);
  log.scrollTop = log.scrollHeight;

  const finish = (text, src) => {
    const th = $("#cfoThinking"); if (th) th.remove();
    state.cfoLog.push({ role: "cfo", text, src });
    if (state.cfoLog.length > 60) state.cfoLog = state.cfoLog.slice(-60);
    saveState(); renderCfoLog(); cfoBusy = false;
  };

  if (useClaude) {
    try {
      const text = await cfoClaudeAnswer(q);
      finish(text, "Claude · claude-opus-4-8");
      return;
    } catch (e) {
      console.warn("Claude call failed, falling back:", e);
      finish(cfoLocalAnswer(q) + "\n\n(Claude unavailable: " + String(e.message).slice(0, 90) + " — answered locally.)", "Local engine · fallback");
      return;
    }
  }
  setTimeout(() => finish(cfoLocalAnswer(q), "Local engine"), 350);
}

/* ------------------------------------------------------------
   9. Toasts, theme, events, init
------------------------------------------------------------ */
function toast(text, kind = "ok") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = text;
  $("#toastRoot").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 2200);
  setTimeout(() => el.remove(), 2600);
}
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.settings.theme === "light" ? "light" : "dark");
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.settings.theme === "light" ? "#f6f6f3" : "#0c111d");
}
function switchView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  $$("#tabbar .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  window.scrollTo({ top: 0 });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "finance-os-backup-" + todayISO() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded", "ok");
}
function importDataFile() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj.accounts || !obj.meta) throw new Error("Not a Finance OS backup");
        state = Object.assign(blankState(), obj);
        saveState(); applyTheme(); renderAll(); toast("Backup restored", "ok");
      } catch (e) { toast("Restore failed: " + e.message, "err"); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-chip]");
  if (chip) { sendCFO(chip.dataset.chip); return; }
  const themeSet = e.target.closest("[data-theme-set]");
  if (themeSet) {
    state.settings.theme = themeSet.dataset.themeSet;
    saveState(); applyTheme(); renderAll(); return;
  }
  const tab = e.target.closest("#tabbar .tab");
  if (tab) { switchView(tab.dataset.view); return; }

  const actEl = e.target.closest("[data-act]");
  if (!actEl) return;
  const act = actEl.dataset.act, id = actEl.dataset.id;
  const actions = {
    "go-cfo": () => switchView("cfo"),
    "add-account": () => accountModal(), "edit-account": () => accountModal(id),
    "add-asset": () => assetModal(), "edit-asset": () => assetModal(id),
    "add-inv": () => investModal(), "edit-inv": () => investModal(id),
    "add-goal": () => goalModal(), "edit-goal": () => goalModal(id),
    "add-txn": () => txnModal(), "edit-txn": () => txnModal(id),
    "add-rec": () => recModal(), "edit-rec": () => recModal(id),
    "add-upc": () => upcModal(), "edit-upc": () => upcModal(id),
    "edit-bizcash": () => bizCashModal(),
    "add-biztxn": () => bizTxnModal(),
    "import-csv": () => csvModal(),
    "mo-prev": () => { moneyMonth = addMonthsKey(moneyMonth, -1); moneyFilter = ""; renderMoney(); },
    "mo-next": () => { if (moneyMonth < thisMonth()) { moneyMonth = addMonthsKey(moneyMonth, 1); moneyFilter = ""; renderMoney(); } },
    "filter-cat": () => { moneyFilter = actEl.dataset.cat === moneyFilter ? "" : actEl.dataset.cat; renderMoney(); },
    "save-key": () => { state.settings.apiKey = $("#apiKeyInput").value.trim(); saveState(); renderSettings(); toast(state.settings.apiKey ? "Key saved on this device" : "Key cleared", "ok"); },
    "clear-key": () => { state.settings.apiKey = ""; saveState(); renderSettings(); toast("Key removed", "ok"); },
    "del-rule": () => { delete state.settings.catOverrides[actEl.dataset.key]; saveState(); renderSettings(); toast("Rule removed", "ok"); },
    "export-data": exportData,
    "import-data": importDataFile,
    "reload-demo": () => {
      if (!confirm("Replace current data with demo data?")) return;
      state = seedState(); saveState(); applyTheme(); renderAll(); toast("Demo data loaded", "ok");
    },
    "wipe": () => {
      if (!confirm("Erase ALL Finance OS data on this device? Export a backup first if unsure.")) return;
      state = blankState(); saveState(); applyTheme(); renderAll(); toast("All data erased", "ok");
    },
  };
  if (actions[act]) actions[act]();
});

$("#refreshBtn").addEventListener("click", doRefresh);
$("#themeBtn").addEventListener("click", () => {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  saveState(); applyTheme(); renderAll();
});

/* init */
loadState();
applyTheme();
renderAll();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
