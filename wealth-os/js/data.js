/* ============================================================
   Wealth OS — seed data
   Every figure is transcribed from Johnnys_Edge_Lifetime_Finance.xlsx and
   carries the same status the workbook gives it: "actual" means confirmed
   against a bank message, statement or bill; "estimate" means it has not
   happened yet. Nothing here is invented.
   ============================================================ */
"use strict";

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
  id: "s" + i, date, bank, merchant, amount, category, split, counts, balanceAfter, note,
  kind: "expense",
  /* Historical rows carry no accountId on purpose: the seeded balances are
     already stated *after* these transactions, so replaying them would
     double-count. Only rows you add from here on move a balance. */
  accountId: null,
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

/* ------------------------------------------------------------- pots ---- */
/* Pots are virtual envelopes inside a real account. They never move money;
   they say what a balance is already spoken for, which is the whole reason
   AED 6,090.70 in FAB 4002 is not AED 6,090.70 of spending power. */
const SEED_POTS = [
  { id: "p-rent",  name: "Rent vault",      accountId: "fab4002", balance: 5990.45, target: 11750,
    kind: "vault",     earmark: "o7",
    note: "The October cheque. Untouchable." },
  { id: "p-bills", name: "Bills float",     accountId: "fab4002", balance: 100.25,  target: 1728.21,
    kind: "float",     earmark: "o1",
    note: "Held against the August DEWA bill." },
  { id: "p-emg",   name: "Emergency fund",  accountId: "fabemg",  balance: 7.67,    target: 1000,
    kind: "emergency", earmark: null,
    note: "First milestone AED 1,000, then six months of essentials." },
];

/* ------------------------------------------------------- income --------- */
const SEED_INCOME_SOURCES = [
  { id: "src-salary", name: "Salary — main employer", type: "Salary",
    expectedMonthly: 7914.88, dayOfMonth: 26, ccy: "AED", active: true,
    note: "Paid around the 26th. The July figure is the baseline." },
  { id: "src-tickets", name: "Ticket dealing", type: "Side income",
    expectedMonthly: 0, dayOfMonth: 0, ccy: "AED", active: true,
    note: "Irregular. AED 290 of profit realised in August across three tickets. "
        + "Deliberately not built into the plan — a plan that needs a side hustle to balance is not a plan." },
];

/* ------------------------------------------------------------ debts ---- */
/* Generalised from the single Tabby exposure so a second debt can be added
   without changing any code. APR 0 is correct for Tabby while the no-fee
   minimum lands on time; the risk is the late fee, not interest. */
const SEED_DEBTS = [
  { id: "debt-tabby", name: "Tabby Card", balance: 2687.36, apr: 0, minPayment: 1314.50,
    dueDay: 3, lateFee: 35, frozen: true, ccy: "AED",
    note: "AED 1,972.03 August statement plus AED 715.33 September statement. Free while the "
        + "minimum is met on time, which makes punctuality the whole risk." },
];

const SEED_DEBT_PAYMENTS = [
  { id: "d1", debtId: "debt-tabby", date: "2026-09-03", amount: 1314.50, paid: false,
    paidFrom: null, from: "26 Aug salary", note: "Confirmed no-fee minimum. Autopay selected." },
  { id: "d2", debtId: "debt-tabby", date: "2026-10-03", amount: 715.33, paid: false,
    paidFrom: null, from: "26 Sep salary", note: "Generated September statement." },
  { id: "d3", debtId: "debt-tabby", date: "2026-11-03", amount: 657.53, paid: false,
    paidFrom: null, from: "26 Oct salary", note: "Tail of the August statement. Clears the card." },
];

/* -------------------------------------------------------------- SIPs --- */
const SEED_SIPS = [
  { id: "sip1", holdingId: "h1", amountNative: 3000, ccy: "INR", dayOfMonth: 10, active: true,
    stepUpPct: 0.10, note: "Nippon Large Cap" },
  { id: "sip2", holdingId: "h2", amountNative: 3000, ccy: "INR", dayOfMonth: 10, active: true,
    stepUpPct: 0.10, note: "Nippon Multi Cap" },
  { id: "sip3", holdingId: "h3", amountNative: 3000, ccy: "INR", dayOfMonth: 10, active: true,
    stepUpPct: 0.10, note: "Nippon Growth Mid Cap" },
  { id: "sip4", holdingId: "h4", amountNative: 3000, ccy: "INR", dayOfMonth: 10, active: true,
    stepUpPct: 0.10, note: "Nippon Small Cap" },
  { id: "sip5", holdingId: "h5", amountNative: 0,    ccy: "INR", dayOfMonth: 10, active: false,
    stepUpPct: 0,    note: "Nippon Silver ETF FoF — SIP cancelled, holding retained" },
];

/* Contributions actually made. August's four SIPs are confirmed by the
   Nippon email and the MF Central snapshot. */
const SEED_INV_TX = [
  { id: "it1", date: "2026-08-10", holdingId: "h1", type: "buy", amountNative: 3000, ccy: "INR",
    units: 0, note: "August SIP" },
  { id: "it2", date: "2026-08-10", holdingId: "h2", type: "buy", amountNative: 3000, ccy: "INR",
    units: 8.803, note: "August SIP — Multi Cap email confirms 8.803 units" },
  { id: "it3", date: "2026-08-10", holdingId: "h3", type: "buy", amountNative: 3000, ccy: "INR",
    units: 0, note: "August SIP" },
  { id: "it4", date: "2026-08-10", holdingId: "h4", type: "buy", amountNative: 3000, ccy: "INR",
    units: 0, note: "August SIP" },
];

/* ---------------------------------------------------- categorisation --- */
/* User-editable rules run before the built-in patterns, newest first, so a
   correction always beats a guess. */
const SEED_RULES = [
  { id: "r1", match: "asas al madina", category: "Groceries", split: "Personal", source: "seed" },
  { id: "r2", match: "enoc",           category: "Fuel & Transport", split: "Personal", source: "seed" },
  { id: "r3", match: "emarat",         category: "Fuel & Transport", split: "Personal", source: "seed" },
  { id: "r4", match: "rta",            category: "Fuel & Transport", split: "Household", source: "seed" },
  { id: "r5", match: "dewa",           category: "Utilities & Telecom", split: "Household", source: "seed" },
];

/* ------------------------------------------------------- assumptions --- */
const SEED_ASSUMPTIONS_EXTRA = {
  weeklyCap: 35,
  forecastDays: 90,
  forecastBurnMode: "actual",   // "actual" uses the ledger burn rate, "plan" uses the budget
  salaryDay: 26,
  recurringMinHits: 2,
  latePenalty: 35,
};

/* One starting point for the net-worth history. Everything after this is
   captured by the app itself. */
const SEED_SNAPSHOTS = [
  { date: "2026-08-25", note: "Seeded from the workbook", auto: false },
];
