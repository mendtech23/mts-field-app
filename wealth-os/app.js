/* ============================================================
   Wealth OS — Johnny's Edge
   A private wealth command centre: expenses, budget, investments,
   debt, net worth, goals and a rule-driven advisor.

   Seeded from Johnnys_Edge_Lifetime_Finance.xlsx (as of 25 Aug 2026).
   All state lives in localStorage on this device — nothing leaves it.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------ helpers -- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (arr, f = (x) => x) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const CCY = "AED";
function fmt(n, d = 2) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-AE", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function money(n, d = 2) { return CCY + " " + fmt(n, d); }
function money0(n) { return CCY + " " + fmt(n, 0); }
function signMoney(n) { return (n >= 0 ? "+" : "−") + CCY + " " + fmt(Math.abs(n)); }
function compact(n) {
  const v = Math.abs(Number(n) || 0), s = n < 0 ? "−" : "";
  if (v >= 1e6) return s + CCY + " " + (v / 1e6).toFixed(2) + "m";
  if (v >= 1e3) return s + CCY + " " + (v / 1e3).toFixed(1) + "k";
  return s + CCY + " " + v.toFixed(0);
}
function pct(n, d = 1) { return ((Number(n) || 0) * 100).toFixed(d) + "%"; }

function iso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function todayISO() { return iso(new Date()); }
function monthKey(s) { return String(s).slice(0, 7); }
function monthLabel(k) {
  const [y, m] = String(k).split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function shortDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function longDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function daysUntil(isoStr) {
  const a = new Date(todayISO()), b = new Date(isoStr);
  return Math.round((b - a) / 86400000);
}
function addMonths(k, n) {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/* =========================================================== seed data == */
/* Every figure below is transcribed from the workbook and carries the same
   status the workbook gives it: "actual" means confirmed against a bank
   message, statement or bill; "estimate" means it has not happened yet. */

const SEED_ACCOUNTS = [
  { id: "fab4001", name: "FAB 4001 — spending",   bank: "FAB",   balance: 3.45,    ccy: "AED", kind: "current",   locked: false, asOf: "2026-08-25", status: "actual",
    note: "Day-to-day card account. Confirmed after the ENOC purchase." },
  { id: "fab4002", name: "FAB 4002 — rent",       bank: "FAB",   balance: 6090.70, ccy: "AED", kind: "current",   locked: true,  asOf: "2026-08-23", status: "actual",
    note: "Holds AED 5,990.45 of protected rent plus AED 100.25 towards DEWA." },
  { id: "fabemg",  name: "FAB emergency fund",    bank: "FAB",   balance: 7.67,    ccy: "AED", kind: "savings",   locked: true,  asOf: "2026-08-25", status: "actual",
    note: "Ring-fenced. Never spend." },
  { id: "nbdcur",  name: "NBD current",           bank: "NBD",   balance: 0.20,    ccy: "AED", kind: "current",   locked: false, asOf: "2026-08-17", status: "actual",
    note: "Card-linked; effectively empty." },
  { id: "nbdsav",  name: "NBD Plus Saver",        bank: "NBD",   balance: 2.73,    ccy: "AED", kind: "savings",   locked: false, asOf: "2026-08-14", status: "reported",
    note: "Last reported 14 Aug; refresh if it has moved." },
  { id: "tabbyc",  name: "Tabby Cash wallet",     bank: "Tabby", balance: 0.89,    ccy: "AED", kind: "wallet",    locked: false, asOf: "2026-08-14", status: "reported",
    note: "The wallet, not the Card. Spending it never touches Card debt." },
  { id: "cash",    name: "Cash on hand / Wio",    bank: "Cash",  balance: 0,       ccy: "AED", kind: "cash",      locked: false, asOf: "2026-08-25", status: "actual",
    note: "No other cash balance reported." },
];

const SEED_HOLDINGS = [
  { id: "h1", name: "Nippon Large Cap",      house: "Nippon",        cls: "Indian large cap", units: 758.192, cost: 75000,    value: 78012.04, nav: 102.89,       ccy: "INR", sip: "Active",    note: "MF Central 10 Aug" },
  { id: "h2", name: "Nippon Multi Cap",      house: "Nippon",        cls: "Indian multi cap", units: 226.127, cost: 73936.89, value: 77061.61, nav: 340.7896,     ccy: "INR", sip: "Active",    note: "Multi Cap email confirms 8.803 new units" },
  { id: "h3", name: "Nippon Growth Mid Cap", house: "Nippon",        cls: "Indian mid cap",   units: 6.993,   cost: 33000,    value: 35303.33, nav: 5048.38,      ccy: "INR", sip: "Active",    note: "MF Central 10 Aug" },
  { id: "h4", name: "Nippon Small Cap",      house: "Nippon",        cls: "Indian small cap", units: 189.636, cost: 35968,    value: 39456.63, nav: 208.07,       ccy: "INR", sip: "Active",    note: "MF Central 10 Aug" },
  { id: "h5", name: "Nippon Silver ETF FoF", house: "Nippon",        cls: "Commodity",        units: 115.191, cost: 2971.14,  value: 4046.82,  nav: 35.13,        ccy: "INR", sip: "Cancelled", note: "Holding remains; SIP cancelled" },
  { id: "h6", name: "Motilal Oswal Midcap",  house: "Motilal Oswal", cls: "Indian mid cap",   units: 93.721,  cost: 11000,    value: 11206.72, nav: 119.5753353,  ccy: "INR", sip: "Active",    note: "MF Central 10 Aug" },
  { id: "h7", name: "Amana trading account", house: "Amana Capital", cls: "Global equity",    units: 41,      cost: 852.11,   value: 864.82,   nav: 0,            ccy: "USD", sip: "Manual",    note: "41 open positions; statement through 10 Aug" },
  { id: "h8", name: "ICICI settlement cash", house: "ICICI",         cls: "Broker cash",      units: 0,       cost: 388.51,   value: 388.51,   nav: 0,            ccy: "INR", sip: "Idle",      note: "Rupee cash left after the August SIPs" },
];

const ALLOC_TARGETS = {
  "Indian large cap": 0.30, "Indian multi cap": 0.20, "Indian mid cap": 0.15,
  "Indian small cap": 0.10, "Commodity": 0.05, "Global equity": 0.15, "Broker cash": 0.05,
};

const SEED_OBLIGATIONS = [
  { id: "o1", due: "2026-08-31", name: "DEWA August",           amount: 813.28,  status: "actual",   recurrence: "Monthly",   priority: "Essential", note: "Actual bill replaces the AED 793.42 estimate." },
  { id: "o2", due: "2026-09-03", name: "Tabby no-fee minimum",  amount: 1314.50, status: "actual",   recurrence: "Statement", priority: "Critical",  note: "Autopay selected; keep the card frozen." },
  { id: "o3", due: "2026-09-10", name: "Nippon SIP funding",    amount: 462.40,  status: "estimate", recurrence: "Monthly",   priority: "Wealth",    note: "INR 12,000 at the last confirmed transfer rate." },
  { id: "o4", due: "2026-09-15", name: "du",                    amount: 590.98,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "September estimate; replace with the generated bill." },
  { id: "o5", due: "2026-09-15", name: "Etisalat",              amount: 323.95,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "September estimate; replace with the generated bill." },
  { id: "o6", due: "2026-10-03", name: "October Tabby payment", amount: 715.33,  status: "actual",   recurrence: "Statement", priority: "Critical",  note: "September statement generated and confirmed." },
  { id: "o7", due: "2026-10-22", name: "Rent cheque",           amount: 11750,   status: "actual",   recurrence: "Lease",     priority: "Critical",  note: "Must be fully funded by 21 Oct; the 26 Oct salary is too late." },
];

const SEED_BUDGET = [
  { id: "b1",  group: "Essential",      line: "Rent accrual",         plan: 3916.67, cat: null,                   priority: "Critical",      note: "The cheque is a subscription, not a surprise. Accrue it monthly." },
  { id: "b2",  group: "Essential",      line: "Utilities & Telecom",  plan: 1728.21, cat: "Utilities & Telecom",  priority: "Critical",      note: "DEWA 813.28 + du 590.98 + Etisalat 323.95." },
  { id: "b3",  group: "Essential",      line: "Groceries",            plan: 450,     cat: "Groceries",            priority: "Essential",     note: "One weekly shop beats six top-up trips." },
  { id: "b4",  group: "Essential",      line: "Fuel & Transport",     plan: 250,     cat: "Fuel & Transport",     priority: "Essential",     note: "Work-essential. Cut this last." },
  { id: "b5",  group: "Essential",      line: "Family & Support",     plan: 100,     cat: "Family & Support",     priority: "Essential",     note: "Medical and family transfers." },
  { id: "b6",  group: "Lifestyle",      line: "Dining",               plan: 200,     cat: "Dining",               priority: "Discretionary", note: "The largest controllable number in the ledger." },
  { id: "b7",  group: "Lifestyle",      line: "Lifestyle & Shopping", plan: 100,     cat: "Lifestyle & Shopping", priority: "Discretionary", note: "Convenience stores and hotels." },
  { id: "b8",  group: "Lifestyle",      line: "Grooming",             plan: 65,      cat: "Grooming",             priority: "Discretionary", note: "One barber visit a month." },
  { id: "b9",  group: "Lifestyle",      line: "Travel",               plan: 0,       cat: "Travel",               priority: "Deferred",      note: "Nothing before the October cheque clears." },
  { id: "b10", group: "Lifestyle",      line: "Bank Fees",            plan: 10,      cat: "Bank Fees",            priority: "Avoidable",     note: "Pure leakage. Batch your transfers." },
  { id: "b11", group: "Lifestyle",      line: "Unreconciled",         plan: 0,       cat: "Unreconciled",         priority: "Control",       note: "Target zero: every dirham should have a name." },
  { id: "b12", group: "Debt & Wealth",  line: "Tabby repayment",      plan: 1314.50, cat: null,                   priority: "Critical",      note: "The no-fee minimum. Never late." },
  { id: "b13", group: "Debt & Wealth",  line: "Nippon SIP",           plan: 462.40,  cat: null,                   priority: "Wealth",        note: "The only line in the budget that compounds." },
  { id: "b14", group: "Debt & Wealth",  line: "Emergency top-up",     plan: 200,     cat: null,                   priority: "Wealth",        note: "The smallest amount that makes the number move." },
];

const CATEGORIES = [
  "Groceries", "Dining", "Fuel & Transport", "Utilities & Telecom", "Lifestyle & Shopping",
  "Grooming", "Travel", "Family & Support", "Bank Fees", "Unreconciled", "Excluded",
];

const CAT_COLOR = {
  "Groceries": "var(--s2)", "Dining": "var(--s8)", "Fuel & Transport": "var(--s1)",
  "Utilities & Telecom": "var(--s5)", "Lifestyle & Shopping": "var(--s3)", "Grooming": "var(--s7)",
  "Travel": "var(--s6)", "Family & Support": "var(--s4)", "Bank Fees": "var(--muted)",
  "Unreconciled": "var(--bad)", "Excluded": "var(--surface-3)",
};

/* Merchant rules used to auto-categorise anything typed into the Add sheet. */
const RULES = [
  [/asas|srn|s r n|raya|shams|star grocery|al rafah|jackson|supermarket|grocery|baker/i, "Groceries"],
  [/kfc|burger|restaurant|cafe|zomato|talabat|mandi|kabab|falcon|texas|salkara|team taste|ice cream|hours f and b|sofitel|curry|tikka|altikka|eat and drink|pak almadina/i, "Dining"],
  [/enoc|emarat|adnoc|petrol|fuel|rta|metro|careem|uber|taxi|parking|salik/i, "Fuel & Transport"],
  [/dewa|du |etisalat|dubaipay|e& |telecom|internet|electricity|water/i, "Utilities & Telecom"],
  [/saloon|salon|barber|grooming/i, "Grooming"],
  [/emirates|flydubai|airline|ticket|hotel|duty free|booking/i, "Travel"],
  [/medical|hospital|clinic|pharmacy|family|support|remit/i, "Family & Support"],
  [/fee|charge|commission/i, "Bank Fees"],
  [/transfer|salary|refund|reversal/i, "Excluded"],
];
function categorise(desc) {
  for (const [re, cat] of RULES) if (re.test(String(desc || ""))) return cat;
  return "Lifestyle & Shopping";
}

/* The confirmed ledger, 3–25 Aug 2026. `counts` marks whether a line is real
   spending: internal transfers, salary credits and fully refunded charges
   are recorded for the audit trail but never totalled as expenditure. */
const SEED_TX = [
  ["2026-08-03T11:20","FAB","du + Etisalat via DubaiPay",914.93,"Utilities & Telecom","Household",1,2535.86,"Expense · paid once"],
  ["2026-08-03T12:00","NBD","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,183.92,"Expense"],
  ["2026-08-03T13:00","NBD","Yas Home General Trading",22.97,"Family & Support","Household",1,160.95,"Expense"],
  ["2026-08-03T20:04","NBD","Spicy Falcon Restaurant",16,"Dining","Household",1,144.95,"Expense"],
  ["2026-08-04T04:42","NBD","Emarat Nad Al Hamar",13.5,"Lifestyle & Shopping","Personal",1,131.45,"Expense"],
  ["2026-08-04T05:00","Tabby Cash","Nad Al Hamar Star Grocery",2,"Lifestyle & Shopping","Personal",1,0.89,"Wallet expense; not Card debt"],
  ["2026-08-04T08:00","NBD","Asas Al Madina General",24.5,"Groceries","Household",1,106.95,"Expense"],
  ["2026-08-05T07:48","NBD","Reel Entertainment",20,"Family & Support","Household",1,86.95,"Expense"],
  ["2026-08-05T10:46","NBD","HNS Restaurant and Cafe",10,"Dining","Household",1,76.95,"Expense"],
  ["2026-08-05T10:47","NBD","Burger King Dubai Mall",10,"Dining","Household",1,66.95,"Expense"],
  ["2026-08-05T10:48","NBD","Texas Dubai Mall",10,"Dining","Household",1,56.95,"Expense"],
  ["2026-08-05T15:22","NBD","Team Taste Restaurant",31,"Dining","Household",1,25.95,"Expense"],
  ["2026-08-05T15:23","NBD","Raya Al Talal Supermarket",10.25,"Groceries","Household",1,15.7,"Expense"],
  ["2026-08-05T15:49","FAB","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,2521.86,"Expense"],
  ["2026-08-06T16:43","FAB","Asas Al Madina General",20,"Groceries","Household",1,2501.86,"Expense"],
  ["2026-08-06T20:56","FAB","August salary received early",3740,"Excluded","Excluded",0,6501.86,"Salary timing; not income again at payday"],
  ["2026-08-06T20:57","FAB","Two-ticket profit",260,"Excluded","Excluded",0,6501.86,"Side income"],
  ["2026-08-07T06:00","FAB","e& Money medical support",100,"Family & Support","Household",1,2401.86,"Expense"],
  ["2026-08-07T06:01","FAB","Duplicate e& Money transfer",100,"Excluded","Excluded",0,2301.86,"Receivable; refunded 11 Aug"],
  ["2026-08-07T15:54","FAB","Emirates ticket",1430,"Travel","Household",1,871.86,"Expense; refund pending"],
  ["2026-08-08T07:36","FAB","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,857.86,"Expense"],
  ["2026-08-08T15:45","FAB","RTS Business Bay Hotel",65,"Lifestyle & Shopping","Personal",1,792.86,"Expense"],
  ["2026-08-08T17:24","FAB","RTS Business Bay Hotel",47.25,"Lifestyle & Shopping","Personal",1,745.61,"Expense"],
  ["2026-08-08T17:42","FAB","RTS Business Bay Hotel",274.5,"Lifestyle & Shopping","Personal",1,471.11,"Expense"],
  ["2026-08-08T20:03","FAB","Asas Al Madina General",20.5,"Lifestyle & Shopping","Personal",1,450.61,"Expense"],
  ["2026-08-09T09:43","FAB","Salkara / Team Taste",101.5,"Dining","Household",1,349.11,"Expense"],
  ["2026-08-09T15:37","FAB","Shams Al Qusais Grocery",10,"Lifestyle & Shopping","Personal",1,339.11,"Expense"],
  ["2026-08-09T15:49","FAB","ENOC Site 1006",50,"Fuel & Transport","Household",1,289.11,"Expense"],
  ["2026-08-10T07:49","FAB","Emarat Nad Al Hamar",13.5,"Lifestyle & Shopping","Personal",1,275.61,"Expense"],
  ["2026-08-10T10:37","FAB","Jamahir Al Khair Restaurant",27,"Dining","Household",1,248.61,"Expense"],
  ["2026-08-10T13:29","FAB","Asas Al Madina General",23,"Groceries","Household",1,225.61,"Expense"],
  ["2026-08-10T15:51","FAB","Zomato",66.52,"Dining","Household",1,159.09,"Expense"],
  ["2026-08-11T08:00","FAB","Duplicate e& Money transfer refund",100,"Excluded","Excluded",0,259.09,"Refund; not income"],
  ["2026-08-11T12:00","FAB","Unreconciled balance movement",14,"Unreconciled","Personal",1,245.09,"Balance-derived outflow; merchant unknown"],
  ["2026-08-11T21:30","FAB","Asas Al Madina General",19,"Groceries","Household",1,226.09,"Expense"],
  ["2026-08-12T06:28","FAB","RTA Dubai Metro TVM",20,"Fuel & Transport","Household",1,206.09,"Expense"],
  ["2026-08-12T15:12","FAB","Inward remittance",3000,"Excluded","Excluded",0,3206.09,"AED 1,430 prior salary + AED 1,540 recovery + AED 30 profit"],
  ["2026-08-12T15:20","FAB","Internal transfer 4001 → 4002",3006.09,"Excluded","Excluded",0,7010.7,"Transfer; not spending"],
  ["2026-08-12T19:30","FAB 4001","KFC Nad Al Hamar",33,"Dining","Household",1,167,"Expense"],
  ["2026-08-12T19:43","FAB 4001","KFC Nad Al Hamar",1.5,"Dining","Household",1,165.5,"Expense"],
  ["2026-08-12T21:19","FAB 4001","ASAS Al Madina General",15,"Lifestyle & Shopping","Personal",1,150.5,"Expense"],
  ["2026-08-13T20:01","FAB 4001","Nad Al Hamar Baker",10,"Lifestyle & Shopping","Personal",1,140.5,"Expense"],
  ["2026-08-13T20:59","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,126.5,"Expense"],
  ["2026-08-14T18:08","FAB 4001","Emarat Nad Al Hamar",13.5,"Lifestyle & Shopping","Personal",1,113,"Expense"],
  ["2026-08-14T18:11","FAB 4001","Emarat 6192 Nad Al Ham",50,"Fuel & Transport","Household",1,63,"Work-essential fuel"],
  ["2026-08-15T02:31","FAB 4001","Jackson Trading Co LLC",2,"Lifestyle & Shopping","Personal",1,61,"Expense"],
  ["2026-08-15T02:33","FAB 4001","Jackson Trading Co LLC",3,"Lifestyle & Shopping","Personal",1,58,"Expense"],
  ["2026-08-15T09:40","FAB 4001","Internal transfer 4002 → 4001",100,"Excluded","Excluded",0,158,"Transfer; not income"],
  ["2026-08-15T09:59","FAB 4001","Pak Almadina Restaurant",60.5,"Dining","Personal",1,97.5,"Expense"],
  ["2026-08-15T10:15","FAB 4001","Canva · fully refunded",70,"Excluded","Excluded",0,27.5,"Refunded in full 17 Aug; net expense zero"],
  ["2026-08-15T10:58","FAB 4001","Internal transfer 4002 → 4001",200,"Excluded","Excluded",0,227.5,"Transfer; not income"],
  ["2026-08-15T10:59","FAB 4001","Emarat 1691 Mutina S",120.02,"Fuel & Transport","Personal",1,107.48,"Expense"],
  ["2026-08-15T11:51","FAB 4001","Al Rafah Grocery",5.5,"Groceries","Personal",1,101.98,"Expense"],
  ["2026-08-16T09:51","FAB 4001","Asas Al Madina General",14,"Groceries","Personal",1,87.98,"Expense"],
  ["2026-08-16T11:07","FAB 4001","Asas Al Madina General",7.3,"Groceries","Personal",1,80.68,"Expense"],
  ["2026-08-16T16:36","FAB 4001","Sahil Zam Zam Mandi",52,"Dining","Personal",1,28.68,"Expense"],
  ["2026-08-16T16:50","FAB 4001","Galadari Ice Cream",20.01,"Dining","Personal",1,8.67,"Expense"],
  ["2026-08-16T16:51","FAB 4001","Internal transfer 4002 → 4001",100,"Excluded","Excluded",0,108.67,"Transfer; not income"],
  ["2026-08-16T22:15","FAB 4001","Asas Al Madina General",20.5,"Groceries","Personal",1,88.17,"Expense"],
  ["2026-08-17T15:08","FAB 4001","Asas Al Madina General",14,"Groceries","Personal",1,74.17,"Expense"],
  ["2026-08-17T15:14","NBD current","S R N Supermarket",2,"Groceries","Household",1,0.2,"Expense; NBD card 3695"],
  ["2026-08-17T13:59","FAB 4001","Canva refund · no SMS",70,"Excluded","Excluded",0,122.17,"Balance-derived refund"],
  ["2026-08-17T18:01","FAB 4001","Spicy Falcon Restaurant",22,"Dining","Personal",1,122.17,"Expense"],
  ["2026-08-18T06:45","FAB 4001","Dubai Duty Free",13,"Lifestyle & Shopping","Personal",1,109.17,"Expense"],
  ["2026-08-18T07:27","FAB 4001","Jackson Trading Co LLC",3,"Lifestyle & Shopping","Personal",1,106.17,"Expense"],
  ["2026-08-18T07:28","FAB 4001","Jackson Trading Co LLC",2,"Lifestyle & Shopping","Personal",1,104.17,"Expense"],
  ["2026-08-18T07:50","FAB 4001","External transfer to card 7801",50,"Unreconciled","Personal",1,54.17,"Outflow to an untracked destination"],
  ["2026-08-18T07:51","FAB 4001","External transfer fee",0.49,"Bank Fees","Personal",1,53.68,"Balance-derived fee"],
  ["2026-08-18T21:34","FAB 4001","Malek Altikka Restaurant",30,"Dining","Personal",1,23.68,"Expense"],
  ["2026-08-19T06:27","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Personal",1,10.18,"Expense"],
  ["2026-08-19T19:24","FAB 4001","Internal transfer 4002 → 4001",60,"Excluded","Excluded",0,70.18,"Transfer; not income"],
  ["2026-08-19T19:25","FAB 4001","RTA Dubai Metro",20,"Fuel & Transport","Personal",1,50.18,"Expense"],
  ["2026-08-19T23:15","FAB 4001","Asas Al Madina General",4,"Groceries","Personal",1,46.18,"Expense"],
  ["2026-08-20T17:54","FAB 4001","Asas Al Madina General",14,"Groceries","Personal",1,32.18,"Expense"],
  ["2026-08-20T18:26","FAB 4001","Eat and Drink Restaurant",12,"Dining","Personal",1,20.18,"Expense"],
  ["2026-08-21T08:57","FAB 4001","S R N Supermarket",2.99,"Groceries","Personal",1,17.19,"Expense"],
  ["2026-08-21T09:31","FAB 4001","S R N Supermarket",2.99,"Groceries","Personal",1,14.2,"Expense"],
  ["2026-08-21T12:11","FAB 4001","Asas Al Madina General",13.5,"Groceries","Personal",1,0.7,"Expense"],
  ["2026-08-21T21:31","FAB 4001","Internal transfer 4002 → 4001",100,"Excluded","Excluded",0,100.7,"Transfer; not income"],
  ["2026-08-21T22:03","FAB 4001","Spicy Falcon Restaurant",26.5,"Dining","Personal",1,74.2,"Expense"],
  ["2026-08-22T11:46","FAB 4001","ISK Gents Saloon",65,"Grooming","Personal",1,9.2,"Expense"],
  ["2026-08-22T11:51","FAB 4001","Internal transfer 4002 → 4001",80,"Excluded","Excluded",0,89.2,"Transfer; not income"],
  ["2026-08-22T11:53","FAB 4001","Asas Al Madina General",14,"Groceries","Personal",1,75.2,"Expense"],
  ["2026-08-22T15:25","FAB 4001","Internal transfer 4002 → 4001",200,"Excluded","Excluded",0,275.2,"Transfer; not income"],
  ["2026-08-22T15:31","FAB 4001","25 Hours F and B",63.75,"Dining","Personal",1,211.45,"Expense"],
  ["2026-08-22T15:40","FAB 4001","25 Hours F and B",100,"Dining","Personal",1,111.45,"Expense"],
  ["2026-08-22T17:18","FAB 4001","Internal transfer 4002 → 4001",500,"Excluded","Excluded",0,611.45,"Transfer; not income"],
  ["2026-08-22T17:40","FAB 4001","Sofitel Dubai Downtown",10,"Dining","Personal",1,601.45,"Expense"],
  ["2026-08-22T19:04","FAB 4001","Curry Chatti Restaurant",4,"Dining","Personal",1,597.45,"Expense"],
  ["2026-08-23T00:12","FAB 4001","Asas Al Madina General",39,"Groceries","Personal",1,558.45,"Expense"],
  ["2026-08-23T12:08","FAB 4001","Asas Al Madina General",20,"Groceries","Personal",1,538.45,"Expense"],
  ["2026-08-23T19:03","FAB 4001","Cielo Kabab Restaurant",78,"Dining","Personal",1,460.45,"Expense"],
  ["2026-08-23T19:06","FAB 4001","Nad Al Hamar Star Grocery",10,"Groceries","Personal",1,450.45,"Expense"],
  ["2026-08-23T21:37","FAB 4001","Internal transfer 4001 → 4002",420,"Excluded","Excluded",0,30.45,"Transfer; not spending"],
  ["2026-08-24T06:34","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Personal",1,16.95,"Expense"],
  ["2026-08-25T06:36","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Personal",1,3.45,"Expense"],
].map(([date, bank, merchant, amount, category, split, counts, balanceAfter, note], i) => ({
  id: "s" + i, date, bank, merchant, amount, category, split, counts, balanceAfter, note, kind: "expense",
}));

const SEED_INCOME = [
  { id: "i1", date: "2026-08-06", name: "August salary (early portion)", amount: 3740,    status: "actual",   note: "Two-ticket salary recovery; already in cash." },
  { id: "i2", date: "2026-08-06", name: "Two-ticket profit",             amount: 260,     status: "actual",   note: "AED 4,000 received less AED 3,740 recovery." },
  { id: "i3", date: "2026-08-12", name: "Third-ticket recovery",         amount: 1540,    status: "actual",   note: "Salary advance received 12 Aug." },
  { id: "i4", date: "2026-08-12", name: "Third-ticket profit",           amount: 30,      status: "actual",   note: "Profit received 12 Aug." },
  { id: "i5", date: "2026-08-12", name: "Prior-month salary",            amount: 1430,    status: "actual",   note: "Allocated to rent." },
  { id: "i6", date: "2026-08-26", name: "Remaining payday cash",         amount: 2906,    status: "estimate", note: "Expected 26 Aug. Never counted as banked until it lands." },
];

const SEED_GOALS = [
  { id: "g1", stage: 1, name: "Close the September funding gap",       target: 651.59,  currentRef: "looseCash",   deadline: "2026-09-15", note: "Bills, survival spending and the SIP through 15 Sep against loose cash." },
  { id: "g2", stage: 1, name: "Fully fund the October rent cheque",    target: 11750,   currentRef: "rentHeld",    deadline: "2026-10-21", note: "The cheque clears 22 Oct; the 26 Oct salary is four days too late." },
  { id: "g3", stage: 1, name: "Clear the Tabby card to zero",          target: 2687.36, currentRef: "debtCleared", deadline: "2026-11-03", note: "Follow the schedule and this closes with no fees." },
  { id: "g4", stage: 2, name: "Emergency fund — first milestone",      target: 1000,    currentRef: "emergency",   deadline: "2027-03-31", note: "AED 1,000 ends the era where one flat tyre is a crisis." },
  { id: "g5", stage: 2, name: "Emergency fund — three months",         target: null,    currentRef: "emergency",   deadline: "2027-12-31", note: "Three months of essential spending.", months: 3 },
  { id: "g6", stage: 2, name: "Emergency fund — six months",           target: null,    currentRef: "emergency",   deadline: "2029-06-30", note: "Full target. The SIP never has to be paused again.", months: 6 },
  { id: "g7", stage: 2, name: "Rent vault — one full year of rent",    target: null,    currentRef: "rentHeld",    deadline: "2028-10-21", note: "Ends the October panic permanently.", yearRent: true },
  { id: "g8", stage: 3, name: "Investments reach AED 25,000",          target: 25000,   currentRef: "invested",    deadline: "2029-09-01", note: "Roughly 2.5x the current portfolio on the current SIP alone." },
  { id: "g9", stage: 3, name: "Net worth reaches AED 100,000",         target: 100000,  currentRef: "netWorth",    deadline: "2032-09-01", note: "A year of net salary held as capital." },
  { id: "g10",stage: 3, name: "Net worth reaches AED 250,000",         target: 250000,  currentRef: "netWorth",    deadline: "2036-09-01", note: "Growth in a normal year starts to rival what saving adds." },
  { id: "g11",stage: 3, name: "Capital covers essential living costs", target: null,    currentRef: "invested",    deadline: "2046-09-01", note: "Financial independence.", fiTarget: true },
];

const SEED_ASSUMPTIONS = {
  aedPerInr: 0.0385333,
  aedPerUsd: 3.6725,
  returnIndiaEq: 0.11,
  returnGlobalEq: 0.08,
  returnCash: 0.02,
  returnCommodity: 0.05,
  inflation: 0.025,
  scenarioAdj: 0,
  salary: 7914.88,
  salaryIncrement: 0.04,
  rentCheque: 11750,
  rentChequesPerYear: 4,
  targetSavingsRate: 0.20,
  sipStepUp: 0.10,
  extraMonthly: 0,
  emergencyMonths: 6,
  horizonYears: 20,
  swr: 0.04,
  dailyCap: 5,
  rentProtected: 5990.45,
  tabbyExposure: 2687.36,
  tabbyMinSep: 1314.50,
  tabbyFullAug: 1972.03,
  tabbyOct: 715.33,
  sipAed: 462.40,
  survivalToSep25: 160,
};

/* ============================================================== state == */
const LS_KEY = "wealth-os-v1";

function blankState() {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    asOf: "2026-08-25",
    assumptions: { ...SEED_ASSUMPTIONS },
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    holdings: SEED_HOLDINGS.map((h) => ({ ...h })),
    obligations: SEED_OBLIGATIONS.map((o) => ({ ...o, paid: false })),
    budget: SEED_BUDGET.map((b) => ({ ...b })),
    tx: SEED_TX.map((t) => ({ ...t })),
    income: SEED_INCOME.map((i) => ({ ...i })),
    goals: SEED_GOALS.map((g) => ({ ...g })),
    debtPayments: [
      { id: "d1", date: "2026-09-03", amount: 1314.50, paid: false, from: "26 Aug salary",  note: "Confirmed no-fee minimum. Autopay selected." },
      { id: "d2", date: "2026-10-03", amount: 715.33,  paid: false, from: "26 Sep salary",  note: "Generated September statement." },
      { id: "d3", date: "2026-11-03", amount: 657.53,  paid: false, from: "26 Oct salary",  note: "Tail of the August statement. Clears the card." },
    ],
    dismissed: [],
    theme: "dark",
  };
}

let state = blankState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blankState();
    const s = JSON.parse(raw);
    const base = blankState();
    // Shallow-merge so a new release can add fields without wiping a device.
    return { ...base, ...s, assumptions: { ...base.assumptions, ...(s.assumptions || {}) } };
  } catch (e) {
    console.warn("Could not read saved state; starting fresh.", e);
    return blankState();
  }
}
function saveState() {
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { toast("Could not save — storage is full or blocked"); }
}

/* ============================================================= engine == */
/* One pure function turns state into every number the UI shows, so a view
   can never disagree with another view about what the position is. */

function metrics(s = state) {
  const A = s.assumptions;
  const inr = A.aedPerInr, usd = A.aedPerUsd;

  const toAed = (v, ccy) => ccy === "INR" ? v * inr : ccy === "USD" ? v * usd : v;

  /* --- cash --- */
  const cashAccounts = s.accounts;
  const liquidCash = sum(cashAccounts, (a) => toAed(a.balance, a.ccy));
  const emergency  = sum(cashAccounts.filter((a) => a.id === "fabemg"), (a) => a.balance);
  const rentHeld   = A.rentProtected;
  const looseCash  = round2(liquidCash - rentHeld - emergency);

  /* --- investments --- */
  const holdings = s.holdings.map((h) => ({
    ...h,
    aed: toAed(h.value, h.ccy),
    costAed: toAed(h.cost, h.ccy),
  }));
  const invested = sum(holdings, (h) => h.aed);
  const investedCost = sum(holdings, (h) => h.costAed);
  const investedGain = invested - investedCost;
  const investedReturn = investedCost ? investedGain / investedCost : 0;

  const byClass = {};
  for (const h of holdings) byClass[h.cls] = (byClass[h.cls] || 0) + h.aed;
  const allocation = Object.keys(ALLOC_TARGETS).map((cls) => {
    const value = byClass[cls] || 0;
    const actual = invested ? value / invested : 0;
    const target = ALLOC_TARGETS[cls];
    return { cls, value, actual, target, drift: actual - target };
  });
  const byHouse = {};
  for (const h of holdings) byHouse[h.house] = (byHouse[h.house] || 0) + h.aed;
  const topHouse = Object.entries(byHouse).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
  const houseConcentration = invested ? topHouse[1] / invested : 0;
  const largestFund = invested ? Math.max(...holdings.map((h) => h.aed)) / invested : 0;
  const inrExposure = invested ? sum(holdings.filter((h) => h.ccy === "INR"), (h) => h.aed) / invested : 0;

  /* --- balance sheet --- */
  const debtOutstanding = sum(s.debtPayments.filter((d) => !d.paid), (d) => d.amount);
  const totalAssets = liquidCash + invested;
  const netWorth = totalAssets - debtOutstanding;
  const rentToFund = Math.max(0, A.rentCheque - rentHeld);

  /* --- ledger --- */
  const spend = s.tx.filter((t) => t.counts);
  const dates = s.tx.map((t) => t.date.slice(0, 10)).sort();
  const firstDate = dates[0] || todayISO();
  const lastDate = dates[dates.length - 1] || todayISO();
  const days = Math.max(1, Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000) + 1);
  const runRate = 30.44 / days;

  const byCat = {};
  for (const t of spend) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  const totalSpend = sum(spend, (t) => t.amount);
  const categories = Object.entries(byCat)
    .map(([cat, total]) => ({
      cat, total,
      share: totalSpend ? total / totalSpend : 0,
      perDay: total / days,
      personal: sum(spend.filter((t) => t.category === cat && t.split === "Personal"), (t) => t.amount),
      household: sum(spend.filter((t) => t.category === cat && t.split !== "Personal"), (t) => t.amount),
    }))
    .sort((a, b) => b.total - a.total);

  const byMerchant = {};
  for (const t of spend) {
    const k = t.merchant;
    byMerchant[k] = byMerchant[k] || { merchant: k, total: 0, count: 0 };
    byMerchant[k].total += t.amount;
    byMerchant[k].count += 1;
  }
  const merchants = Object.values(byMerchant)
    .map((m) => ({ ...m, avg: m.total / m.count }))
    .sort((a, b) => b.total - a.total);

  const oneOff = byCat["Travel"] || 0;
  const utilities = byCat["Utilities & Telecom"] || 0;
  const livingSpend = totalSpend - oneOff - utilities;
  const dailyBurn = livingSpend / days;
  const monthlyRunRate = totalSpend * runRate;
  const personalShare = totalSpend ? sum(spend.filter((t) => t.split === "Personal"), (t) => t.amount) / totalSpend : 0;

  /* --- budget --- */
  const budget = s.budget.map((b) => {
    const actual = b.cat ? (byCat[b.cat] || 0) : 0;
    const rate = actual * runRate;
    return { ...b, actual, rate, variance: rate - b.plan };
  });
  const grp = (g) => budget.filter((b) => b.group === g);
  const essential = sum(grp("Essential"), (b) => b.plan);
  const lifestyle = sum(grp("Lifestyle"), (b) => b.plan);
  const wealthOut = sum(grp("Debt & Wealth"), (b) => b.plan);
  const lifestyleRate = sum(grp("Lifestyle"), (b) => b.rate);
  const income = A.salary;
  const totalOutflow = essential + lifestyle + wealthOut;
  const surplus = income - totalOutflow;
  const sipPlan = (budget.find((b) => b.id === "b13") || {}).plan || 0;
  const emgPlan = (budget.find((b) => b.id === "b14") || {}).plan || 0;
  const savingsRate = income ? (sipPlan + emgPlan) / income : 0;

  /* --- near-term funding gap --- */
  const nearBills = 813.28 + A.tabbyMinSep + 590.98 + 323.95;
  const availableToSep = looseCash + 2906;
  const billsGap = Math.max(0, nearBills + A.survivalToSep25 - availableToSep);
  const extraCashNeeded = billsGap + A.sipAed;

  /* --- coverage --- */
  const emergencyTarget = essential * A.emergencyMonths;
  const emergencyCover = essential ? emergency / essential : 0;
  const liquidityMonths = essential ? looseCash / essential : 0;
  const debtToAssets = totalAssets ? debtOutstanding / totalAssets : 0;

  /* --- health score --- */
  const comp = [
    { key: "Liquidity",   label: "Free cash against one month of essentials", score: clamp(liquidityMonths * 100, 0, 100), weight: 0.20 },
    { key: "Emergency",   label: "Emergency cover against the six-month target", score: clamp(emergencyTarget ? emergency / emergencyTarget * 100 : 0, 0, 100), weight: 0.20 },
    { key: "Debt",        label: "Exposure against total assets", score: clamp((1 - debtToAssets) * 100, 0, 100), weight: 0.15 },
    { key: "Savings",     label: "Savings rate achieved against target", score: clamp(A.targetSavingsRate ? savingsRate / A.targetSavingsRate * 100 : 0, 0, 100), weight: 0.20 },
    { key: "Balance",     label: "Does the plan fit the salary", score: surplus >= 0 ? 100 : clamp(100 + (surplus / Math.max(1, income)) * 100, 0, 100), weight: 0.15 },
    { key: "Discipline",  label: "Lifestyle plan against actual run rate", score: clamp(lifestyleRate ? lifestyle / lifestyleRate * 100 : 100, 0, 100), weight: 0.10 },
  ];
  const health = sum(comp, (c) => c.score * c.weight);
  const grade = health >= 80 ? "A" : health >= 65 ? "B" : health >= 50 ? "C" : health >= 35 ? "D" : "E";

  /* --- projection --- */
  const blended = (invested
    ? (sum(holdings.filter((h) => h.ccy === "INR" && h.cls !== "Broker cash" && h.cls !== "Commodity"), (h) => h.aed) * A.returnIndiaEq
      + sum(holdings.filter((h) => h.cls === "Commodity"), (h) => h.aed) * A.returnCommodity
      + sum(holdings.filter((h) => h.cls === "Global equity"), (h) => h.aed) * A.returnGlobalEq
      + sum(holdings.filter((h) => h.cls === "Broker cash"), (h) => h.aed) * A.returnCash) / invested
    : A.returnIndiaEq) + A.scenarioAdj;

  const monthly = sipPlan + A.extraMonthly;
  const projection = project(invested, monthly * 12, blended, A.sipStepUp, A.inflation, A.horizonYears);

  const annualEssential = essential * 12;
  const fiTarget = A.swr ? annualEssential / A.swr : 0;
  const fiYear = projection.findIndex((p) => p.realClosing >= fiTarget);
  const yearsToFI = fiYear === -1 ? null : fiYear + 1;

  return {
    A, liquidCash, emergency, rentHeld, looseCash, holdings, invested, investedCost,
    investedGain, investedReturn, allocation, byHouse, topHouse, houseConcentration,
    largestFund, inrExposure, debtOutstanding, totalAssets, netWorth, rentToFund,
    spend, firstDate, lastDate, days, runRate, categories, merchants, totalSpend,
    livingSpend, dailyBurn, monthlyRunRate, personalShare, budget, essential, lifestyle,
    wealthOut, lifestyleRate, income, totalOutflow, surplus, savingsRate, sipPlan, emgPlan,
    nearBills, availableToSep, billsGap, extraCashNeeded, emergencyTarget, emergencyCover,
    liquidityMonths, debtToAssets, comp, health, grade, blended, monthly, projection,
    annualEssential, fiTarget, yearsToFI,
  };
}

/* Year-end contributions, growth on the opening balance. Deliberately the
   same convention as the workbook, so the two never disagree. */
function project(p0, c1, r, g, infl, n) {
  const out = [];
  let opening = p0, contribution = c1, cumulative = 0;
  for (let y = 1; y <= n; y++) {
    const growth = opening * r;
    const closing = opening + contribution + growth;
    cumulative += contribution;
    out.push({
      year: y,
      calendar: 2026 + y,
      opening, contribution, growth, closing,
      realClosing: closing / Math.pow(1 + infl, y),
      cumulative,
    });
    opening = closing;
    contribution = contribution * (1 + g);
  }
  return out;
}

/* Closed form of the same series — used for the sensitivity table so a
   scenario does not need a full loop. */
function futureValue(p0, c1, r, g, n) {
  if (Math.abs(r - g) < 1e-4) return p0 * Math.pow(1 + r, n) + c1 * n * Math.pow(1 + r, n - 1);
  return p0 * Math.pow(1 + r, n) + c1 * (Math.pow(1 + r, n) - Math.pow(1 + g, n)) / (r - g);
}

/* ============================================================ advisor == */
/* Rules, not a chat box. Each one re-decides itself from the live position,
   so an item closes when the data says it is closed. */

function advice(m = metrics(), s = state) {
  const A = m.A;
  const out = [];
  const add = (o) => out.push({ id: o.id, ...o });

  /* ---- urgent, this week ---- */
  add({
    id: "gap-sep", group: "Urgent", title: "Bank the September funding gap",
    open: m.billsGap > 0.01, impact: m.billsGap, effort: "High", by: "2026-09-15",
    status: m.billsGap > 0.01 ? "OPEN" : "CLOSED",
    why: `Confirmed bills of ${money(m.nearBills)} plus ${money(A.survivalToSep25)} of survival spending exceed the `
       + `${money(m.availableToSep)} of loose cash and expected payday. Earn it, or pause the SIP — in that order, `
       + `and never from the protected rent.`,
  });
  add({
    id: "rent-ringfence", group: "Urgent", title: "Do not touch the protected rent in FAB 4002",
    open: m.rentHeld > 0, impact: m.rentHeld, effort: "None", by: "2026-10-21",
    status: m.rentHeld > 0 ? "IN FORCE" : "RELEASED",
    why: `FAB 4002 shows ${money(6090.70)} but only ${money(100.25)} of it is yours to spend. Treating the account `
       + `balance as available is the single most likely way this plan fails.`,
  });
  add({
    id: "tabby-min", group: "Urgent", title: "Let the no-fee minimum run on 3 Sep — do not pay the full statement",
    open: !s.debtPayments[0].paid, impact: A.tabbyFullAug - A.tabbyMinSep, effort: "None", by: "2026-09-03",
    status: s.debtPayments[0].paid ? "DONE" : "SCHEDULED",
    why: `Paying the full August statement costs ${money(A.tabbyFullAug - A.tabbyMinSep)} more in the month you can `
       + `least afford it, and saves no fee at all — Tabby is free while the minimum lands on time.`,
  });
  add({
    id: "salary-confirm", group: "Urgent", title: "Confirm the AED 2,906 salary actually credits",
    open: (s.income.find((i) => i.id === "i6") || {}).status === "estimate",
    impact: 2906, effort: "Low", by: "2026-08-26",
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
    open: m.billsGap > 0.01, impact: A.sipAed, effort: "None", by: "2026-09-08",
    status: m.billsGap > 0.01 ? "CONDITIONAL" : "SAFE TO CONTINUE",
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

  /* Impacts are not all the same kind of number: some are a monthly saving,
     some a one-off amount, one is a twenty-year total. Rank on a common
     monthly-equivalent so a lifetime figure never outranks the rent. */
  const SCALE = {
    "gap-sep": "once", "rent-ringfence": "once", "tabby-min": "once", "salary-confirm": "once",
    dining: "month", telecom: "month", burn: "month", netflix: "month", fees: "month",
    unreconciled: "once", "rent-accrual": "month", "lease-cadence": "once",
    "emergency-1k": "once", "one-account": "once", sweep: "once", concentration: "once",
    "sip-hold": "month", amana: "once", stepup: "life",
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

/* ============================================================= charts == */
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function donut(segments, size = 148, thickness = 22) {
  const total = sum(segments, (s) => s.value) || 1;
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="${thickness}" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset * C).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label)} — ${money(s.value)} (${pct(frac)})</title></circle>`;
    offset += frac;
    return el;
  }).join("");
  return `<svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">${arcs}</svg>`;
}

function ring(scorePct, size = 96, label = "") {
  const t = 9, r = (size - t) / 2, cx = size / 2, C = 2 * Math.PI * r;
  const v = clamp(scorePct, 0, 100) / 100;
  const col = v >= 0.8 ? cssVar("--good") : v >= 0.5 ? cssVar("--warn") : cssVar("--bad");
  return `<svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">
    <circle cx="${cx}" cy="${cy_(size)}" r="${r}" fill="none" stroke="${cssVar("--surface-3")}" stroke-width="${t}"/>
    <circle cx="${cx}" cy="${cy_(size)}" r="${r}" fill="none" stroke="${col}" stroke-width="${t}"
      stroke-linecap="round" stroke-dasharray="${(v * C).toFixed(2)} ${C.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cx})"/>
    <text x="${cx}" y="${cx - 2}" text-anchor="middle" fill="${cssVar("--ink")}"
      font-size="${size * 0.26}" font-weight="700">${Math.round(scorePct)}</text>
    <text x="${cx}" y="${cx + size * 0.17}" text-anchor="middle" fill="${cssVar("--muted")}"
      font-size="${size * 0.12}" font-weight="700" letter-spacing="1">${esc(label)}</text>
  </svg>`;
}
const cy_ = (size) => size / 2;

function areaChart(points, opts = {}) {
  const w = opts.w || 640, h = opts.h || 170, pad = 28;
  if (!points.length) return `<div class="empty">Nothing to plot yet</div>`;
  const ys = points.map((p) => p.y);
  const min = Math.min(0, ...ys), max = Math.max(...ys) * 1.05 || 1;
  const X = (i) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 1.6);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const area = `${line}L${X(points.length - 1).toFixed(1)},${(h - pad).toFixed(1)}L${X(0).toFixed(1)},${(h - pad).toFixed(1)}Z`;
  const grid = [0, 0.5, 1].map((f) => {
    const y = pad * 0.6 + f * (h - pad * 1.6);
    return `<line x1="${pad}" x2="${w - pad}" y1="${y}" y2="${y}" stroke="${cssVar("--hairline")}" stroke-width="1"/>`;
  }).join("");
  const dots = points.map((p, i) =>
    `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${cssVar("--accent")}">
       <title>${esc(p.label)} — ${money0(p.y)}</title></circle>`).join("");
  const labels = points.map((p, i) =>
    (i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2))
      ? `<text x="${X(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" fill="${cssVar("--muted")}" font-size="10">${esc(p.label)}</text>`
      : "").join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" style="height:${h}px">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cssVar("--accent")}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${cssVar("--accent")}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#ag)"/>
    <path d="${line}" fill="none" stroke="${cssVar("--accent")}" stroke-width="2.2" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

function bars(items, opts = {}) {
  const max = Math.max(...items.map((i) => Math.max(i.a || 0, i.b || 0)), 1);
  return items.map((i) => `
    <div style="margin-bottom:11px">
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;margin-bottom:4px">
        <span>${esc(i.label)}</span>
        <span class="mono muted">${money(i.a)}${i.b != null ? " / " + money(i.b) : ""}</span>
      </div>
      <div class="bar ${i.tone || ""}"><i style="width:${clamp((i.a / max) * 100, 0, 100).toFixed(1)}%"></i></div>
    </div>`).join("");
}

/* ============================================================== views == */
function statBlock(items) {
  return `<div class="stats">${items.map((i) => `
    <div class="stat ${i.tone || ""}">
      <div class="k">${esc(i.k)}</div>
      <div class="v">${i.v}</div>
      ${i.n ? `<div class="n">${esc(i.n)}</div>` : ""}
    </div>`).join("")}</div>`;
}

function renderHome() {
  const m = metrics();
  const recs = advice(m).filter((r) => r.open && !r.dismissed).slice(0, 4);
  const rentDays = daysUntil("2026-10-21");
  const gapDays = daysUntil("2026-09-15");

  const proj = m.projection.map((p) => ({ label: String(p.calendar), y: p.closing }));

  $("#view-home").innerHTML = `
    <div class="card hero">
      <div class="hero-label">Net worth</div>
      <div class="hero-value">${money(m.netWorth)}</div>
      <div class="hero-sub">
        ${money(m.totalAssets)} of assets less ${money(m.debtOutstanding)} of debt ·
        <span class="muted">${money(m.invested)} of it compounds</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:16px;flex-wrap:wrap">
        ${ring(m.health, 92, m.grade)}
        <div style="flex:1;min-width:190px">
          ${m.comp.map((c) => `
            <div style="margin-bottom:7px">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-2)">
                <span>${esc(c.key)}</span><span class="mono">${c.score.toFixed(0)}</span>
              </div>
              <div class="bar ${c.score >= 70 ? "good" : c.score >= 40 ? "warn" : "bad"}">
                <i style="width:${c.score.toFixed(0)}%"></i>
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>

    <div class="section-title">The next ninety days</div>
    ${statBlock([
      { k: "Free cash today", v: money(m.looseCash), tone: m.looseCash < 500 ? "bad" : "", n: "Outside rent and emergency" },
      { k: "Rent still to fund", v: money(m.rentToFund), tone: m.rentToFund > 0 ? "bad" : "good", n: `${rentDays} days to 21 Oct` },
      { k: "Needed before 15 Sep", v: money(m.extraCashNeeded), tone: m.extraCashNeeded > 0 ? "warn" : "good", n: `${gapDays} days` },
      { k: "Debt outstanding", v: money(m.debtOutstanding), tone: m.debtOutstanding > 0 ? "warn" : "good", n: "Tabby, frozen" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Cash position</h2><div class="sub">Confirmed balances as of ${longDate(state.asOf)}</div></div>
        <span class="pill">${state.accounts.length} accounts</span>
      </div>
      ${state.accounts.map((a) => `
        <div class="kv">
          <span class="k">${esc(a.name)} ${a.locked ? '<span class="pill warn" style="margin-left:6px">Locked</span>' : ""}</span>
          <span class="v">${money(a.balance)}</span>
        </div>`).join("")}
      <div class="kv" style="border-top:1px solid var(--hairline-2);margin-top:6px;padding-top:10px">
        <span class="k"><strong>Total liquid</strong></span><span class="v">${money(m.liquidCash)}</span>
      </div>
      <div class="note">Of that, ${money(m.rentHeld)} is protected rent and ${money(m.emergency)} is the emergency
        fund. Spendable today: <strong>${money(m.looseCash)}</strong>.</div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>What to do next</h2><div class="sub">Live from the advisor — ${recs.length} open items shown</div></div>
        <button class="btn btn-sm btn-ghost" data-goto="advisor">All →</button>
      </div>
      ${recs.length ? recs.map((r) => `
        <div class="row tap" data-rec="${esc(r.id)}">
          <div class="avatar">${r.priority}</div>
          <div class="row-main">
            <div class="row-title wrap">${esc(r.title)}</div>
            <div class="row-sub">${esc(r.group)} · ${esc(r.status)} · by ${shortDate(r.by)}</div>
          </div>
          <div class="row-val">${r.impact > 0 ? money0(r.impact) : "—"}<span class="small">${impactUnit(r)}</span></div>
        </div>`).join("") : `<div class="empty">Nothing open. That is a first — keep it that way.</div>`}
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Where the money went</h2><div class="sub">${longDate(m.firstDate)} – ${longDate(m.lastDate)} · ${m.days} days</div></div>
        <span class="pill">${money(m.totalSpend)}</span>
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
      <div class="note ${m.dailyBurn > m.A.dailyCap ? "bad" : "good"}">
        Day-to-day living is running at <strong>${money(m.dailyBurn)} a day</strong> against the
        ${money(m.A.dailyCap)} damage-control cap. At this pace a full month costs
        ${money(m.monthlyRunRate)} against a salary of ${money(m.income)}.
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Where this ends up</h2>
        <div class="sub">${m.A.horizonYears} years at ${pct(m.blended)} blended, ${money(m.monthly)}/month rising ${pct(m.A.sipStepUp, 0)} a year</div></div>
        <button class="btn btn-sm btn-ghost" data-goto="plan">Plan →</button>
      </div>
      ${areaChart(proj)}
      <div class="stats" style="margin-top:12px">
        <div class="stat"><div class="k">At horizon</div><div class="v">${compact(m.projection[m.projection.length-1].closing)}</div><div class="n">nominal</div></div>
        <div class="stat"><div class="k">Today's money</div><div class="v">${compact(m.projection[m.projection.length-1].realClosing)}</div><div class="n">after inflation</div></div>
        <div class="stat"><div class="k">You put in</div><div class="v">${compact(m.projection[m.projection.length-1].cumulative)}</div><div class="n">contributions</div></div>
      </div>
    </div>`;
}

function renderMoney() {
  const m = metrics();
  const f = state._filter || { q: "", cat: "", split: "", month: "" };
  const months = [...new Set(state.tx.map((t) => monthKey(t.date)))].sort().reverse();

  let rows = state.tx.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (f.q) rows = rows.filter((t) => (t.merchant + " " + t.note).toLowerCase().includes(f.q.toLowerCase()));
  if (f.cat) rows = rows.filter((t) => t.category === f.cat);
  if (f.split) rows = rows.filter((t) => t.split === f.split);
  if (f.month) rows = rows.filter((t) => monthKey(t.date) === f.month);

  const shown = sum(rows.filter((t) => t.counts), (t) => t.amount);

  $("#view-money").innerHTML = `
    ${statBlock([
      { k: "Confirmed spending", v: money(m.totalSpend), n: `${m.days} days` },
      { k: "Per day", v: money(m.totalSpend / m.days), n: "all categories" },
      { k: "Living per day", v: money(m.dailyBurn), tone: m.dailyBurn > m.A.dailyCap ? "bad" : "good", n: `cap ${money(m.A.dailyCap)}` },
      { k: "Monthly run rate", v: money(m.monthlyRunRate), tone: m.monthlyRunRate > m.income ? "bad" : "good", n: `salary ${money0(m.income)}` },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Transactions</h2><div class="sub">${rows.length} shown · ${money(shown)} counted as spending</div></div>
        <button class="btn btn-sm btn-accent" id="mAdd">＋ Add</button>
      </div>
      <div class="filters">
        <input id="fq" type="search" placeholder="Search merchant or note" value="${esc(f.q)}" />
        <select id="fcat"><option value="">All categories</option>
          ${CATEGORIES.map((c) => `<option ${f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <select id="fsplit"><option value="">Personal + household</option>
          <option ${f.split === "Personal" ? "selected" : ""}>Personal</option>
          <option ${f.split === "Household" ? "selected" : ""}>Household</option></select>
        <select id="fmonth"><option value="">All months</option>
          ${months.map((k) => `<option value="${k}" ${f.month === k ? "selected" : ""}>${monthLabel(k)}</option>`).join("")}</select>
      </div>
    </div>

    <div class="card flush">
      ${rows.length ? rows.map((t) => `
        <div class="row tap" data-tx="${esc(t.id)}">
          <div class="avatar" style="background:${t.counts ? (CAT_COLOR[t.category] || "var(--surface-3)") : "var(--surface-3)"};color:${t.counts ? "#fff" : "var(--muted)"}">
            ${esc(t.merchant.slice(0, 1).toUpperCase())}
          </div>
          <div class="row-main">
            <div class="row-title">${esc(t.merchant)}</div>
            <div class="row-sub">${shortDate(t.date)} · ${esc(t.bank)} · ${esc(t.category)}${t.counts ? "" : " · not counted"}</div>
          </div>
          <div class="row-val ${t.counts ? "" : "muted"}">${t.counts ? "−" : ""}${money(t.amount)}
            <span class="small">${esc(t.split)}</span></div>
        </div>`).join("") : `<div class="empty">No transactions match those filters.</div>`}
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Category breakdown</h2>
        <div class="sub">Personal against household, over the ledger window</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Category</th><th class="num">Total</th><th class="num">Share</th>
          <th class="num">Personal</th><th class="num">Household</th><th class="num">Per day</th></tr></thead>
        <tbody>${m.categories.map((c) => `<tr>
          <td>${esc(c.cat)}</td>
          <td class="num">${money(c.total)}</td>
          <td class="num">${pct(c.share)}</td>
          <td class="num">${money(c.personal)}</td>
          <td class="num">${money(c.household)}</td>
          <td class="num">${money(c.perDay)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(m.totalSpend)}</td><td class="num">100.0%</td>
          <td class="num">${money(sum(m.categories, (c) => c.personal))}</td>
          <td class="num">${money(sum(m.categories, (c) => c.household))}</td>
          <td class="num">${money(m.totalSpend / m.days)}</td></tr></tfoot>
      </table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Top merchants</h2>
        <div class="sub">Where repetition, not size, does the damage</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Merchant</th><th class="num">Total</th><th class="num">Times</th><th class="num">Average</th></tr></thead>
        <tbody>${m.merchants.slice(0, 12).map((x) => `<tr>
          <td>${esc(x.merchant)}</td><td class="num">${money(x.total)}</td>
          <td class="num">${x.count}</td><td class="num">${money(x.avg)}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>`;
}

function renderBudget() {
  const m = metrics();
  const groups = ["Essential", "Lifestyle", "Debt & Wealth"];
  const groupTotal = (g, k) => sum(m.budget.filter((b) => b.group === g), (b) => b[k]);

  $("#view-budget").innerHTML = `
    ${statBlock([
      { k: "Net income", v: money(m.income), n: "monthly baseline" },
      { k: "Planned outflow", v: money(m.totalOutflow), tone: m.totalOutflow > m.income ? "bad" : "good" },
      { k: "Surplus", v: money(m.surplus), tone: m.surplus >= 0 ? "good" : "bad", n: m.surplus >= 0 ? "plan balances" : "plan does not balance" },
      { k: "Savings rate", v: pct(m.savingsRate), tone: m.savingsRate >= m.A.targetSavingsRate ? "good" : "warn", n: `target ${pct(m.A.targetSavingsRate, 0)}` },
    ])}

    ${m.surplus < 0 ? `<div class="card"><div class="note bad">
      The plan spends <strong>${money(Math.abs(m.surplus))}</strong> more than the salary each month. That gap has to
      close by cutting lifestyle, dropping a telecom line, or earning more — never by borrowing. Tap any line below
      to change the plan and watch this number move.</div></div>` : ""}

    ${groups.map((g) => `
      <div class="card">
        <div class="card-head">
          <div><h2>${esc(g)}</h2>
            <div class="sub">Plan ${money(groupTotal(g, "plan"))} · run rate ${money(groupTotal(g, "rate"))}</div></div>
          <span class="pill ${groupTotal(g, "rate") > groupTotal(g, "plan") ? "bad" : "good"}">
            ${groupTotal(g, "rate") > groupTotal(g, "plan") ? "over" : "within"}</span>
        </div>
        ${m.budget.filter((b) => b.group === g).map((b) => {
          const usage = b.plan ? b.rate / b.plan : (b.rate ? 2 : 0);
          const tone = !b.cat ? "" : usage > 1 ? "bad" : usage > 0.85 ? "warn" : "good";
          return `<div class="row tap" data-budget="${esc(b.id)}" style="padding-left:0;padding-right:0">
            <div class="row-main">
              <div class="row-title">${esc(b.line)}</div>
              <div class="row-sub">${esc(b.priority)}${b.cat ? ` · actual ${money(b.actual)} over ${m.days} days` : " · not in the ledger"}</div>
              <div class="bar ${tone}" style="margin-top:7px"><i style="width:${clamp(usage * 100, 0, 100).toFixed(0)}%"></i></div>
            </div>
            <div class="row-val">${money(b.plan)}
              <span class="small">${b.cat ? money(b.rate) + " actual" : "planned"}</span></div>
          </div>`;
        }).join("")}
      </div>`).join("")}

    <div class="card">
      <div class="card-head"><div><h2>Health ratios</h2>
        <div class="sub">Against the benchmarks that decide whether a plan is survivable</div></div></div>
      ${[
        ["Savings rate", m.savingsRate, m.A.targetSavingsRate, true, "Investing plus emergency top-ups as a share of income."],
        ["Essential ratio", m.income ? m.essential / m.income : 0, 0.50, false, "Above half of income leaves almost no room to build wealth."],
        ["Lifestyle ratio (plan)", m.income ? m.lifestyle / m.income : 0, 0.15, false, "Discretionary spending as planned."],
        ["Lifestyle ratio (actual)", m.income ? m.lifestyleRate / m.income : 0, 0.15, false, "The same ratio on what the ledger shows. This is the honest one."],
      ].map(([label, v, bench, higherBetter, note]) => {
        const ok = higherBetter ? v >= bench : v <= bench;
        return `<div class="kv"><span class="k">${esc(label)}<br><span class="muted" style="font-size:11.5px">${esc(note)}</span></span>
          <span class="v ${ok ? "num-pos" : "num-neg"}">${pct(v)}<br>
          <span class="muted" style="font-weight:500;font-size:11.5px">target ${pct(bench, 0)}</span></span></div>`;
      }).join("")}
    </div>`;
}

function renderInvest() {
  const m = metrics();
  const funds = m.holdings.filter((h) => h.cls !== "Broker cash");

  $("#view-invest").innerHTML = `
    <div class="card hero">
      <div class="hero-label">Portfolio value</div>
      <div class="hero-value">${money(m.invested)}</div>
      <div class="hero-sub">
        Cost ${money(m.investedCost)} ·
        <span class="${m.investedGain >= 0 ? "num-pos" : "num-neg"}">${signMoney(m.investedGain)} (${pct(m.investedReturn)})</span>
      </div>
    </div>

    ${statBlock([
      { k: "Blended return", v: pct(m.blended), n: "planning assumption" },
      { k: "Fund-house concentration", v: pct(m.houseConcentration), tone: m.houseConcentration > 0.8 ? "bad" : "good", n: esc(m.topHouse[0]) },
      { k: "Rupee exposure", v: pct(m.inrExposure), tone: m.inrExposure > 0.85 ? "warn" : "good", n: "unhedged" },
      { k: "Share of net worth", v: pct(m.netWorth ? m.invested / m.netWorth : 0), n: "the part that compounds" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Holdings</h2><div class="sub">Tap to update a value after a statement</div></div>
        <button class="btn btn-sm btn-ghost" id="iAdd">＋ Holding</button>
      </div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Fund</th><th class="num">Value</th><th class="num">Cost</th>
          <th class="num">Gain</th><th class="num">Return</th><th class="num">Weight</th></tr></thead>
        <tbody>${m.holdings.map((h) => {
          const gain = h.aed - h.costAed;
          return `<tr data-holding="${esc(h.id)}" style="cursor:pointer">
            <td>${esc(h.name)}<div class="muted" style="font-size:11px">${esc(h.house)} · ${esc(h.sip)}</div></td>
            <td class="num">${money(h.aed)}<div class="muted" style="font-size:11px">${h.ccy} ${fmt(h.value)}</div></td>
            <td class="num">${money(h.costAed)}</td>
            <td class="num ${gain >= 0 ? "num-pos" : "num-neg"}">${signMoney(gain)}</td>
            <td class="num ${gain >= 0 ? "num-pos" : "num-neg"}">${pct(h.costAed ? gain / h.costAed : 0)}</td>
            <td class="num">${pct(m.invested ? h.aed / m.invested : 0)}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${money(m.invested)}</td><td class="num">${money(m.investedCost)}</td>
          <td class="num ${m.investedGain >= 0 ? "num-pos" : "num-neg"}">${signMoney(m.investedGain)}</td>
          <td class="num">${pct(m.investedReturn)}</td><td class="num">100.0%</td></tr></tfoot>
      </table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Asset allocation</h2>
        <div class="sub">Actual against target · rebalance with new instalments, never by selling</div></div></div>
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
        SIP instalment at the underweight sleeve — selling costs exit load and a capital-gains event for nothing.</div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Risk controls</h2>
        <div class="sub">The structural risks, which matter more than last month's return</div></div></div>
      ${[
        ["Single fund house", m.houseConcentration, 0.80, `${pct(m.houseConcentration)} sits with ${m.topHouse[0]}. Market risk is diversified; manager and operational risk is not.`],
        ["Largest single fund", m.largestFund, 0.35, "No one fund should dominate the portfolio."],
        ["Small and mid cap", m.invested ? ((m.allocation.find(a=>a.cls==="Indian small cap")||{value:0}).value + (m.allocation.find(a=>a.cls==="Indian mid cap")||{value:0}).value) / m.invested : 0, 0.30, "The volatile end. Fine at this size for a long horizon; painful if it has to be sold early."],
        ["Rupee exposure", m.inrExposure, 0.85, "Almost everything is denominated in rupees while every liability is in dirhams. That is a genuine, unhedged mismatch."],
      ].map(([label, v, limit, note]) => `
        <div class="kv"><span class="k">${esc(label)}<br>
          <span class="muted" style="font-size:11.5px">${esc(note)}</span></span>
          <span class="v ${v <= limit ? "num-pos" : "num-neg"}">${pct(v)}<br>
          <span class="muted" style="font-weight:500;font-size:11.5px">limit ${pct(limit, 0)}</span></span></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Fund detail</h2><div class="sub">Units and NAV at the last statement</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Fund</th><th class="num">Units</th><th class="num">NAV</th><th>SIP</th><th>Evidence</th></tr></thead>
        <tbody>${funds.map((h) => `<tr>
          <td>${esc(h.name)}</td>
          <td class="num">${h.units ? fmt(h.units, 3) : "—"}</td>
          <td class="num">${h.nav ? fmt(h.nav, 4) : "—"}</td>
          <td>${esc(h.sip)}</td>
          <td class="muted" style="font-size:11.5px">${esc(h.note)}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>`;
}

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

  const goalRow = (g) => {
    let target = g.target;
    if (g.months) target = m.essential * g.months;
    if (g.yearRent) target = A.rentCheque * A.rentChequesPerYear;
    if (g.fiTarget) target = m.fiTarget;
    const current = {
      looseCash: m.looseCash, rentHeld: m.rentHeld, emergency: m.emergency,
      invested: m.invested, netWorth: m.netWorth,
      debtCleared: A.tabbyExposure - m.debtOutstanding,
    }[g.currentRef] || 0;
    const p = target ? clamp(current / target, 0, 1) : 1;
    return { ...g, target, current, gap: Math.max(0, target - current), progress: p };
  };
  const goals = state.goals.map(goalRow);

  $("#view-plan").innerHTML = `
    <div class="card">
      <div class="card-head"><div><h2>Net worth statement</h2>
        <div class="sub">Everything you own, everything you owe, in dirhams</div></div></div>
      <div class="kv"><span class="k">Liquid cash</span><span class="v">${money(m.liquidCash)}</span></div>
      <div class="kv"><span class="k">Investments</span><span class="v">${money(m.invested)}</span></div>
      <div class="kv"><span class="k"><strong>Total assets</strong></span><span class="v">${money(m.totalAssets)}</span></div>
      <div class="kv"><span class="k">Tabby exposure</span><span class="v num-neg">−${fmt(m.debtOutstanding)}</span></div>
      <div class="kv" style="border-top:1px solid var(--hairline-2);margin-top:6px;padding-top:10px">
        <span class="k"><strong>Net worth</strong></span><span class="v">${money(m.netWorth)}</span></div>
      <div class="kv"><span class="k">Rent still to fund</span><span class="v num-neg">−${fmt(m.rentToFund)}</span></div>
      <div class="kv"><span class="k">Needed before 15 Sep</span><span class="v num-neg">−${fmt(m.extraCashNeeded)}</span></div>
      <div class="kv"><span class="k"><strong>Free net worth after commitments</strong></span>
        <span class="v ${m.netWorth - m.rentToFund - m.extraCashNeeded >= 0 ? "" : "num-neg"}">
          ${money(m.netWorth - m.rentToFund - m.extraCashNeeded)}</span></div>
      <div class="note">Net worth is the scoreboard; the budget is the game. A disciplined month shows up here as a
        higher number even when the current account looks empty, because units bought outlast cash spent.</div>
    </div>

    ${statBlock([
      { k: "Emergency cover", v: m.emergencyCover.toFixed(2) + " mo", tone: m.emergencyCover >= 3 ? "good" : "bad", n: `target ${A.emergencyMonths} months` },
      { k: "Liquidity", v: m.liquidityMonths.toFixed(2) + " mo", tone: m.liquidityMonths >= 1 ? "good" : "bad", n: "free cash vs essentials" },
      { k: "Debt to assets", v: pct(m.debtToAssets), tone: m.debtToAssets <= 0.2 ? "good" : "warn" },
      { k: "Invested share", v: pct(m.totalAssets ? m.invested / m.totalAssets : 0), n: "of total assets" },
    ])}

    <div class="card">
      <div class="card-head">
        <div><h2>Wealth projection</h2>
          <div class="sub">${money(m.monthly)}/month rising ${pct(A.sipStepUp, 0)} a year at ${pct(m.blended)} blended</div></div>
        <button class="btn btn-sm btn-ghost" id="pLevers">Levers</button>
      </div>
      ${areaChart(m.projection.map((p) => ({ label: String(p.calendar), y: p.closing })))}
      <div class="scroll-x" style="margin-top:12px"><table class="tbl">
        <thead><tr><th>Year</th><th class="num">Opening</th><th class="num">Added</th>
          <th class="num">Growth</th><th class="num">Closing</th><th class="num">Today's money</th><th>Milestone</th></tr></thead>
        <tbody>${m.projection.map((p, i) => {
          const prev = i ? m.projection[i - 1].closing : m.invested;
          const ms = [1000000, 500000, 250000, 100000, 50000].find((x) => p.closing >= x && prev < x);
          return `<tr><td>${p.calendar}</td>
            <td class="num">${money0(p.opening)}</td><td class="num">${money0(p.contribution)}</td>
            <td class="num">${money0(p.growth)}</td><td class="num">${money0(p.closing)}</td>
            <td class="num muted">${money0(p.realClosing)}</td>
            <td>${ms ? `<span class="pill good">${money0(ms)}</span>` : ""}</td></tr>`;
        }).join("")}</tbody>
        <tfoot><tr><td>Total</td><td></td>
          <td class="num">${money0(last.cumulative)}</td>
          <td class="num">${money0(last.closing - m.invested - last.cumulative)}</td>
          <td class="num">${money0(last.closing)}</td><td class="num">${money0(last.realClosing)}</td><td></td></tr></tfoot>
      </table></div>
      <div class="note">Growth above contributions is the part the market pays you. If it is smaller than what you
        put in, the missing ingredient is time, not a better fund.</div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>What each lever is worth</h2>
        <div class="sub">Same maths, one change at a time, measured at the horizon</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Scenario</th><th class="num">Monthly</th><th class="num">Step-up</th>
          <th class="num">Return</th><th class="num">At horizon</th><th class="num">vs base</th></tr></thead>
        <tbody>${scen.map((s, i) => `<tr>
          <td>${esc(s.label)}</td><td class="num">${money0(s.mo)}</td><td class="num">${pct(s.g, 0)}</td>
          <td class="num">${pct(s.r)}</td><td class="num">${money0(s.fv)}</td>
          <td class="num ${i === 0 ? "muted" : s.fv - base >= 0 ? "num-pos" : "num-neg"}">
            ${i === 0 ? "—" : signMoney(s.fv - base).replace(/\.\d+$/, "")}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="note good">Compare row two with row five. Adding AED 300 a month — roughly one restaurant week —
        is worth more than three points of return, and it is the only one of the two you control.</div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Financial independence</h2>
        <div class="sub">The point where capital pays the essentials instead of work</div></div></div>
      <div class="kv"><span class="k">Annual essential spending</span><span class="v">${money(m.annualEssential)}</span></div>
      <div class="kv"><span class="k">Safe withdrawal rate</span><span class="v">${pct(A.swr, 1)}</span></div>
      <div class="kv"><span class="k">Capital needed</span><span class="v">${money(m.fiTarget)}</span></div>
      <div class="kv"><span class="k">Years at the base plan</span>
        <span class="v">${m.yearsToFI ? m.yearsToFI + " years" : "beyond horizon"}</span></div>
      <div class="kv"><span class="k">Projected in today's money</span><span class="v">${money(last.realClosing)}</span></div>
      ${!m.yearsToFI ? `<div class="note warn">The base plan does not reach independence inside
        ${A.horizonYears} years. The fix is the contribution lever, not a better fund — try the scenarios above.</div>` : ""}
    </div>

    ${[1, 2, 3].map((stage) => `
      <div class="card">
        <div class="card-head"><div><h2>${["", "Stage 1 — survive the quarter", "Stage 2 — build the buffer", "Stage 3 — compound"][stage]}</h2>
          <div class="sub">${["", "Nothing later matters until these are done", "The buffer that stops the crisis repeating", "The long game"][stage]}</div></div></div>
        ${goals.filter((g) => g.stage === stage).map((g) => `
          <div class="row" style="padding-left:0;padding-right:0">
            <div class="row-main">
              <div class="row-title wrap">${esc(g.name)}</div>
              <div class="row-sub">${money(g.current)} of ${money(g.target)} · by ${longDate(g.deadline)}</div>
              <div class="bar ${g.progress >= 1 ? "good" : g.progress >= 0.5 ? "warn" : "bad"}" style="margin-top:7px">
                <i style="width:${(g.progress * 100).toFixed(0)}%"></i></div>
              <div class="row-sub wrap" style="margin-top:6px;white-space:normal">${esc(g.note)}</div>
            </div>
            <div class="row-val">${pct(g.progress, 0)}<span class="small">${g.gap > 0 ? money0(g.gap) + " to go" : "done"}</span></div>
          </div>`).join("")}
      </div>`).join("")}`;
}

function renderAdvisor() {
  const m = metrics();
  const all = advice(m);
  const open = all.filter((r) => r.open && !r.dismissed);
  const closed = all.filter((r) => !r.open || r.dismissed);
  const groups = ["Urgent", "Spending", "Structure", "Investing"];
  const monthlyImpact = sum(open.filter((r) => r.scale === "month"), (r) => r.impact);

  const card = (r) => `
    <div class="row" style="padding-left:0;padding-right:0;align-items:flex-start">
      <div class="avatar" style="background:${r.priority === 1 ? "var(--bad)" : r.priority === 2 ? "var(--warn)" : "var(--surface-3)"};
           color:${r.priority <= 2 ? "#fff" : "var(--ink-2)"}">${r.priority}</div>
      <div class="row-main">
        <div class="row-title wrap" style="white-space:normal">${esc(r.title)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">
          <span class="pill ${r.open ? (r.priority === 1 ? "bad" : "warn") : "good"}">${esc(r.status)}</span>
          <span class="pill">${esc(r.effort)} effort</span>
          <span class="pill">by ${shortDate(r.by)}</span>
          ${r.impact > 0 ? `<span class="pill info">${money0(r.impact)} ${esc(impactUnit(r))}</span>` : ""}
        </div>
        <div class="row-sub wrap" style="white-space:normal;line-height:1.5">${esc(r.why)}</div>
        <div class="btn-row" style="margin-top:9px">
          <button class="btn btn-sm btn-ghost" data-dismiss="${esc(r.id)}">${r.dismissed ? "Restore" : "Dismiss"}</button>
        </div>
      </div>
    </div>`;

  $("#view-advisor").innerHTML = `
    <div class="card hero">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        ${ring(m.health, 104, m.grade)}
        <div style="flex:1;min-width:190px">
          <div class="hero-label">Financial health</div>
          <div class="hero-value" style="font-size:26px">${m.health.toFixed(0)} / 100 · ${m.grade}</div>
          <div class="hero-sub">${open.length} open recommendations · ${money0(monthlyImpact)} a month of recurring cost in play</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>The one-paragraph verdict</h2>
        <div class="sub">Recomputed every time the numbers change</div></div></div>
      <p style="font-size:14px;line-height:1.62;color:var(--ink-2)">${esc(verdict(m))}</p>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Score breakdown</h2>
        <div class="sub">Where the grade comes from</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Component</th><th class="num">Score</th><th class="num">Weight</th><th class="num">Weighted</th></tr></thead>
        <tbody>${m.comp.map((c) => `<tr>
          <td>${esc(c.key)}<div class="muted" style="font-size:11.5px">${esc(c.label)}</div></td>
          <td class="num">${c.score.toFixed(1)}</td><td class="num">${pct(c.weight, 0)}</td>
          <td class="num">${(c.score * c.weight).toFixed(1)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num"></td><td class="num">100%</td>
          <td class="num">${m.health.toFixed(1)}</td></tr></tfoot>
      </table></div>
    </div>

    ${groups.map((g) => {
      const items = open.filter((r) => r.group === g);
      if (!items.length) return "";
      return `<div class="card">
        <div class="card-head"><div><h2>${esc(g)}</h2>
          <div class="sub">${items.length} open${(() => { const mo = sum(items.filter((i) => i.scale === "month"), (i) => i.impact); return mo ? ` · ${money0(mo)} a month in play` : ""; })()}</div></div></div>
        ${items.map(card).join("")}
      </div>`;
    }).join("")}

    ${closed.length ? `<div class="card">
      <div class="card-head"><div><h2>Closed and dismissed</h2>
        <div class="sub">${closed.length} items the data says are handled</div></div></div>
      ${closed.map(card).join("")}
    </div>` : ""}`;
}

function renderMore() {
  const m = metrics();
  const A = m.A;
  const paid = state.debtPayments.filter((d) => d.paid);
  const cleared = sum(paid, (d) => d.amount);

  const levers = [
    ["aedPerInr", "AED per INR", 6, "Derived from the last confirmed SIP transfer."],
    ["aedPerUsd", "AED per USD", 4, "The dirham peg. Treat as fixed."],
    ["salary", "Net monthly salary", 2, "The baseline every plan is built on."],
    ["rentCheque", "Rent cheque", 2, "One cheque, as written on the lease."],
    ["rentChequesPerYear", "Rent cheques per year", 0, "ASSUMPTION — confirm against the lease. Drives the whole rent accrual."],
    ["returnIndiaEq", "Indian equity return", 4, "Nominal, before currency effects."],
    ["returnGlobalEq", "Global equity return", 4, "Broad developed-market assumption."],
    ["inflation", "Inflation", 4, "Used for the today's-money column."],
    ["scenarioAdj", "Scenario adjustment", 4, "0 base · −0.03 bear · +0.02 bull."],
    ["sipStepUp", "Annual SIP step-up", 4, "The highest-leverage habit in the plan."],
    ["extraMonthly", "Extra monthly investment", 2, "What you redirect on top of the SIP."],
    ["targetSavingsRate", "Target savings rate", 4, "Scored on the advisor."],
    ["emergencyMonths", "Emergency fund target (months)", 0, "Measured against essential spending."],
    ["horizonYears", "Plan horizon (years)", 0, "Length of the projection."],
    ["swr", "Safe withdrawal rate", 4, "For the independence target."],
    ["dailyCap", "Daily living cap", 2, "The damage-control cap the burn rate is judged against."],
  ];

  $("#view-more").innerHTML = `
    <div class="card">
      <div class="card-head"><div><h2>Debt plan</h2>
        <div class="sub">${money(m.debtOutstanding)} outstanding · ${money(cleared)} cleared</div></div></div>
      <div class="bar ${m.debtOutstanding === 0 ? "good" : "warn"}" style="margin-bottom:14px">
        <i style="width:${(A.tabbyExposure ? cleared / A.tabbyExposure * 100 : 0).toFixed(0)}%"></i></div>
      ${state.debtPayments.map((d) => `
        <div class="row tap" data-debt="${esc(d.id)}" style="padding-left:0;padding-right:0">
          <div class="avatar" style="background:${d.paid ? "var(--good)" : "var(--surface-3)"};color:${d.paid ? "#fff" : "var(--ink-2)"}">
            ${d.paid ? "✓" : "•"}</div>
          <div class="row-main">
            <div class="row-title">${longDate(d.date)}</div>
            <div class="row-sub wrap" style="white-space:normal">${esc(d.note)} · from ${esc(d.from)}</div>
          </div>
          <div class="row-val">${money(d.amount)}<span class="small">${d.paid ? "paid" : "due"}</span></div>
        </div>`).join("")}
      <div class="note">Tabby is free while the minimum lands on time, so punctuality — not size — is the whole risk.
        Paying the full August statement early would cost ${money(A.tabbyFullAug - A.tabbyMinSep)} more in September
        and save no fee at all. Tap a payment to mark it settled.</div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Upcoming obligations</h2>
        <div class="sub">Everything dated, in the order it hits</div></div></div>
      <div class="scroll-x"><table class="tbl">
        <thead><tr><th>Due</th><th>Item</th><th class="num">Amount</th><th>Status</th><th>Priority</th></tr></thead>
        <tbody>${state.obligations.slice().sort((a, b) => a.due.localeCompare(b.due)).map((o) => `<tr>
          <td>${shortDate(o.due)}<div class="muted" style="font-size:11px">${daysUntil(o.due)}d</div></td>
          <td>${esc(o.name)}<div class="muted" style="font-size:11px">${esc(o.note)}</div></td>
          <td class="num">${money(o.amount)}</td>
          <td><span class="pill ${o.status === "actual" ? "good" : "warn"}">${esc(o.status)}</span></td>
          <td>${esc(o.priority)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td></td><td>Total</td>
          <td class="num">${money(sum(state.obligations, (o) => o.amount))}</td><td></td><td></td></tr></tfoot>
      </table></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Accounts</h2>
        <div class="sub">Tap to update a balance after a bank message</div></div></div>
      ${state.accounts.map((a) => `
        <div class="row tap" data-account="${esc(a.id)}" style="padding-left:0;padding-right:0">
          <div class="row-main">
            <div class="row-title">${esc(a.name)}</div>
            <div class="row-sub wrap" style="white-space:normal">${esc(a.note)}</div>
          </div>
          <div class="row-val">${money(a.balance)}<span class="small">${longDate(a.asOf)}</span></div>
        </div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Assumptions</h2>
        <div class="sub">Every number this app cannot prove lives here</div></div></div>
      ${levers.map(([k, label, dp, note]) => `
        <div class="kv" style="align-items:center">
          <span class="k" style="flex:1">${esc(label)}<br>
            <span class="muted" style="font-size:11.5px">${esc(note)}</span></span>
          <input class="inline-num" type="number" step="any" data-lever="${k}" value="${A[k]}" />
        </div>`).join("")}
      <div class="note warn">The two most likely to be wrong are the rent cheque cadence and the AED/INR rate.
        Confirm both — against the lease and the next transfer receipt.</div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Data</h2>
        <div class="sub">Everything stays on this device. Nothing is uploaded.</div></div></div>
      <div class="btn-row">
        <button class="btn" id="exportBtn">Export JSON</button>
        <button class="btn" id="importBtn">Import JSON</button>
        <button class="btn btn-danger" id="resetBtn">Reset to workbook</button>
      </div>
      <input type="file" id="importFile" accept="application/json" hidden />
      <div class="note">Seeded from Johnnys_Edge_Lifetime_Finance.xlsx as of ${longDate(state.asOf)}.
        Last saved ${new Date(state.updatedAt).toLocaleString("en-GB")}.</div>
    </div>`;
}

/* ------------------------------------------------------- balance links -- */
/* A transaction you record here is one that has actually happened, so it also
   moves the account it came from. Seeded history carries no accountId and never
   moves a balance — those balances are already stated after those transactions.
   Confirming a balance from a bank message always wins: it sets the truth
   absolutely rather than adjusting it, so nothing is ever double-counted. */
function moveBalance(accountId, delta) {
  if (!accountId) return;
  const a = state.accounts.find((x) => x.id === accountId);
  if (a) a.balance = round2(a.balance + delta);
}

/* ============================================================= modals == */
function closeModal() { $("#modalRoot").innerHTML = ""; }

function openModal(title, bodyHTML, onSubmit, opts = {}) {
  $("#modalRoot").innerHTML = `
    <div class="modal-back">
      <form class="modal" id="modalForm">
        <h3>${esc(title)}</h3>
        ${bodyHTML}
        <div class="modal-actions">
          ${opts.danger ? `<button type="button" class="btn btn-danger" id="mDelete">Delete</button>` : ""}
          <button type="button" class="btn btn-ghost" id="mCancel">Cancel</button>
          <button type="submit" class="btn btn-accent">${esc(opts.submit || "Save")}</button>
        </div>
      </form>
    </div>`;
  $("#mCancel").onclick = closeModal;
  $(".modal-back").onclick = (e) => { if (e.target.classList.contains("modal-back")) closeModal(); };
  if (opts.danger) $("#mDelete").onclick = () => { opts.danger(); closeModal(); rerender(); };
  $("#modalForm").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    onSubmit(data);
    closeModal();
    rerender();
  };
  const first = $("#modalForm input, #modalForm select");
  if (first) setTimeout(() => first.focus(), 60);
}

function field(name, label, value, type = "text", extra = "") {
  return `<label class="field"><span>${esc(label)}</span>
    <input name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra} /></label>`;
}
function selectField(name, label, value, options) {
  return `<label class="field"><span>${esc(label)}</span><select name="${name}">
    ${options.map((o) => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}
  </select></label>`;
}

function txModal(id) {
  const t = id ? state.tx.find((x) => x.id === id) : null;
  const body = `
    ${field("merchant", "Merchant or description", t ? t.merchant : "", "text", "required placeholder='Asas Al Madina'")}
    <div class="grid2">
      ${field("amount", "Amount (AED)", t ? t.amount : "", "number", "step='0.01' min='0' required")}
      ${field("date", "Date", t ? t.date.slice(0, 10) : todayISO(), "date", "required")}
    </div>
    <div class="grid2">
      ${selectField("category", "Category", t ? t.category : "Groceries", CATEGORIES)}
      ${selectField("split", "Split", t ? t.split : "Personal", ["Personal", "Household", "Excluded"])}
    </div>
    <div class="grid2">
      <label class="field"><span>Paid from</span><select name="accountId">
        <option value="">Not linked to an account</option>
        ${state.accounts.map((a) => `<option value="${esc(a.id)}"
          ${(t ? t.accountId : "fab4001") === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
      </select></label>
      ${selectField("counts", "Counts as spending", t ? (t.counts ? "Yes" : "No") : "Yes", ["Yes", "No"])}
    </div>
    ${field("note", "Note", t ? t.note : "", "text", "placeholder='Optional'")}
    <div class="note">Leave the category alone and it will be guessed from the merchant name. Mark a line
      <em>No</em> when it is a transfer between your own accounts, a salary credit or a refunded charge — those are
      recorded for the audit trail but never counted as spending. Linking an account also takes the amount off that
      balance; the seeded August history is already reflected in the balances and so stays unlinked.</div>`;

  openModal(id ? "Edit transaction" : "Record a transaction", body, (d) => {
    const amount = Math.abs(Number(d.amount) || 0);
    const category = d.category || categorise(d.merchant);
    const acc = state.accounts.find((a) => a.id === d.accountId);
    const rec = {
      id: id || uid(),
      date: d.date + (t ? t.date.slice(10) : "T12:00"),
      accountId: d.accountId || null,
      bank: acc ? acc.name.split(" —")[0] : (t ? t.bank : "Cash"),
      merchant: d.merchant.trim(), amount,
      category, split: d.split, counts: d.counts === "Yes" ? 1 : 0,
      balanceAfter: t ? t.balanceAfter : null,
      note: d.note || "", kind: "expense",
    };
    if (t) moveBalance(t.accountId, t.amount);      // reverse the old effect
    moveBalance(rec.accountId, -rec.amount);        // apply the new one
    if (id) state.tx = state.tx.map((x) => (x.id === id ? rec : x));
    else state.tx.push(rec);
    saveState();
    toast(id ? "Transaction updated" : `Recorded — ${money(amount)}`);
  }, id ? {
    danger: () => {
      moveBalance(t.accountId, t.amount);
      state.tx = state.tx.filter((x) => x.id !== id);
      saveState();
      toast("Transaction deleted");
    },
  } : {});
}

function budgetModal(id) {
  const b = state.budget.find((x) => x.id === id);
  if (!b) return;
  const m = metrics();
  const line = m.budget.find((x) => x.id === id);
  openModal(b.line, `
    ${field("plan", "Monthly plan (AED)", b.plan, "number", "step='0.01' min='0' required")}
    ${selectField("priority", "Priority", b.priority, ["Critical", "Essential", "Discretionary", "Deferred", "Avoidable", "Control", "Wealth"])}
    ${field("note", "Note", b.note)}
    <div class="note">Actual over the ledger window: <strong>${money(line.actual)}</strong> —
      a run rate of <strong>${money(line.rate)}</strong> a month.
      ${line.cat ? "" : "This line has no ledger category, so it is planned only."}</div>`,
    (d) => {
      b.plan = Number(d.plan) || 0;
      b.priority = d.priority;
      b.note = d.note;
      saveState();
      toast("Budget updated");
    });
}

function holdingModal(id) {
  const h = state.holdings.find((x) => x.id === id);
  if (!h) return;
  openModal(h.name, `
    <div class="grid2">
      ${field("value", `Current value (${h.ccy})`, h.value, "number", "step='0.01' required")}
      ${field("cost", `Cost (${h.ccy})`, h.cost, "number", "step='0.01' required")}
    </div>
    <div class="grid2">
      ${field("units", "Units", h.units, "number", "step='any'")}
      ${field("nav", "NAV", h.nav, "number", "step='any'")}
    </div>
    ${selectField("sip", "SIP status", h.sip, ["Active", "Cancelled", "Paused", "Manual", "Idle"])}
    ${field("note", "Evidence", h.note)}
    <div class="note">Update this after each statement. Values are held in the fund's own currency and converted
      at the rates on the More tab, so a rate change re-prices the whole portfolio at once.</div>`,
    (d) => {
      Object.assign(h, {
        value: Number(d.value) || 0, cost: Number(d.cost) || 0,
        units: Number(d.units) || 0, nav: Number(d.nav) || 0,
        sip: d.sip, note: d.note,
      });
      saveState();
      toast("Holding updated");
    });
}

function accountModal(id) {
  const a = state.accounts.find((x) => x.id === id);
  if (!a) return;
  openModal(a.name, `
    ${field("balance", "Balance (AED)", a.balance, "number", "step='0.01' required")}
    ${field("asOf", "Confirmed on", a.asOf, "date", "required")}
    ${selectField("locked", "Ring-fenced", a.locked ? "Yes" : "No", ["No", "Yes"])}
    ${field("note", "Note", a.note)}
    <div class="note">Only enter a balance you can see on a bank message, app screen or statement. An expected
      credit is not a balance.</div>`,
    (d) => {
      Object.assign(a, {
        balance: Number(d.balance) || 0, asOf: d.asOf,
        locked: d.locked === "Yes", note: d.note, status: "actual",
      });
      state.asOf = d.asOf > state.asOf ? d.asOf : state.asOf;
      saveState();
      toast("Balance updated");
    });
}

function leversModal() {
  const A = state.assumptions;
  openModal("Projection levers", `
    <div class="grid2">
      ${field("extraMonthly", "Extra monthly investment (AED)", A.extraMonthly, "number", "step='any'")}
      ${field("sipStepUp", "Annual step-up (0.10 = 10%)", A.sipStepUp, "number", "step='any'")}
    </div>
    <div class="grid2">
      ${field("scenarioAdj", "Return adjustment", A.scenarioAdj, "number", "step='any'")}
      ${field("horizonYears", "Horizon (years)", A.horizonYears, "number", "step='1' min='1' max='50'")}
    </div>
    <div class="note">Return adjustment stresses the whole plan at once: 0 for the base case, −0.03 for a bear
      case, +0.02 for a bull case.</div>`,
    (d) => {
      A.extraMonthly = Number(d.extraMonthly) || 0;
      A.sipStepUp = Number(d.sipStepUp) || 0;
      A.scenarioAdj = Number(d.scenarioAdj) || 0;
      A.horizonYears = clamp(Math.round(Number(d.horizonYears) || 20), 1, 50);
      saveState();
      toast("Projection updated");
    });
}

/* ============================================================== chrome == */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toastRoot").appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

let currentView = "home";
function show(view) {
  currentView = view;
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "instant" });
  rerender();
}

const RENDERERS = {
  home: renderHome, money: renderMoney, budget: renderBudget,
  invest: renderInvest, plan: renderPlan, advisor: renderAdvisor, more: renderMore,
};

function rerender() {
  try {
    RENDERERS[currentView]();
  } catch (e) {
    console.error(e);
    $("#view-" + currentView).innerHTML =
      `<div class="card"><div class="note bad">Something went wrong rendering this view: ${esc(e.message)}</div></div>`;
  }
  const m = metrics();
  $("#asOfLabel").textContent =
    `${money(m.netWorth)} net worth · confirmed to ${longDate(state.asOf)}`;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.theme === "light" ? "#f4f6f8" : "#071827");
}

/* ============================================================== events == */
document.addEventListener("click", (e) => {
  const t = e.target;
  const closest = (sel) => t.closest(sel);

  const tab = closest(".tab");
  if (tab) return show(tab.dataset.view);

  const goto = closest("[data-goto]");
  if (goto) return show(goto.dataset.goto);

  if (t.id === "addBtn" || t.id === "mAdd") return txModal(null);
  if (t.id === "iAdd") {
    state.holdings.push({
      id: uid(), name: "New holding", house: "—", cls: "Indian large cap",
      units: 0, cost: 0, value: 0, nav: 0, ccy: "INR", sip: "Active", note: "Added manually",
    });
    saveState();
    rerender();
    return holdingModal(state.holdings[state.holdings.length - 1].id);
  }
  if (t.id === "pLevers") return leversModal();

  const txRow = closest("[data-tx]");
  if (txRow) return txModal(txRow.dataset.tx);
  const bRow = closest("[data-budget]");
  if (bRow) return budgetModal(bRow.dataset.budget);
  const hRow = closest("[data-holding]");
  if (hRow) return holdingModal(hRow.dataset.holding);
  const aRow = closest("[data-account]");
  if (aRow) return accountModal(aRow.dataset.account);

  const dRow = closest("[data-debt]");
  if (dRow) {
    const d = state.debtPayments.find((x) => x.id === dRow.dataset.debt);
    if (!d) return;
    if (d.paid) {
      moveBalance(d.paidFrom, d.amount);
      d.paid = false; d.paidFrom = null;
      saveState(); rerender();
      return toast("Marked unpaid");
    }
    return openModal(`Pay ${money(d.amount)} to Tabby`, `
      <label class="field"><span>Paid from</span><select name="accountId">
        ${state.accounts.map((a) => `<option value="${esc(a.id)}"
          ${a.id === "fab4001" ? "selected" : ""}>${esc(a.name)} — ${money(a.balance)}</option>`).join("")}
      </select></label>
      <div class="note">Settling a debt does not make you richer: the balance falls and so does what you owe,
        so net worth stays exactly where it was. What changes is that the card gets closer to zero.</div>`,
      (f) => {
        d.paid = true; d.paidFrom = f.accountId;
        moveBalance(f.accountId, -d.amount);
        saveState();
        toast(`Paid — ${money(d.amount)}`);
      }, { submit: "Mark paid" });
  }

  const dis = closest("[data-dismiss]");
  if (dis) {
    const id = dis.dataset.dismiss;
    state.dismissed = state.dismissed.includes(id)
      ? state.dismissed.filter((x) => x !== id)
      : state.dismissed.concat(id);
    saveState();
    return rerender();
  }

  const rec = closest("[data-rec]");
  if (rec) return show("advisor");

  if (t.id === "themeBtn") {
    state.theme = state.theme === "light" ? "dark" : "light";
    saveState();
    applyTheme();
    return rerender();
  }

  if (t.id === "exportBtn") {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wealth-os-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return toast("Exported");
  }
  if (t.id === "importBtn") return $("#importFile").click();
  if (t.id === "resetBtn") {
    if (confirm("Reset every figure back to the workbook seed? Anything you have added here will be lost.")) {
      state = blankState();
      saveState();
      applyTheme();
      rerender();
      toast("Reset to the workbook position");
    }
    return;
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "importFile" && t.files && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const s = JSON.parse(fr.result);
        state = { ...blankState(), ...s, assumptions: { ...SEED_ASSUMPTIONS, ...(s.assumptions || {}) } };
        saveState();
        applyTheme();
        rerender();
        toast("Imported");
      } catch (err) { toast("That file is not a Wealth OS export"); }
    };
    fr.readAsText(t.files[0]);
    return;
  }
  if (t.dataset && t.dataset.lever) {
    const v = Number(t.value);
    if (Number.isFinite(v)) {
      state.assumptions[t.dataset.lever] = v;
      saveState();
      const m = metrics();
      $("#asOfLabel").textContent = `${money(m.netWorth)} net worth · confirmed to ${longDate(state.asOf)}`;
      toast("Assumption updated");
    }
    return;
  }
  if (["fq", "fcat", "fsplit", "fmonth"].includes(t.id)) {
    state._filter = {
      q: $("#fq") ? $("#fq").value : "",
      cat: $("#fcat") ? $("#fcat").value : "",
      split: $("#fsplit") ? $("#fsplit").value : "",
      month: $("#fmonth") ? $("#fmonth").value : "",
    };
    rerender();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "fq") {
    clearTimeout(window._sT);
    window._sT = setTimeout(() => {
      const pos = e.target.selectionStart;
      state._filter = { ...(state._filter || {}), q: e.target.value };
      rerender();
      const f = $("#fq");
      if (f) { f.focus(); f.setSelectionRange(pos, pos); }
    }, 220);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ================================================================ boot == */
state = loadState();
applyTheme();
show("home");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
