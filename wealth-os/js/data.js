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
  { id: "fab4001", name: "FAB 4001 — spending",   bank: "FAB",   balance: 31.39,   ccy: "AED", kind: "current", locked: false, asOf: "2026-09-01", status: "actual",
    note: "Card XXXX1599. AED 400 moved in from the vault (28 Aug), then a run of personal spending "
        + "(SMK Street, Team Taste, Mom Store, Alshaya, KFC Sharjah, Asas Al Madina) through 31 Aug, then "
        + "on 1 Sep: Spicy Falcon, Dubai Duty Free, an AED 50 remittance to card XXXX7801 plus its 0.49 fee, "
        + "and a new AED 26.25 monthly minimum-balance charge — the same charge pattern seen on this "
        + "account before. Full chain confirmed by SMS to 1 Sep 23:55; reconciles exactly." },
  { id: "fab4002", name: "FAB 4002 — rent vault", bank: "FAB",   balance: 5548.76, ccy: "AED", kind: "current", locked: true,  asOf: "2026-08-31", status: "actual",
    note: "The rent vault. AED 400 moved out to fund FAB 4001 (28 Aug) and AED 8.06 interest credited "
        + "(31 Aug). 47.2% of the cheque funded." },
  { id: "fabemg",  name: "FAB 4003 — emergency",  bank: "FAB",   balance: 7.68,    ccy: "AED", kind: "savings", locked: true,  asOf: "2026-08-31", status: "actual",
    note: "Ring-fenced. AED 0.01 interest credited 31 Aug. Next milestone AED 1,000." },
  { id: "nbdcur",  name: "NBD Current",           bank: "NBD",   balance: 9.22,    ccy: "AED", kind: "current", locked: false, asOf: "2026-08-30", status: "actual",
    note: "Card 3695. The 26 Aug payday (2,906.70) landed here, then the Tabby monthly fee (49.00), the "
        + "Aug Tabby minimum net of cashback (1,309.65), DEWA (813.28), the SIP funding transfer to ICICI "
        + "(465.60), Cielo Kabab, Emarat 6192 and Netflix all cleared the same day, followed by nine more "
        + "personal purchases through 30 Aug (Spicy Falcon, Real Choice Grocery, Asas Al Madina General, "
        + "Qashati Al Sham Sweets, Jannat Alfawakih Cafe) — confirmed by SMS end to end, reconciles exactly." },
  { id: "nbdsav",  name: "NBD Plus Saver",        bank: "NBD",   balance: 2.73,    ccy: "AED", kind: "savings", locked: false, asOf: "2026-08-04", status: "actual",
    note: "Includes AED 1.64 of interest." },
  { id: "tabbyc",  name: "Tabby Cash wallet",     bank: "Tabby", balance: 0.89,    ccy: "AED", kind: "wallet",  locked: false, asOf: "2026-08-04", status: "actual",
    note: "A funded wallet, never Card borrowing. The two must never be merged." },
  { id: "cash",    name: "Cash / Wio",            bank: "Cash",  balance: 0,       ccy: "AED", kind: "cash",    locked: false, asOf: "2026-08-11", status: "actual",
    note: "No balance reported." },
  { id: "icici",   name: "ICICI — SIP funding",   bank: "ICICI", balance: 12388.51, ccy: "INR", kind: "current", locked: true, asOf: "2026-08-26", status: "actual",
    note: "Personal India account, confirmed by app screenshot. The monthly SIP auto-debit pulls INR 12,000 from here, returning it to about 388. Not part of the AED household position." },
];

const SEED_HOLDINGS = [
  { id: "h1", name: "Nippon Large Cap",      house: "Nippon",        cls: "Indian large cap", units: 758.192, cost: 75000,    value: 77312.84, nav: 101.97,   ccy: "INR", sip: "Active",    note: "Repriced 25 Aug" },
  { id: "h2", name: "Nippon Multi Cap",      house: "Nippon",        cls: "Indian multi cap", units: 226.127, cost: 73936.89, value: 76555.30, nav: 338.55,   ccy: "INR", sip: "Active",    note: "Repriced 25 Aug" },
  { id: "h3", name: "Nippon Growth Mid Cap", house: "Nippon",        cls: "Indian mid cap",   units: 6.993,   cost: 33000,    value: 35507.45, nav: 5077.57,  ccy: "INR", sip: "Active",    note: "Repriced 25 Aug" },
  { id: "h4", name: "Nippon Small Cap",      house: "Nippon",        cls: "Indian small cap", units: 189.636, cost: 35968,    value: 39785.63, nav: 209.80,   ccy: "INR", sip: "Active",    note: "Repriced 25 Aug" },
  { id: "h5", name: "Nippon Silver ETF FoF", house: "Nippon",        cls: "Commodity",        units: 115.191, cost: 2971.14,  value: 4203.32,  nav: 36.49,    ccy: "INR", sip: "Cancelled", note: "SIP cancelled; the holding remains. Best performer of the Nippon sleeve." },
  { id: "h6", name: "Motilal Oswal Midcap",  house: "Motilal Oswal", cls: "Indian mid cap",   units: 93.721,  cost: 11000,    value: 11552.99, nav: 123.27,   ccy: "INR", sip: "Paused",    note: "Best performer in the portfolio at about 23.8%. SIP currently at zero." },
  { id: "h7", name: "Amana trading account", house: "Amana Capital", cls: "Global equity",    units: 37,      cost: 852.11,   value: 913.04,   nav: 0,        ccy: "USD", sip: "Manual",    note: "37 open positions: 16 US equities, 9 UAE equities, 4 ETFs, 8 crypto CFDs — down from 12. Refreshed to the 1 Sep statement; AVAXUSD, HBARUSD, LINKUSD and UNIUSD from the 10 Aug list are no longer showing. REQUIRES VERIFICATION: confirm whether those four were closed to cash still sitting in Amana, or already withdrawn." },
  { id: "h8", name: "Binance — spot crypto", house: "Binance",       cls: "Crypto",           units: 10,      cost: 191.80,   value: 191.80,   nav: 0,        ccy: "AED", sip: "Manual",    note: "10 coins; TRX and BTC the largest. App estimate, 11 Aug." },
];

const ALLOC_TARGETS = {
  "Indian large cap": 0.30, "Indian multi cap": 0.20, "Indian mid cap": 0.16,
  "Indian small cap": 0.11, "Commodity": 0.05, "Global equity": 0.15, "Crypto": 0.03,
};

const SEED_OBLIGATIONS = [
  /* Autopay is already set for this one, so the workbook treats it as settled
     and leaves it out of committed outflows. The cash does not actually leave
     until 3 Sep, which is why the day-by-day forecast still charges it then —
     the two views differ on purpose, and the advisor says so. */
  { id: "o-tabby-sep", due: "2026-09-03", name: "Tabby — no-fee minimum", amount: 1309.65, status: "actual",   recurrence: "Statement", priority: "Critical", autopayCommitted: true, paid: true, note: "Paid 26 Aug, eight days early, from NBD Current — 1,309.65 net of a 4.85 cashback against the 1,314.50 statement minimum. The separate 49.00 monthly card fee is logged on its own in the transaction ledger, not folded into this figure." },
  { id: "o-sip-sep",   due: "2026-09-10", name: "Nippon SIP — September",  amount: 462.40,  status: "actual", paid: true, recurrence: "Monthly",   priority: "Wealth",    note: "Already funded — the AED side went out 26 Aug (NBD Current → ICICI DirectRemit, AED 465.60, same day as the salary and Tabby payment) to pre-fund this SIP. 10 Sep is only the INR-side auto-debit inside ICICI; no further AED leaves this household. Was briefly double-counted as a pending bill; corrected 2 Sep." },
  { id: "o-du-sep",    due: "2026-09-15", name: "du — September",          amount: 590.98,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Baseline; replace when the bill generates." },
  { id: "o-eti-sep",   due: "2026-09-15", name: "Etisalat — September",    amount: 323.95,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Baseline; replace when the bill generates." },
  { id: "o-dewa-sep",  due: "2026-09-30", name: "DEWA — September",        amount: 793.42,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Last confirmed bill used as the baseline." },
  { id: "o-tabby-oct", due: "2026-10-03", name: "Tabby — September statement", amount: 715.33, status: "actual", recurrence: "Statement", priority: "Critical", note: "Confirmed via Tabby chat, 15 Aug." },
  { id: "o-sip-oct",   due: "2026-09-26", name: "Nippon SIP — October",    amount: 462.40,  status: "estimate", recurrence: "Monthly",   priority: "Wealth",    note: "Re-dated 2 Sep from 10 Oct to 26 Sep — the AED side actually remits on payday to pre-fund ICICI, matching the pattern just confirmed for September; the INR auto-debit itself follows on the 10th but moves no further AED out of the household. The last SIP before the rent cheque clears." },
  { id: "o-du-oct",    due: "2026-10-15", name: "du — October",            amount: 590.98,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Baseline." },
  { id: "o-eti-oct",   due: "2026-10-15", name: "Etisalat — October",      amount: 323.95,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Baseline." },
  { id: "o-rent",      due: "2026-10-22", name: "RENT CHEQUE",             amount: 11750,   status: "actual",   recurrence: "Quarterly", priority: "Critical",  note: "Clears 22 Oct. Must be fully funded by the 21st — the 26 Oct salary is four days too late." },
  { id: "o-dewa-oct",  due: "2026-10-31", name: "DEWA — October",          amount: 793.42,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Falls after the rent cheque; the 26 Oct salary can fund it." },
  { id: "o-tabby-nov", due: "2026-11-03", name: "Tabby — October statement", amount: 657.53, status: "actual", recurrence: "Statement", priority: "Critical", note: "Confirmed via Tabby app screenshot — exact match to the prior estimate. Rolls to next month for free once the card closes." },
  { id: "o-tabby-fee-sep", due: "2026-09-26", name: "Tabby — monthly card fee", amount: 49, status: "actual", recurrence: "Monthly", priority: "Essential", note: "Discovered 26 Aug. Continues monthly until the card closes after the final Tabby payment (~3 Nov)." },
  { id: "o-tabby-fee-oct", due: "2026-10-26", name: "Tabby — monthly card fee", amount: 49, status: "actual", recurrence: "Monthly", priority: "Essential", note: "Discovered 26 Aug. Continues monthly until the card closes after the final Tabby payment (~3 Nov)." },
  { id: "o-rent-jan",  due: "2027-01-22", name: "RENT CHEQUE — January",   amount: 11750,   status: "estimate", recurrence: "Quarterly", priority: "Critical",  note: "Quarterly cadence confirmed by the owner. Assumed flat — confirm with the landlord." },
  { id: "o-rent-apr",  due: "2027-04-22", name: "RENT CHEQUE — April",     amount: 11750,   status: "estimate", recurrence: "Quarterly", priority: "Critical",  note: "Confirmed quarterly pattern; flat-rent assumption, same as January." },
  { id: "o-rent-jul",  due: "2027-07-22", name: "RENT CHEQUE — July",      amount: 11750,   status: "estimate", recurrence: "Quarterly", priority: "Critical",  note: "Confirmed quarterly pattern; flat-rent assumption, same as January." },
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
  "Grooming", "Travel", "Family & Support", "Bank Fees", "Debt repayment", "Unreconciled", "Excluded",
];

const CAT_COLOR = {
  "Groceries": "var(--s2)", "Dining": "var(--s8)", "Fuel & Transport": "var(--s1)",
  "Utilities & Telecom": "var(--s5)", "Lifestyle & Shopping": "var(--s3)", "Grooming": "var(--s7)",
  "Travel": "var(--s6)", "Family & Support": "var(--s4)", "Bank Fees": "var(--muted)",
  "Debt repayment": "var(--warn)",
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
  ["2026-08-06T20:56","FAB","Ticket reimbursement (KHESKANI + SATYANI)",3740,"Excluded","Excluded",0,6501.86,"Ticket-dealing income, not salary — corrected 2 Sep; counted against the 26 Aug payday cash flow either way"],
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
  ["2026-08-25T09:00","FAB 4001","Internal transfer 4002 → 4001",100,"Excluded","Excluded",0,103.45,"Transfer; not income"],
  ["2026-08-25T12:30","FAB 4001","My Filli Cafe",29,"Dining","Personal",1,74.45,"Expense"],
  ["2026-08-25T13:15","FAB 4001","Subway",43,"Dining","Personal",1,31.45,"Expense"],
  ["2026-08-25T17:40","FAB 4001","Galadari Ice Cream",10,"Lifestyle & Shopping","Personal",1,21.45,"Expense"],
  ["2026-08-25T17:41","FAB 4001","Galadari Ice Cream",10,"Lifestyle & Shopping","Personal",1,11.45,"Expense"],
  ["2026-08-25T19:10","FAB 4001","Internal transfer 4002 → 4001",50,"Excluded","Excluded",0,61.45,"Transfer; not income"],
  ["2026-08-25T20:30","FAB 4001","Real Choice Grocery",33,"Groceries","Household",1,28.45,"Expense"],
  /* 26 Aug — payday. The remaining salary landed in NBD, not FAB 4001 as in
     prior months, confirmed by SMS; FAB 4001 only saw the morning fuel stop. */
  ["2026-08-26T06:34","FAB 4001","Emarat Nad Al Hamar",13.5,"Fuel & Transport","Household",1,14.95,"Expense"],
  ["2026-08-26T08:00","NBD","Salary credit — August payday",2906.70,"Excluded","Excluded",0,2906.90,"Income · confirmed by SMS, landed in NBD"],
  ["2026-08-26T08:05","NBD","Tabby monthly card fee",49,"Bank Fees","Household",1,2857.90,"Recurring fee; continues until the card closes after the final payment"],
  ["2026-08-26T08:10","NBD","Tabby — Aug statement no-fee minimum",1309.65,"Debt repayment","Household",1,1548.25,"Paid 8 days early; net of AED 4.85 cashback (statement minimum is AED 1,314.50)"],
  ["2026-08-26T09:00","NBD","Digital Dubai — DEWA",813.28,"Utilities & Telecom","Household",1,734.97,"August DEWA bill, paid on schedule"],
  ["2026-08-26T09:15","NBD","ICICI Bank — DirectRemit",465.60,"Excluded","Excluded",0,269.37,"SIP funding transfer to India — INR 12,000 at rate 0.0388; not household spend"],
  ["2026-08-26T13:00","NBD","Cielo Kabab Restaurant",20,"Dining","Personal",1,249.37,"Expense"],
  ["2026-08-26T18:00","NBD","Emarat 6192 Nad Al Ham",75.05,"Fuel & Transport","Household",1,174.32,"Expense"],
  ["2026-08-26T20:00","NBD","Netflix.com",36.09,"Lifestyle & Shopping","Personal",1,138.23,"Actual debit 36.09; SMS advertised approx 35.00"],
  /* 27-30 Aug — nine more personal purchases on NBD before it goes quiet. */
  ["2026-08-27T12:35","NBD","Spicy Falcon Restaurant",7,"Dining","Personal",1,131.23,"Expense"],
  ["2026-08-27T18:51","NBD","Real Choice Grocery",15,"Groceries","Personal",1,116.23,"Expense"],
  ["2026-08-27T19:55","NBD","Asas Al Madina General",6,"Lifestyle & Shopping","Personal",1,110.23,"Expense"],
  ["2026-08-28T15:14","NBD","Spicy Falcon Restaurant",29.01,"Dining","Personal",1,81.22,"Actual debit 29.01; SMS displayed 29.00"],
  ["2026-08-28T17:49","NBD","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,67.22,"Expense"],
  ["2026-08-28T20:40","NBD","Qashati Al Sham Sweets",22,"Dining","Personal",1,45.22,"Expense"],
  ["2026-08-29T17:54","NBD","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,31.22,"Expense"],
  ["2026-08-30T19:30","NBD","Jannat Alfawakih Cafe",8,"Dining","Personal",1,23.22,"Expense"],
  ["2026-08-30T22:00","NBD","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,9.22,"Expense"],
  /* 28-31 Aug — FAB 4001 picks back up: a vault top-up, then more personal spend. */
  ["2026-08-28T20:05","FAB 4001","Internal transfer 4002 → 4001",400,"Excluded","Excluded",0,414.95,"Transfer; not income"],
  ["2026-08-28T22:52","FAB 4001","SMK Street Restaurant",17,"Dining","Personal",1,397.95,"Expense"],
  ["2026-08-29T15:09","FAB 4001","Team Taste (Paymob)",71,"Dining","Personal",1,326.95,"Expense"],
  ["2026-08-29T16:08","FAB 4001","Mom Store General Trading",77,"Lifestyle & Shopping","Personal",1,249.95,"Expense"],
  ["2026-08-29T16:38","FAB 4001","Alshaya Nad J605 3C",24,"Lifestyle & Shopping","Personal",1,225.95,"Expense"],
  ["2026-08-31T20:07","FAB 4001","KFC (Sharjah)",38.32,"Dining","Personal",1,187.63,"Expense"],
  ["2026-08-31T21:22","FAB 4001","Asas Al Madina General",37,"Lifestyle & Shopping","Personal",1,150.63,"Expense"],
  /* 1 Sep — a family remittance, its fee, and a new monthly minimum-balance
     charge that closes a gap the workbook had previously flagged unreconciled. */
  ["2026-09-01T13:03","FAB 4001","Spicy Falcon Restaurant",29.5,"Dining","Personal",1,121.13,"Expense"],
  ["2026-09-01T18:49","FAB 4001","Dubai Duty Free",13,"Lifestyle & Shopping","Personal",1,108.13,"Expense"],
  ["2026-09-01T23:55","FAB 4001","Remittance to card XXXX7801",50,"Excluded","Excluded",0,58.13,"Transfer, not spend, per the workbook's own classification — real balance effect only, confirmed by SMS"],
  ["2026-09-01T23:56","FAB 4001","Outward remittance fee",0.49,"Bank Fees","Household",1,57.64,"Balance-derived fee on the remittance above"],
  ["2026-09-01T23:57","FAB 4001","FAB monthly minimum balance fee",26.25,"Bank Fees","Household",1,31.39,"New — confirmed by owner. Closes a gap this account had carried as unreconciled."],
].map(([date, bank, merchant, amount, category, split, counts, balanceAfter, note], i) => ({
  id: "s" + i, date, bank, merchant, amount, category, split, counts, balanceAfter, note,
  kind: "expense",
  /* Historical rows carry no accountId on purpose: the seeded balances are
     already stated *after* these transactions, so replaying them would
     double-count. Only rows you add from here on move a balance. */
  accountId: null,
}));

const SEED_INCOME = [
  { id: "i1", date: "2026-08-06", name: "Ticket reimbursement (KHESKANI + SATYANI)", amount: 3740, status: "actual",
    note: "Two concessional tickets, AED 1,870 cost each — ticket-dealing income, not a salary advance. "
        + "Corrected 2 Sep; previously mislabelled as an early portion of salary." },
  { id: "i2", date: "2026-08-06", name: "Two-ticket profit",             amount: 260,     status: "actual",   note: "AED 4,000 received less AED 3,740 reimbursement." },
  { id: "i3", date: "2026-08-12", name: "Ticket reimbursement (DACOSTA)", amount: 1540, status: "actual",
    note: "One concessional ticket, AED 1,540 cost — ticket-dealing income, not a salary advance. "
        + "Corrected 2 Sep; previously mislabelled as a salary advance." },
  { id: "i4", date: "2026-08-12", name: "Third-ticket profit",           amount: 30,      status: "actual",   note: "Profit received 12 Aug." },
  { id: "i5", date: "2026-08-12", name: "Prior-month salary",            amount: 1430,    status: "actual",   note: "Allocated to rent." },
  { id: "i6", date: "2026-08-26", name: "Remaining payday cash",         amount: 2906.70, status: "actual",
    note: "Landed 26 Aug as expected — confirmed by SMS into NBD Current, not FAB 4001 as in prior months. "
        + "Matches the Emirates payslip exactly: gross 8,216.70 (Accommodation 3,420 + Basic 4,365 + "
        + "Overtime 431.70) less 5,310.00 in deductions (3 concessional tickets 5,280 + staff card 30) "
        + "= net pay 2,906.70." },
];

/* Staged exactly as the workbook stages them. Nothing in stage 2 or 3 is
   fundable until the rent gap in stage 1 is closed — that ordering is the
   whole point, so the app refuses to reorder it. */
const SEED_GOALS = [
  { id: "g1", stage: 1, name: "Close the rent funding gap", target: null, currentRef: "rentGapClosed",
    deadline: "2026-10-21", rentGap: true,
    note: "The binding constraint. Every other line on this page waits behind it." },
  { id: "g2", stage: 1, name: "Fully fund the October rent cheque", target: 11750, currentRef: "rentHeld",
    deadline: "2026-10-21",
    note: "Money accumulates in FAB 4002, then moves to FAB 4001 shortly before the 22nd." },
  { id: "g3", stage: 1, name: "Clear the Tabby card to zero", target: 2687.36, currentRef: "debtCleared",
    deadline: "2026-11-03",
    note: "Three payments, each from a different salary. No fee at any point." },
  { id: "g4", stage: 2, name: "Rebuild the safety buffer", target: 250, currentRef: "safeToSpend",
    deadline: "2026-11-30",
    note: "One month of breathing room. The cash you refuse to go below." },
  { id: "g5", stage: 2, name: "Emergency fund — first milestone", target: 1000, currentRef: "emergency",
    deadline: "2027-03-31",
    note: "AED 1,000 ends the era where one unexpected cost becomes a crisis." },
  { id: "g6", stage: 2, name: "Emergency fund — six months", target: null, currentRef: "emergency",
    deadline: "2029-06-30", months: 6,
    note: "Six months of essentials. Single income with a family coming — this is the real insurance." },
  { id: "g7", stage: 2, name: "Rent vault — one full year", target: null, currentRef: "rentHeld",
    deadline: "2028-10-21", yearRent: true,
    note: "Four cheques held in advance. This is what permanently ends the quarterly panic." },
  { id: "g8", stage: 3, name: "UNTOLD Dubai — 1 ticket", target: 350, currentRef: "goalFund",
    deadline: "2026-11-05",
    note: "Early-bird four-day pass, 5–8 Nov at Dubai Parks. Fundable once the rent gap closes — not before." },
  { id: "g9", stage: 3, name: "Couple's trip — 4 to 5 days", target: 4000, currentRef: "goalFund",
    deadline: null,
    note: "On hold — no date set. Midpoint of the AED 3,000–5,000 range. Setting a date on the "
        + "More tab activates the countdown; until then this tracks funding only." },
  { id: "g10", stage: 3, name: "January rent cheque", target: 11750, currentRef: "goalFund",
    deadline: "2027-01-22",
    note: "The next quarterly cheque. Assumed flat — confirm with the landlord." },
  { id: "g11", stage: 3, name: "Maternity contingency", target: 3000, currentRef: "goalFund",
    deadline: "2027-06-30",
    note: "Her Basic/EBP plan covers a normal delivery up to AED 7,000 and a C-section up to AED "
        + "10,000, both less a 10% co-payment. Out-of-pocket still runs AED 600–8,700 (government) "
        + "or AED 5,700–23,700 (private) depending on route. This is a working buffer for scans, "
        + "tests or extras — not the full private-route exposure — plus the separate newborn goal below." },
  { id: "g12", stage: 3, name: "Newborn first year", target: 8000, currentRef: "goalFund",
    deadline: "2027-12-31",
    note: "Crib, car seat, clothing, paediatrician. Insurance covers none of it. Treat as a floor." },
  { id: "g13", stage: 3, name: "Net worth reaches AED 100,000", target: 100000, currentRef: "netWorth",
    deadline: "2032-09-01",
    note: "A year of net salary held as capital." },
  { id: "g14", stage: 3, name: "Capital covers essential living costs", target: null, currentRef: "invested",
    deadline: "2046-09-01", fiTarget: true,
    note: "Financial independence: essentials paid by capital rather than by work." },
];

const SEED_ASSUMPTIONS = {
  /* Currency */
  aedPerInr: 0.0385333,          // implied by AED 462.40 = INR 12,000
  aedPerUsd: 3.6725,             // the dirham peg, unmoved since 1997

  /* Returns and inflation — planning assumptions, deliberately below trailing */
  returnIndiaEq: 0.11,
  returnGlobalEq: 0.08,
  returnCash: 0.02,
  returnCommodity: 0.05,
  returnCrypto: 0.10,
  inflation: 0.025,
  scenarioAdj: 0,

  /* Income and housing */
  /* Was 7,914.88 — that figure mixed in two ticket-dealing reimbursements
     that were never actually salary. The Aug payslip (Emirates, net pay
     2,906.70 after 3 concessional-ticket deductions) confirmed the real
     mechanics; Johnny separately confirmed 7,900 as his September
     expectation with no ticket deductions this cycle. Re-check monthly. */
  salary: 7900,
  salaryDay: 26,
  salaryIncrement: 0.04,
  rentCheque: 11750,
  rentChequesPerYear: 4,         // CONFIRMED by the owner — quarterly cheques
  rentDeadline: "2026-10-21",    // the cheque clears on the 22nd

  /* Spending controls — the workbook's own floors, not invented ones */
  dailyCap: 15,                  // minimum living need per day
  weeklyCap: 105,                // seven days at the floor
  safetyBuffer: 250,             // cash you refuse to go below
  comfortMultiplier: 1.35,
  survivalMultiplier: 0.65,

  /* Wealth plan */
  targetSavingsRate: 0.20,
  sipStepUp: 0.10,
  extraMonthly: 0,
  emergencyMonths: 6,
  monthlyEssentials: 3661,       // DEWA + du + Etisalat + groceries + household
  horizonYears: 20,
  swr: 0.04,

  /* Debt */
  tabbyExposure: 2687.36,
  tabbyMinSep: 1314.50,
  tabbyFullAug: 1972.03,
  tabbyOct: 715.33,
  tabbyLimit: 8000,
  latePenalty: 35,

  /* Forecast */
  forecastDays: 90,
  forecastBurnMode: "actual",
  recurringMinHits: 2,

  /* Household change confirmed 14 Aug: her last working day is 15 Sep and the
     grocery bill transfers to Johnny from then. Not a personal allowance — a
     recurring household cost that lands in the middle of the rent window. */
  partnerLastWorkingDay: "2026-09-15",
  groceryTransfer: 1500,

  sipAed: 462.40,
};

/* ------------------------------------------------------------- pots ---- */
/* Pots are virtual envelopes inside a real account. They never move money;
   they say what a balance is already spoken for, which is the whole reason
   AED 6,090.70 in FAB 4002 is not AED 6,090.70 of spending power. */
const SEED_POTS = [
  { id: "p-rent",  name: "Rent vault",     accountId: "fab4002", balance: 5548.76, target: 11750,
    kind: "vault",     earmark: "o-rent",
    note: "The October cheque. The whole FAB 4002 balance is committed to it." },
  { id: "p-emg",   name: "Emergency fund", accountId: "fabemg",  balance: 7.68,    target: 1000,
    kind: "emergency", earmark: null,
    note: "First milestone AED 1,000, then six months of essentials." },
];

/* ------------------------------------------------------- income --------- */
const SEED_INCOME_SOURCES = [
  { id: "src-salary", name: "Salary — main employer", type: "Salary",
    expectedMonthly: 7900, dayOfMonth: 26, ccy: "AED", active: true,
    note: "Paid on the 26th. Johnny's own confirmed expectation for September (no concessional "
        + "ticket deductions this cycle) — treated as the baseline until each month proves otherwise." },
  { id: "src-tickets", name: "Ticket dealing", type: "Side income",
    expectedMonthly: 0, dayOfMonth: 0, ccy: "AED", active: true,
    note: "Irregular, and deliberately not built into the plan — a plan that needs a side "
        + "hustle to balance is not a plan. It is, however, where the weekly earning target lands." },
];

/* ------------------------------------------------------------ debts ---- */
/* Generalised from the single Tabby exposure so a second debt can be added
   without changing any code. APR 0 is correct for Tabby while the no-fee
   minimum lands on time; the risk is the late fee, not interest. */
const SEED_DEBTS = [
  { id: "debt-tabby", name: "Tabby Card 3620", balance: 2687.36, apr: 0, minPayment: 1314.50,
    dueDay: 3, lateFee: 35, frozen: true, ccy: "AED", limit: 8000,
    note: "Frozen by choice. Resolves as AED 1,314.50 (Aug statement, 3 Sep) + AED 715.33 "
        + "(Sep statement, 3 Oct) + AED 657.53 (Oct statement, ~3 Nov, not yet generated). "
        + "Confirmed via Tabby chat, 15 Aug. Free while the minimum lands on time." },
];

const SEED_DEBT_PAYMENTS = [
  { id: "d1", debtId: "debt-tabby", date: "2026-09-03", amount: 1309.65, paid: true,
    paidFrom: "nbdcur", from: "26 Aug salary",
    note: "No-fee minimum, paid 26 Aug — eight days early, from NBD Current. 1,309.65 net of a 4.85 "
        + "cashback against the 1,314.50 statement minimum, confirmed by SMS and fully reconciled "
        + "against NBD's confirmed post-payment balance." },
  { id: "d2", debtId: "debt-tabby", date: "2026-10-03", amount: 715.33, paid: false,
    paidFrom: null, from: "26 Sep salary", note: "September statement, confirmed." },
  { id: "d3", debtId: "debt-tabby", date: "2026-11-03", amount: 657.53, paid: false,
    paidFrom: null, from: "26 Oct salary", note: "October statement, estimated. Clears the card — "
                                              + "AED 1,314.50 a month returns to you from then on." },
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
  { id: "sip5", holdingId: "h5", amountNative: 0, ccy: "INR", dayOfMonth: 10, active: false,
    stepUpPct: 0, note: "Nippon Silver ETF FoF — cancelled, holding retained" },
  { id: "sip6", holdingId: "h6", amountNative: 0, ccy: "INR", dayOfMonth: 10, active: false,
    stepUpPct: 0, note: "Motilal Oswal Midcap — paused. Restarting this at INR 6,000 for five "
                      + "years is the fastest realistic path to a crore." },
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
/* Kept as an extension point; everything now lives in SEED_ASSUMPTIONS above. */
const SEED_ASSUMPTIONS_EXTRA = {};

/* One starting point for the net-worth history. Everything after this is
   captured by the app itself. */
const SEED_SNAPSHOTS = [
  { date: "2026-08-25", note: "Seeded from the workbook", auto: false },
];


/* ------------------------------------------- family & future security --- */
/* Researched where a source exists, flagged where it does not. Nothing here
   is a guess dressed up as a figure. */
const SEED_FAMILY = {
  partner: {
    lastWorkingDay: "2026-09-15",
    groceryTransfer: 1500,
    note: "Confirmed 14 Aug. She covered groceries — under AED 2,000 a month — and that bill "
        + "transfers to Johnny from 15 September. Rent has already been his alone this year, so "
        + "no rent figure changes. Get the real grocery number when it firms up.",
  },
  insurance: {
    tier: "Basic / Essential Benefits Plan",
    status: "Active — no waiting period",
    normalDelivery: 7000,
    cSection: 10000,
    coPayment: 0.10,
    note: "Company policy, confirmed by the owner. The sub-limits are Dubai's mandated EBP "
        + "minimums; the patient pays 10% of the covered amount up to that limit.",
  },
  maternity: [
    { label: "Government hospital — cash-pay", low: 6000,  high: 15000, note: "No insurance applied — UAE Open Healthcare Directory, Apr 2026" },
    { label: "Private hospital — cash-pay",    low: 12000, high: 30000, note: "No insurance applied. A C-section runs materially higher." },
    { label: "Government hospital — out of pocket", low: 600,  high: 8700,  note: "After her EBP cover — normal delivery is low end, C-section is high end" },
    { label: "Private hospital — out of pocket",    low: 5700, high: 23700, note: "After her EBP cover — exceeds the sub-limit either way" },
  ],
  newbornFirstYear: 8000,
  contingency: 3000,
  home: {
    dubaiMinSalary: 15000,
    dubaiMinSalaryLowest: 10000,
    downPayment: 0.20,
    cashAtClosing: 0.275,
    examplePrice: 1000000,
    indiaCity: null,
    note: "Central Bank LTV cap sets the 20% deposit; total cash at closing runs about 27–28% "
        + "of the price once the DLD fee, registration, broker and valuation are added. "
        + "MortgageCompare.ae and Astra Terra, 2026.",
  },
};

/* The four paths to a crore, as modelled in the workbook. Timelines are the
   workbook's own; the trade-off column is what actually decides it. */
const SEED_CRORE_PATHS = [
  { label: "Keep the SIP flat at INR 12,000", years: 13.4, monthly: "INR 12,000",
    tradeoff: "No change. The slowest path, but the only one that is survivable today." },
  { label: "10% annual step-up", years: 11.8, monthly: "grows to INR 28,297 by year 10",
    tradeoff: "Costs more every year. Needs real income growth behind it." },
  { label: "Step-up plus Motilal at INR 6,000 for five years", years: 10.75, monthly: "peaks near INR 34,000 in year 5",
    tradeoff: "The fastest realistic path. Motilal is the best performer in the portfolio at about 23.8%." },
  { label: "Step-up plus Motilal forever", years: 10.4, monthly: "same, ongoing",
    tradeoff: "Only four months faster than stopping at five years — not worth the extra commitment." },
];
