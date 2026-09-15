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
  { id: "fab4001", name: "FAB 4001 — spending",   bank: "FAB",   balance: 245.31,  ccy: "AED", kind: "current", locked: false, asOf: "2026-09-15", status: "actual",
    note: "Card XXXX1599. The final leg of the Amana withdrawal (USD 75, AED 275.25) landed here 14 Sep, "
        + "closing that account out completely. Confirmed via the FAB app 15 Sep — unaffected by this "
        + "month's du and Etisalat bills, which cleared from the vault instead." },
  { id: "fab4002", name: "FAB 4002 — rent vault", bank: "FAB",   balance: 5591.49, ccy: "AED", kind: "current", locked: true,  asOf: "2026-09-15", status: "actual",
    note: "The rent vault. Confirmed via the FAB app 15 Sep: du (613.32) and Etisalat (323.95) were paid "
        + "directly from here, not from FAB 4001 as budgeted — a small draw on top of the 12 Sep repayment. "
        + "47.6% of the cheque funded." },
  { id: "fabemg",  name: "FAB 4003 — emergency",  bank: "FAB",   balance: 224.87,  ccy: "AED", kind: "savings", locked: true,  asOf: "2026-09-14", status: "actual",
    note: "Ring-fenced. A Binance withdrawal (AED 217.19) landed here 14 Sep — confirmed by SMS — on top "
        + "of the AED 7.68 already held. Next milestone AED 1,000." },
  { id: "nbdcur",  name: "NBD Current",           bank: "NBD",   balance: 0.17,    ccy: "AED", kind: "current", locked: false, asOf: "2026-09-13", status: "actual",
    note: "Card 3695. Confirmed via SMS chain to 13 Sep 18:36 (Dubai Duty Free). Running close to empty — "
        + "day-to-day spending has largely shifted to FAB 4001." },
  { id: "nbdsav",  name: "NBD Plus Saver",        bank: "NBD",   balance: 2.73,    ccy: "AED", kind: "savings", locked: false, asOf: "2026-08-04", status: "actual",
    note: "Includes AED 1.64 of interest." },
  { id: "tabbyc",  name: "Tabby Cash wallet",     bank: "Tabby", balance: 0.89,    ccy: "AED", kind: "wallet",  locked: false, asOf: "2026-08-04", status: "actual",
    note: "A funded wallet, never Card borrowing. The two must never be merged." },
  { id: "cash",    name: "Cash / Wio",            bank: "Cash",  balance: 0,       ccy: "AED", kind: "cash",    locked: false, asOf: "2026-08-11", status: "actual",
    note: "No balance reported." },
  { id: "icici",   name: "ICICI — SIP funding",   bank: "ICICI", balance: 388.51, ccy: "INR", kind: "current", locked: true, asOf: "2026-09-10", status: "actual",
    note: "Personal India account. The September SIP auto-debited INR 12,000 on 10 Sep exactly as "
        + "forecast, taking this from 12,388.51 back to 388.51. Confirmed by Johnny 12 Sep. Not part "
        + "of the AED household position." },
];

const SEED_HOLDINGS = [
  { id: "h1", name: "Nippon Large Cap",      house: "Nippon",        cls: "Indian large cap", units: 788.616, cost: 78000,    value: 77639.25, nav: 98.45,    ccy: "INR", sip: "Active",    note: "Repriced 11 Sep. The September SIP bought 30.4 more units; NAV fell, so this sleeve is now marginally below cost." },
  { id: "h2", name: "Nippon Multi Cap",      house: "Nippon",        cls: "Indian multi cap", units: 235.214, cost: 76936.89, value: 77505.37, nav: 329.51,   ccy: "INR", sip: "Active",    note: "Repriced 11 Sep." },
  { id: "h3", name: "Nippon Growth Mid Cap", house: "Nippon",        cls: "Indian mid cap",   units: 7.599,   cost: 36000,    value: 37567.63, nav: 4943.76,  ccy: "INR", sip: "Active",    note: "Repriced 11 Sep." },
  { id: "h4", name: "Nippon Small Cap",      house: "Nippon",        cls: "Indian small cap", units: 203.959, cost: 38968,    value: 42729.41, nav: 209.50,   ccy: "INR", sip: "Active",    note: "Repriced 11 Sep. Best performer of the active SIPs at about 9.7%." },
  { id: "h5", name: "Nippon Silver ETF FoF", house: "Nippon",        cls: "Commodity",        units: 115.191, cost: 2971.14,  value: 3977.55,  nav: 34.53,    ccy: "INR", sip: "Cancelled", note: "SIP cancelled; the holding remains. Still the best performer in the portfolio at about 33.9%." },
  { id: "h6", name: "Motilal Oswal Midcap",  house: "Motilal Oswal", cls: "Indian mid cap",   units: 93.721,  cost: 11000,    value: 11347.74, nav: 121.08,   ccy: "INR", sip: "Paused",    note: "Repriced 11 Sep. SIP still at zero." },
  { id: "h7", name: "Amana trading account", house: "Amana Capital", cls: "Global equity",    units: 1,       cost: 852.11,   value: 5.44,     nav: 0,        ccy: "USD", sip: "Manual",    note: "LIQUIDATED. Both withdrawals are now fully landed as cash: USD 840 arrived as AED 3,082.80 on 11 Sep, and the final USD 75 leg arrived as AED 275.25 on 14 Sep. One open position remains (QQQ, opened 11 Sep)." },
  { id: "h8", name: "Binance — spot crypto", house: "Binance",       cls: "Crypto",           units: 13,      cost: 10.10,    value: 10.10,    nav: 0,        ccy: "AED", sip: "Manual",    note: "DOWN sharply — a withdrawal of AED 217.19 landed in the emergency fund on 14 Sep, most of the prior 231.63 balance. 13 coins remain, TRX and BTC still the largest at about 29% combined." },
  { id: "h9", name: "LULU — Lulu Retail",    house: "ADX",           cls: "Global equity",    units: 1065,    cost: 1001.10,  value: 1001.10,  nav: 0,        ccy: "AED", sip: "Manual",    note: "1,065 shares on the Abu Dhabi exchange — PREVIOUSLY UNTRACKED, discovered 12 Sep. Paid an AED 31.95 cash dividend on 10 Sep. Cost basis unknown, so it is carried at market value. Not counted toward the rent gap unless sold." },
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
  { id: "o-sip-sep",   due: "2026-09-10", name: "Nippon SIP — September",  amount: 462.40,  status: "actual", paid: true, covers: "2026-09", recurrence: "Monthly",   priority: "Wealth",    note: "Already funded — the AED side went out 26 Aug (NBD Current → ICICI DirectRemit, AED 465.60, same day as the salary and Tabby payment) to pre-fund this SIP. 10 Sep is only the INR-side auto-debit inside ICICI; no further AED leaves this household. Was briefly double-counted as a pending bill; corrected 2 Sep." },
  { id: "o-du-sep",    due: "2026-09-15", name: "du — September",          amount: 613.32,  status: "actual", paid: true, recurrence: "Monthly",   priority: "Essential", note: "Paid 15 Sep 20:36, AED 613.32 (the bill-pay app's 613.62 estimate was AED 0.30 high) — and from the rent vault, not FAB 4001 as budgeted. Confirmed via FAB app and SMS." },
  { id: "o-eti-sep",   due: "2026-09-15", name: "Etisalat — September",    amount: 323.95,  status: "actual", paid: true, recurrence: "Monthly",   priority: "Essential", note: "Paid 15 Sep 20:36 from the rent vault, not FAB 4001 as budgeted. Confirmed via FAB app and SMS." },
  { id: "o-dewa-sep",  due: "2026-09-30", name: "DEWA — September",        amount: 793.42,  status: "estimate", recurrence: "Monthly",   priority: "Essential", note: "Last confirmed bill used as the baseline." },
  { id: "o-tabby-oct", due: "2026-10-03", name: "Tabby — September statement", amount: 1044.11, status: "actual", recurrence: "Statement", priority: "Critical", note: "Confirmed in the Tabby app 12 Sep and UP sharply: AED 1,044.11, not the 715.33 instalment alone. The extra AED 328.78 is new spending put on the card this cycle (partner stores 14.00 + non-partner 314.78) — the card was supposed to be frozen." },
  { id: "o-sip-oct",   due: "2026-09-26", name: "Nippon SIP — October",    amount: 462.40,  status: "estimate", covers: "2026-10", recurrence: "Monthly",   priority: "Wealth",    note: "Re-dated 2 Sep from 10 Oct to 26 Sep — the AED side actually remits on payday to pre-fund ICICI, matching the pattern just confirmed for September; the INR auto-debit itself follows on the 10th but moves no further AED out of the household. The last SIP before the rent cheque clears." },
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
  "Grooming", "Travel", "Family & Support", "Bank Fees", "Debt repayment",
  "Savings & Investments", "Unreconciled", "Excluded",
];

const CAT_COLOR = {
  "Groceries": "var(--s2)", "Dining": "var(--s8)", "Fuel & Transport": "var(--s1)",
  "Utilities & Telecom": "var(--s5)", "Lifestyle & Shopping": "var(--s3)", "Grooming": "var(--s7)",
  "Travel": "var(--s6)", "Family & Support": "var(--s4)", "Bank Fees": "var(--muted)",
  "Debt repayment": "var(--warn)", "Savings & Investments": "var(--good)",
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

/* The confirmed ledger, 1 Aug – 12 Sep 2026, rebuilt directly from the
   workbook's own transaction database so the two can never drift apart.
   `counts` marks whether a line is real spending, using the workbook's own
   test — cash impact below zero. Internal transfers, salary and other credits
   are kept for the audit trail but never totalled as expenditure. Every
   running balance below was checked against the confirmed closing balance of
   the account it belongs to; all seven tie exactly. */
const SEED_TX = [
  ["2026-08-01T12:00","NBD","ENOC Site 39",13.5,"Fuel & Transport","Household",1,337.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-01T12:00","NBD","Veda Inc Investment LLC",31,"Savings & Investments","Household",1,306.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-01T12:00","NBD","Asas Al Madina General",1,"Groceries","Household",1,305.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-01T12:00","NBD","Al Majaz Grocery Store",2,"Groceries","Household",1,303.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-01T12:00","NBD","ISK Gents Saloon",40,"Lifestyle & Shopping","Personal",1,263.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-02T12:00","NBD","Nad Al Hamar Baker",10,"Lifestyle & Shopping","Personal",1,253.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-03T11:20","FAB 4001","du + Etisalat via DubaiPay",914.93,"Utilities & Telecom","Household",1,2535.86,"Paid once — du 590.98 + Etisalat 323.95"],
  ["2026-08-03T12:00","NBD","Spicy Falcon Restaurant",7,"Dining","Personal",1,246.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-03T12:00","NBD","Jannat Alfawakih Cafe",8,"Dining","Personal",1,238.92,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-03T12:00","NBD","ENOC Site 39",13.5,"Fuel & Transport","Household",1,225.42,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-03T12:00","NBD","Asas Al Madina General",14,"Groceries","Household",1,211.42,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-04T05:00","Tabby Cash","Nad Al Hamar Star Grocery",2,"Lifestyle & Shopping","Personal",1,0.89,"Tabby Cash wallet — never Tabby Card debt"],
  ["2026-08-04T12:00","NBD","Spicy Falcon Restaurant",16,"Dining","Personal",1,195.42,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-04T12:00","NBD","ENOC Site 39",13.5,"Fuel & Transport","Household",1,181.92,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-05T12:00","NBD","Yas Home General Trading",22.97,"Lifestyle & Shopping","Personal",1,158.95,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-05T12:00","NBD","Emarat - Nad Al Hamar",13.5,"Fuel & Transport","Household",1,145.45,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-05T12:00","NBD","Asas Al Madina General",14,"Groceries","Household",1,131.45,"Confirmed via full authenticated NBD statement, 12 Sep"],
  ["2026-08-05T15:49","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,2521.86,""],
  ["2026-08-06T12:00","NBD","Asas Al Madina General",24.5,"Groceries","Household",1,106.95,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-06T12:00","NBD","Reel Entertainment LLC",20,"Lifestyle & Shopping","Personal",1,86.95,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-06T16:43","FAB 4001","Asas Al Madina General",20,"Groceries","Household",1,2501.86,""],
  ["2026-08-06T20:56","FAB 4002","Ticket reimbursement, 2x concessional (KHESKANI 1,870 + SATYANI 1,870 = 3,740 cost) + AED 260 profit — not a salary advance",4000,"Excluded","Excluded",0,4004.61,"AED 3,740 early salary + AED 260 profit from the ticket refund = AED 4,000, landing in FAB 4002 (the rent vault), not 4001. Counts against the 26 A..."],
  ["2026-08-07T06:00","FAB 4001","e& Money medical support",100,"Family & Support","Household",1,2401.86,""],
  ["2026-08-07T06:01","FAB 4001","Duplicate e& Money transfer",100,"Excluded","Excluded",0,2301.86,"Receivable — refunded 11 Aug. Never an expense"],
  ["2026-08-07T12:00","NBD","Raya Al Talal SM",10.25,"Lifestyle & Shopping","Personal",1,76.7,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T12:00","NBD","ENOC Site 39",13.5,"Fuel & Transport","Household",1,63.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T12:00","NBD","HNS Restaurant and Cafe",10,"Dining","Personal",1,53.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T12:00","NBD","Burger King Dubai Mall",10,"Dining","Personal",1,43.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T12:00","NBD","Texas Dubai Mall",10,"Dining","Personal",1,33.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T12:00","NBD","Team Taste Restaurant",31,"Dining","Personal",1,2.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-07T15:54","FAB 4001","Emirates ticket",1430,"Travel","Household",1,871.86,"Refund of AED 1,430 expected — treated as a future inflow, not netted here"],
  ["2026-08-08T07:36","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,857.86,""],
  ["2026-08-08T15:45","FAB 4001","RTS Business Bay Hotel",65,"Lifestyle & Shopping","Personal",1,792.86,""],
  ["2026-08-08T17:24","FAB 4001","RTS Business Bay Hotel",47.25,"Lifestyle & Shopping","Personal",1,745.61,""],
  ["2026-08-08T17:42","FAB 4001","RTS Business Bay Hotel",274.5,"Lifestyle & Shopping","Personal",1,471.11,"Third charge same venue same day — AED 386.75 total on 08 Aug"],
  ["2026-08-08T20:03","FAB 4001","Asas Al Madina General",20.5,"Lifestyle & Shopping","Personal",1,450.61,""],
  ["2026-08-09T09:43","FAB 4001","Salkara / Team Taste",101.5,"Dining","Household",1,349.11,""],
  ["2026-08-09T15:37","FAB 4001","Shams Al Qusais Grocery",10,"Lifestyle & Shopping","Personal",1,339.11,""],
  ["2026-08-09T15:49","FAB 4001","ENOC Site 1006",50,"Fuel & Transport","Household",1,289.11,""],
  ["2026-08-10T07:49","FAB 4001","Emarat Nad Al Hamar",13.5,"Lifestyle & Shopping","Personal",1,275.61,""],
  ["2026-08-10T10:37","FAB 4001","Jamahir Al Khair Restaurant",27,"Dining","Household",1,248.61,""],
  ["2026-08-10T12:00","ICICI","Four Nippon SIPs INR 12,000",12000,"Excluded","Excluded",0,null,"INR — excluded from AED cash impact by design"],
  ["2026-08-10T13:29","FAB 4001","Asas Al Madina General",23,"Groceries","Household",1,225.61,""],
  ["2026-08-10T15:51","FAB 4001","Zomato",66.52,"Dining","Household",1,159.09,""],
  ["2026-08-11T08:00","FAB 4001","Duplicate e& Money transfer refund",100,"Excluded","Excluded",0,259.09,"Refund — never income"],
  ["2026-08-11T10:02","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,245.09,"Card XXXX1599 · balance after AED 245.09 — confirms FAB 4001 is the spending account"],
  ["2026-08-11T21:30","FAB 4001","Asas Al Madina General",19,"Lifestyle & Shopping","Personal",1,226.09,"Card XXXX1599 — confirms the AED 39 balance gap: this + RTA Metro below"],
  ["2026-08-12T06:28","FAB 4001","RTA Dubai Metro TVM",20,"Fuel & Transport","Household",1,206.09,"Card XXXX1599, Nol card top-up"],
  ["2026-08-12T12:00","FAB 4001","Rent refund (1,430) + ticket reimbursement (DACOSTA 1,540 cost + AED 30 profit = 1,570) — not a salary advance",3000,"Excluded","Excluded",0,3206.09,"RESOLVED 12 Sep: the 30 AED was Johnny's profit on the DACOSTA ticket reimbursement (confirmed by him). The ~39 AED unlogged-spending question this..."],
  ["2026-08-12T12:00","FAB 4001","Transfer to FAB 4002 rent vault",1430,"Excluded","Excluded",0,1776.09,"Protecting the refund for rent, per plan"],
  ["2026-08-12T12:00","FAB 4002","Transfer from FAB 4001",1430,"Excluded","Excluded",0,5434.61,""],
  ["2026-08-12T16:48","FAB 4001","Transfer to FAB 4002",1576.09,"Excluded","Excluded",0,200,""],
  ["2026-08-12T16:48","FAB 4002","Transfer from FAB 4001",1576.09,"Excluded","Excluded",0,7010.7,""],
  ["2026-08-12T19:30","FAB 4001","KFC Sharjah",33,"Dining","Household",1,167,""],
  ["2026-08-12T19:43","FAB 4001","KFC Nad Al Hamar",1.5,"Dining","Household",1,165.5,""],
  ["2026-08-12T21:19","FAB 4001","Asas Al Madina General",15,"Lifestyle & Shopping","Personal",1,150.5,""],
  ["2026-08-13T20:01","FAB 4001","Nad Al Hamar Bakery",10,"Dining","Household",1,140.5,""],
  ["2026-08-13T20:59","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,126.5,""],
  ["2026-08-14T18:08","FAB 4001","Emarat Nad Al Hamar",13.5,"Lifestyle & Shopping","Personal",1,113,""],
  ["2026-08-14T18:11","FAB 4001","Emarat 6192 Nad Al Hamar",50,"Fuel & Transport","Household",1,63,""],
  ["2026-08-15T02:31","FAB 4001","Jackson Trading Co LLC",2,"Lifestyle & Shopping","Personal",1,61,""],
  ["2026-08-15T02:33","FAB 4001","Jackson Trading Co LLC",3,"Lifestyle & Shopping","Personal",1,58,""],
  ["2026-08-15T09:40","FAB 4001","From FAB 4002",100,"Excluded","Excluded",0,158,""],
  ["2026-08-15T09:40","FAB 4002","To FAB 4001",100,"Excluded","Excluded",0,6910.7,""],
  ["2026-08-15T09:59","FAB 4001","Pak Almadina Restaurant",60.5,"Dining","Household",1,97.5,""],
  ["2026-08-15T10:15","FAB 4001","Canva (Sydney AU)",70,"Lifestyle & Shopping","Personal",1,27.5,""],
  ["2026-08-15T10:58","FAB 4001","From FAB 4002",200,"Excluded","Excluded",0,227.5,""],
  ["2026-08-15T10:58","FAB 4002","To FAB 4001",200,"Excluded","Excluded",0,6710.7,""],
  ["2026-08-15T10:59","FAB 4001","Emarat 1691 Mutina S",120.02,"Fuel & Transport","Household",1,107.48,""],
  ["2026-08-15T11:51","FAB 4001","Al Rafah Grocery (Sharjah)",5.5,"Groceries","Household",1,101.98,""],
  ["2026-08-16T09:51","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,87.98,""],
  ["2026-08-16T11:07","FAB 4001","Asas Al Madina General",7.3,"Lifestyle & Shopping","Personal",1,80.68,""],
  ["2026-08-16T16:36","FAB 4001","Sahil Zam Zam Mandi",52,"Dining","Household",1,28.68,""],
  ["2026-08-16T16:50","FAB 4001","Galadari Ice Cream Co",20.01,"Lifestyle & Shopping","Personal",1,8.67,""],
  ["2026-08-16T16:51","FAB 4001","From FAB 4002",100,"Excluded","Excluded",0,108.67,""],
  ["2026-08-16T16:51","FAB 4002","To FAB 4001",100,"Excluded","Excluded",0,6610.7,""],
  ["2026-08-16T22:15","FAB 4001","Asas Al Madina General",20.5,"Lifestyle & Shopping","Personal",1,88.17,""],
  ["2026-08-17T12:00","FAB 4001","Canva (Sydney AU) — refund",70,"Excluded","Excluded",0,158.17,"Amount matches the 15 Aug Canva charge exactly (70.00). No explicit refund SMS seen, but the exact match is strong evidence — flagged as inferred,..."],
  ["2026-08-17T15:08","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,144.17,""],
  ["2026-08-17T18:01","FAB 4001","Spicy Falcon Restaurant",22,"Dining","Household",1,122.17,""],
  ["2026-08-18T06:45","FAB 4001","Dubai Duty Free",13,"Lifestyle & Shopping","Personal",1,109.17,""],
  ["2026-08-18T07:27","FAB 4001","Jackson Trading Co",3,"Lifestyle & Shopping","Personal",1,106.17,""],
  ["2026-08-18T07:28","FAB 4001","Jackson Trading Co",2,"Lifestyle & Shopping","Personal",1,104.17,""],
  ["2026-08-18T07:50","FAB 4001","External remittance to XXXX7801 — food/lifestyle",50.49,"Excluded","Excluded",0,53.68,"CONFIRMED by owner — personal food/lifestyle spending at work."],
  ["2026-08-18T21:34","FAB 4001","Malek Altikka Restaurant",30,"Dining","Household",1,23.68,""],
  ["2026-08-19T06:27","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Household",1,10.18,""],
  ["2026-08-19T12:00","NBD","S R N Supermarket",2,"Groceries","Household",1,0.2,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-19T19:24","FAB 4001","From FAB 4002",60,"Excluded","Excluded",0,70.18,""],
  ["2026-08-19T19:24","FAB 4001","RTA Dubai Metro",20,"Fuel & Transport","Household",1,50.18,""],
  ["2026-08-19T19:24","FAB 4002","To FAB 4001",60,"Excluded","Excluded",0,6550.7,""],
  ["2026-08-19T23:15","FAB 4001","Asas Al Madina General",4,"Lifestyle & Shopping","Personal",1,46.18,""],
  ["2026-08-20T17:54","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,32.18,""],
  ["2026-08-20T18:26","FAB 4001","Eat and Drink Restaurant",12,"Dining","Household",1,20.18,""],
  ["2026-08-21T08:57","FAB 4001","S R N Supermarket",2.99,"Groceries","Household",1,17.19,""],
  ["2026-08-21T09:31","FAB 4001","S R N Supermarket (2nd purchase)",2.99,"Groceries","Household",1,14.2,"CONFIRMED via SMS — second purchase, same store, 09:31, 34 min after the first."],
  ["2026-08-21T12:11","FAB 4001","Asas Al Madina General",13.5,"Lifestyle & Shopping","Personal",1,0.7,""],
  ["2026-08-21T22:03","FAB 4001","Spicy Falcon Restaurant",26.5,"Dining","Household",1,-25.8,"CONFIRMED via SMS"],
  ["2026-08-22T11:46","FAB 4001","ISK Gents Saloon",65,"Grooming","Personal",1,-90.8,"CONFIRMED via SMS, 11:46. Was flagged as an unexplained 15 inflow — the real story is this 65 expense plus an 80 transfer (added as a new row)."],
  ["2026-08-22T11:51","FAB 4001","From FAB 4002",80,"Excluded","Excluded",0,-10.8,"CONFIRMED via SMS, 11:51"],
  ["2026-08-22T11:51","FAB 4002","To FAB 4001",80,"Excluded","Excluded",0,6470.7,"CONFIRMED via SMS, 11:51"],
  ["2026-08-22T11:53","FAB 4001","Asas Al Madina General",14,"Lifestyle & Shopping","Personal",1,-24.8,""],
  ["2026-08-22T12:00","FAB 4001","From FAB 4002",100,"Excluded","Excluded",0,75.2,"CONFIRMED via SMS, 21:31"],
  ["2026-08-22T12:00","FAB 4002","Unexplained outflow (shrunk from 180)",100,"Unreconciled","Household",1,6370.7,"Was 180 — now 100 after confirming the 80 transfer separately (new row). Genuine remaining gap."],
  ["2026-08-22T15:25","FAB 4001","From FAB 4002",200,"Excluded","Excluded",0,275.2,""],
  ["2026-08-22T15:25","FAB 4002","To FAB 4001",200,"Excluded","Excluded",0,6170.7,""],
  ["2026-08-22T15:31","FAB 4001","25 Hours F and B",63.75,"Dining","Household",1,211.45,""],
  ["2026-08-22T15:40","FAB 4001","25 Hours F and B",100,"Dining","Household",1,111.45,""],
  ["2026-08-22T17:18","FAB 4001","From FAB 4002",500,"Excluded","Excluded",0,611.45,""],
  ["2026-08-22T17:18","FAB 4002","To FAB 4001",500,"Excluded","Excluded",0,5670.7,""],
  ["2026-08-22T17:40","FAB 4001","Sofitel Dubai Downtown",10,"Dining","Personal",1,601.45,""],
  ["2026-08-22T19:04","FAB 4001","Curry Chatti (Sharjah)",4,"Dining","Household",1,597.45,""],
  ["2026-08-23T00:12","FAB 4001","Asas Al Madina General",39,"Lifestyle & Shopping","Personal",1,558.45,""],
  ["2026-08-23T12:08","FAB 4001","Asas Al Madina General",20,"Lifestyle & Shopping","Personal",1,538.45,""],
  ["2026-08-23T19:03","FAB 4001","Cielo Kabab Restaurant",78,"Dining","Household",1,460.45,""],
  ["2026-08-23T19:06","FAB 4001","Nad Al Hamar Star Grocery",10,"Groceries","Household",1,450.45,""],
  ["2026-08-23T21:37","FAB 4001","To FAB 4002",420,"Excluded","Excluded",0,30.45,""],
  ["2026-08-23T21:37","FAB 4002","From FAB 4001",420,"Excluded","Excluded",0,6090.7,""],
  ["2026-08-24T06:34","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Household",1,16.95,""],
  ["2026-08-25T06:36","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Household",1,3.45,""],
  ["2026-08-25T21:00","FAB 4001","From FAB 4002",100,"Excluded","Excluded",0,103.45,"CONFIRMED via SMS"],
  ["2026-08-25T21:00","FAB 4002","To FAB 4001",100,"Excluded","Excluded",0,5990.7,"CONFIRMED via SMS"],
  ["2026-08-25T21:31","FAB 4001","My Filli Cafe",29,"Dining","Personal",1,74.45,"CONFIRMED via SMS"],
  ["2026-08-25T21:45","FAB 4001","Subway",43,"Dining","Personal",1,31.45,"CONFIRMED via SMS"],
  ["2026-08-25T22:02","FAB 4001","Galadari Ice Cream Co",10,"Lifestyle & Shopping","Personal",1,21.45,"CONFIRMED via SMS"],
  ["2026-08-25T22:03","FAB 4001","Galadari Ice Cream Co",10,"Lifestyle & Shopping","Personal",1,11.45,"CONFIRMED via SMS"],
  ["2026-08-25T22:46","FAB 4001","From FAB 4002",50,"Excluded","Excluded",0,61.45,"CONFIRMED via SMS"],
  ["2026-08-25T22:46","FAB 4002","To FAB 4001",50,"Excluded","Excluded",0,5940.7,"CONFIRMED via SMS"],
  ["2026-08-25T22:53","FAB 4001","Real Choice Grocery",33,"Groceries","Household",1,28.45,"CONFIRMED via SMS"],
  ["2026-08-26T12:00","NBD","Salary for Aug 2026",2906.7,"Excluded","Excluded",0,2906.9,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-26T12:00","NBD","Nippon SIP remittance -- ICICI (INR 12,000 @ 0.0388)",465.6,"Savings & Investments","Household",1,2441.3,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-26T18:20","FAB 4001","Emarat — Nad Al Hamar",13.5,"Fuel & Transport","Household",1,14.95,"CONFIRMED via SMS."],
  ["2026-08-27T12:00","NBD","Cielo Kabab Restaurant",20,"Dining","Personal",1,2421.3,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-27T12:00","NBD","Tabby -- Visa Direct payment",1309.65,"Debt repayment","Household",1,1111.65,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-27T12:00","NBD","Emarat 6192 Nad Al Ham",75.05,"Fuel & Transport","Household",1,1036.6,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-28T12:00","NBD","Tabby monthly card fee",49,"Bank Fees","Household",1,987.6,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-28T12:00","NBD","Digital Dubai (DEWA)",813.28,"Utilities & Telecom","Household",1,174.32,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-28T12:00","NBD","Netflix.com",36.1,"Lifestyle & Shopping","Personal",1,138.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-28T20:05","FAB 4001","From FAB 4002",400,"Excluded","Excluded",0,414.95,"CONFIRMED via SMS."],
  ["2026-08-28T22:52","FAB 4001","SMK Street Restaurant",17,"Dining","Personal",1,397.95,"CONFIRMED via SMS."],
  ["2026-08-29T12:00","NBD","Spicy Falcon Restaurant",7,"Dining","Personal",1,131.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-29T12:00","NBD","Real Choice Grocery",15,"Groceries","Household",1,116.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-29T12:00","NBD","Spicy Falcon Restaurant",29,"Dining","Personal",1,87.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-29T12:00","NBD","Asas Al Madina General",6,"Groceries","Household",1,81.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-29T15:09","FAB 4001","Team Taste (Paymob)",71,"Dining","Personal",1,326.95,"CONFIRMED via SMS."],
  ["2026-08-29T16:08","FAB 4001","Mom Store General Trading",77,"Lifestyle & Shopping","Personal",1,249.95,"CONFIRMED via SMS."],
  ["2026-08-29T16:38","FAB 4001","Alshaya Nad J605 3C",24,"Lifestyle & Shopping","Personal",1,225.95,"CONFIRMED via SMS."],
  ["2026-08-30T12:00","NBD","Asas Al Madina General",14,"Groceries","Household",1,67.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-30T12:00","NBD","Qashati Al Sham Sweets",22,"Dining","Personal",1,45.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-31T12:00","FAB 4002","FAB interest credit",8.06,"Excluded","Excluded",0,5948.76,"CONFIRMED via SMS."],
  ["2026-08-31T12:00","FAB 4003","FAB interest credit",0.01,"Excluded","Excluded",0,7.68,"CONFIRMED via SMS."],
  ["2026-08-31T12:00","NBD","Asas Al Madina General",14,"Groceries","Household",1,31.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-08-31T20:05","FAB 4002","To FAB 4001",400,"Excluded","Excluded",0,5548.76,"CONFIRMED via SMS."],
  ["2026-08-31T20:07","FAB 4001","KFC (Sharjah)",38.32,"Dining","Personal",1,187.63,"CONFIRMED via SMS."],
  ["2026-08-31T21:22","FAB 4001","Asas Al Madina General",37,"Lifestyle & Shopping","Personal",1,150.63,"CONFIRMED via SMS."],

  ["2026-09-01T12:00","FAB 4001","FAB monthly minimum balance fee",26.25,"Bank Fees","Household",1,124.38,"CONFIRMED by owner — monthly minimum balance charge, 1 Sep. Closes the gap that was previously flagged unreconciled. Same pattern seen before on th..."],
  ["2026-09-01T12:00","NBD","Jannat Alfawakih Cafe",8,"Dining","Personal",1,23.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-09-01T12:00","NBD","Asas Al Madina General",14,"Groceries","Household",1,9.22,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-09-01T13:03","FAB 4001","Spicy Falcon Restaurant",29.5,"Dining","Personal",1,94.88,"CONFIRMED via SMS."],
  ["2026-09-01T18:49","FAB 4001","Dubai Duty Free",13,"Lifestyle & Shopping","Personal",1,81.88,"CONFIRMED via SMS."],
  ["2026-09-01T23:55","FAB 4001","To XXXX7801",50,"Excluded","Excluded",0,31.88,"CONFIRMED via SMS."],
  ["2026-09-01T23:55","FAB 4001","Outward remittance fee",0.49,"Bank Fees","Household",1,31.39,"CONFIRMED via SMS."],
  ["2026-09-02T12:00","FAB 4001","Spicy Falcon Restaurant",7,"Dining","Personal",1,24.39,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 24.39"],
  ["2026-09-02T12:00","FAB 4001","Asas Al Madina General",14,"Groceries","Household",1,10.39,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 10.39"],
  ["2026-09-02T12:00","FAB 4001","From FAB 4002 (vault draw)",100,"Excluded","Excluded",0,110.39,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 110.39"],
  ["2026-09-02T12:00","FAB 4001","Malek Altikka Restaurant",30,"Lifestyle & Shopping","Personal",1,80.39,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 80.39"],
  ["2026-09-02T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",100,"Excluded","Excluded",0,5448.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-03T12:00","FAB 4001","ENOC Site No-1074",16.75,"Fuel & Transport","Household",1,63.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 63.64"],
  ["2026-09-03T12:00","FAB 4001","McDonalds - Nad Al Hamar",24,"Dining","Personal",1,39.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 39.64"],
  ["2026-09-03T12:00","FAB 4001","From FAB 4002 (vault draw)",200,"Excluded","Excluded",0,239.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 239.64"],
  ["2026-09-03T12:00","FAB 4001","Minutes Quick Services",10,"Lifestyle & Shopping","Personal",1,229.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 229.64"],
  ["2026-09-03T12:00","FAB 4001","TGI Friday's",111,"Dining","Personal",1,118.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 118.64"],
  ["2026-09-03T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",200,"Excluded","Excluded",0,5248.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-04T12:00","FAB 4001","Asas Al Madina General",16,"Groceries","Household",1,102.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 102.64"],
  ["2026-09-04T12:00","FAB 4001","Spicy Falcon Restaurant",26,"Dining","Personal",1,76.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 76.64"],
  ["2026-09-04T12:00","NBD","Asas Al Madina General",4.5,"Groceries","Household",1,4.72,"Confirmed via authenticated Emirates NBD statement, 12 Sep -- full period 1 Aug-10 Sep"],
  ["2026-09-05T12:00","FAB 4001","ENOC Site 39",13.5,"Fuel & Transport","Household",1,63.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 63.14"],
  ["2026-09-05T12:00","FAB 4001","Nad Al Hamar Baker",10,"Lifestyle & Shopping","Personal",1,53.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 53.14"],
  ["2026-09-06T12:00","FAB 4001","Asas Al Madina General",14,"Groceries","Household",1,39.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 39.14"],
  ["2026-09-06T12:00","FAB 4001","Spicy Falcon Restaurant",29,"Dining","Personal",1,10.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 10.14"],
  ["2026-09-06T12:00","FAB 4001","From FAB 4002 (vault draw)",200,"Excluded","Excluded",0,210.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 210.14"],
  ["2026-09-06T12:00","FAB 4001","Favourite Place Gents",70,"Lifestyle & Shopping","Personal",1,140.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 140.14"],
  ["2026-09-06T12:00","FAB 4001","Bombay Grills And Woks",118,"Dining","Personal",1,22.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 22.14"],
  ["2026-09-06T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",200,"Excluded","Excluded",0,5048.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-07T12:00","FAB 4001","From FAB 4002 (vault draw)",20,"Excluded","Excluded",0,42.14,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 42.14"],
  ["2026-09-07T12:00","FAB 4001","ENOC Site 39",23.5,"Fuel & Transport","Household",1,18.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 18.64"],
  ["2026-09-07T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",20,"Excluded","Excluded",0,5028.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-08T12:00","FAB 4001","From FAB 4002 (vault draw)",500,"Excluded","Excluded",0,518.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 518.64"],
  ["2026-09-08T12:00","FAB 4001","Al Dar Al Fidhi Auto (Mazda 2)",295,"Fuel & Transport","Household",1,223.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 223.64"],
  ["2026-09-08T12:00","FAB 4001","Sahwat Al Khail Cafe",18,"Dining","Personal",1,205.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 205.64"],
  ["2026-09-08T12:00","FAB 4001","Asas Al Madina General",14,"Groceries","Household",1,191.64,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 89.74"],
  ["2026-09-08T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",500,"Excluded","Excluded",0,4528.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-08T12:00","FAB 4002","Omid Hussain (within UAE, Mazda 2) -- Outward Remittance",550,"Fuel & Transport","Household",1,3978.76,"Confirmed via FAB SMS: debited from XXXX4002 (not 4001), 8 Sep, resulting balance AED 3,978.76"],
  ["2026-09-08T12:00","FAB 4001","African and Eastern (Dubai)",101.9,"Lifestyle & Shopping","Personal",1,89.74,"Confirmed via bank receipt (ref FT26253546JH). Johnny confirmed 100% the actual purchase was 8 Sep -- the app detail view showing 10 Sep is a posti..."],
  ["2026-09-09T12:00","FAB 4001","Spicy Falcon Restaurant",6,"Dining","Personal",1,83.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 83.74"],
  ["2026-09-09T12:00","FAB 4001","Asas Al Madina General",14,"Groceries","Household",1,69.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 69.74"],
  ["2026-09-09T12:00","FAB 4001","Asas Al Madina General",3.5,"Groceries","Household",1,66.24,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 66.24"],
  ["2026-09-10T12:00","FAB 4001","Meem Supermarket",14.5,"Groceries","Household",1,51.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 51.74"],
  ["2026-09-10T12:00","FAB 4001","From FAB 4002 (vault draw)",300,"Excluded","Excluded",0,351.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 351.74"],
  ["2026-09-10T12:00","FAB 4001","Peninsula Hospitality (SMS not captured, confirmed by balance math)",214,"Family & Support","Household",1,137.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 137.74"],
  ["2026-09-10T12:00","FAB 4001","Malek Altikka Restaurant",30,"Lifestyle & Shopping","Personal",1,107.74,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 107.74"],
  ["2026-09-10T12:00","FAB 4001","Asas Al Madina General",56.5,"Groceries","Household",1,51.24,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 51.24"],
  ["2026-09-10T12:00","FAB 4002","To FAB 4001 (vault draw for daily spending)",300,"Excluded","Excluded",0,3678.76,"Confirmed via FAB SMS chain, 12 Sep"],
  ["2026-09-10T12:00","NBD","ADX LULU cash dividend",31.95,"Excluded","Excluded",0,36.67,"Corrected 12 Sep via Emirates NBD email: credited Thu 10 Sep, balance went 4.72 -> 36.67 exactly (matches the Sept2 checkpoint with zero other NBD..."],
  ["2026-09-11T12:00","FAB 4001","Inward Remittance -- Amana liquidation proceeds",3082.8,"Excluded","Excluded",0,3134.04,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 3134.04"],
  ["2026-09-11T12:00","FAB 4001","Abhijith Suresh (within UAE) -- expected back",200,"Family & Support","Household",1,2934.04,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 2933.55"],
  ["2026-09-11T12:00","FAB 4001","Spicy Falcon Restaurant",13,"Dining","Personal",1,2921.04,"Confirmed via FAB SMS chain, 12 Sep -- balance after: AED 2920.55"],
  ["2026-09-11T12:00","FAB 4001","Fund Transfer Charges (Abhijith Within UAE transfer)",0.49,"Bank Fees","Household",1,2920.55,"Inferred from the confirmed 0.49 Within-UAE transfer fee pattern (Abdel Samy, Abhijith) -- closes the final AED 0.49 gap exactly."],
  ["2026-09-11T12:00","NBD","Nad Al Hamar Baker",10,"Lifestyle & Shopping","Personal",1,26.67,"Confirmed via SMS chain, 12 Sep"],
  ["2026-09-12T12:00","NBD","ENOC Site 39",13.5,"Fuel & Transport","Household",1,13.17,"Confirmed via SMS chain, 12 Sep"],
  ["2026-09-12T12:00","FAB 4001","To FAB 4002 (vault top-up)",2900,"Excluded","Excluded",0,20.55,"Confirmed via FAB SMS, 12 Sep 13:23"],
  ["2026-09-12T12:00","FAB 4002","From FAB 4001 (vault top-up)",2900,"Excluded","Excluded",0,6578.76,"Confirmed via FAB SMS, 12 Sep 13:23"],
  ["2026-09-13T12:00","FAB 4001","Asas Al Madina General",16,"Groceries","Household",1,4.55,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-13T12:00","FAB 4001","From FAB 4002",50,"Excluded","Excluded",0,54.55,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-13T12:00","FAB 4002","To FAB 4001",50,"Excluded","Excluded",0,6528.76,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-13T12:00","FAB 4001","Spicy Falcon Restaurant",29,"Dining","Personal",1,25.55,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-13T12:00","NBD","Dubai Duty Free",13,"Lifestyle & Shopping","Personal",1,0.17,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-14T12:00","FAB 4001","Personal expense (to XXXX7801)",20,"Family & Support","Household",1,5.55,"Categorized as personal expense per Johnny, 14 Sep"],
  ["2026-09-14T12:00","FAB 4001","Fund Transfer Charges",0.49,"Bank Fees","Household",1,5.06,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-14T12:00","FAB 4003","Inward Remittance -- Binance withdrawal proceeds",217.19,"Excluded","Excluded",0,224.87,"Confirmed via FAB/NBD SMS chain, 14 Sep"],
  ["2026-09-14T12:00","FAB 4001","Inward Remittance -- Amana $75 withdrawal, final leg landed",275.25,"Excluded","Excluded",0,280.31,"Confirmed via FAB SMS, 14 Sep: balance 5.06 -> 280.31"],
  ["2026-09-14T12:00","FAB 4001","Spicy Falcon Restaurant",12,"Dining","Personal",1,268.31,"Confirmed via FAB SMS, 14 Sep 15:20"],
  ["2026-09-15T12:00","FAB 4001","Dubai Duty Free",13,"Groceries","Household",1,255.31,"Confirmed via FAB SMS, 15 Sep"],
  ["2026-09-15T12:00","FAB 4001","Nad Al Hamar Baker",10,"Groceries","Household",1,245.31,"Confirmed via FAB SMS, 15 Sep"],
  ["2026-09-15T12:00","FAB 4002","Utility Bill Payment, consumer 0559927666",613.32,"Utilities & Telecom","Household",1,5915.44,"Confirmed via FAB app + SMS, 15 Sep 20:36 -- paid FROM the vault (FAB 4002), not FAB 4001"],
  ["2026-09-15T12:00","FAB 4002","ETISALAT FIXED, consumer 043861653",323.95,"Utilities & Telecom","Household",1,5591.49,"Confirmed via FAB app + SMS, 15 Sep 20:36 -- paid FROM the vault (FAB 4002), not FAB 4001"],
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
        + "= net pay 2,906.70.", sourceId: "src-salary" },
  { id: "i9", date: "2026-08-17", name: "Canva refund",                  amount: 70,      status: "actual", sourceId: "src-invest",
    note: "Full refund of the 15 Aug charge. The charge is still counted as spending and this reverses "
        + "it, so the pair nets to zero rather than either side quietly disappearing." },
  { id: "i10", date: "2026-08-31", name: "Bank interest — FAB",          amount: 8.07,    status: "actual", sourceId: "src-invest",
    note: "AED 8.06 credited to the rent vault and AED 0.01 to the emergency fund on 31 Aug." },
  { id: "i7", date: "2026-09-10", name: "LULU cash dividend",            amount: 31.95,   status: "actual", sourceId: "src-invest",
    note: "Paid into NBD Current on the 1,065 LULU shares. Confirmed by Emirates NBD email — the "
        + "balance moved 4.72 → 36.67 exactly." },
  { id: "i8", date: "2026-09-11", name: "Amana liquidation proceeds",    amount: 3082.80, status: "actual", sourceId: "src-invest",
    note: "A USD 840 withdrawal from the Amana brokerage, landing in FAB 4001 on 11 Sep. This is sold "
        + "investment capital, not earnings — it moves money from the investment column to the cash "
        + "column and does not improve net worth." },
  { id: "i11", date: "2026-09-14", name: "Binance withdrawal proceeds",  amount: 217.19,  status: "actual", sourceId: "src-invest",
    note: "Landed straight in the emergency fund (FAB 4003), not a spending account — a deliberate "
        + "conversion of crypto into the shock-absorber it was always meant to be. Sold capital, not "
        + "earnings; net worth is unchanged, just less exposed to crypto." },
  { id: "i12", date: "2026-09-14", name: "Amana final withdrawal (USD 75 leg)", amount: 275.25, status: "actual", sourceId: "src-invest",
    note: "The last piece of the Amana liquidation, landing in FAB 4001. Amana is now fully closed out "
        + "bar one open position (QQQ)." },
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
  { id: "p-rent",  name: "Rent vault",     accountId: "fab4002", balance: 5591.49, target: 11750,
    kind: "vault",     earmark: "o-rent",
    note: "The October cheque. AED 2,900 of the Amana sale proceeds was put back on 12 Sep, then du and "
        + "Etisalat cleared straight from here on 15 Sep — a small, correct draw for a real committed bill, "
        + "not a raid. 47.6% funded." },
  { id: "p-emg",   name: "Emergency fund", accountId: "fabemg",  balance: 224.87,  target: 1000,
    kind: "emergency", earmark: null,
    note: "A Binance withdrawal (217.19) landed here 14 Sep, on top of the AED 7.68 already held — the "
        + "first real progress toward the AED 1,000 milestone. 22.5% of the way there." },
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
  { id: "src-invest", name: "Capital & refunds", type: "Capital",
    expectedMonthly: 0, dayOfMonth: 0, ccy: "AED", active: true,
    note: "Dividends, interest, refunds and sale proceeds. Never projected forward — selling an asset "
        + "moves money between columns rather than creating any, so it must never be mistaken for income." },
];

/* ------------------------------------------------------------ debts ---- */
/* Generalised from the single Tabby exposure so a second debt can be added
   without changing any code. APR 0 is correct for Tabby while the no-fee
   minimum lands on time; the risk is the late fee, not interest. */
const SEED_DEBTS = [
  { id: "debt-tabby", name: "Tabby Card 3620", balance: 3011.29, apr: 0, minPayment: 1044.11,
    dueDay: 3, lateFee: 35, frozen: true, ccy: "AED", limit: 8000,
    note: "Was AED 2,687.36 of exposure. AED 328.78 of new spending went onto the card during the "
        + "September cycle despite it being frozen, and the August payment came in 4.85 under the "
        + "statement thanks to cashback: 2,687.36 + 328.78 − 4.85 = 3,011.29 of total exposure, of "
        + "which 1,309.65 is already paid. What remains resolves exactly as AED 1,044.11 (Sep "
        + "statement, 3 Oct) + AED 657.53 (Oct statement, ~3 Nov). Still interest-free while each "
        + "minimum lands on time — the risk is the late fee, not interest." },
];

const SEED_DEBT_PAYMENTS = [
  { id: "d1", debtId: "debt-tabby", date: "2026-09-03", amount: 1309.65, paid: true,
    paidFrom: "nbdcur", from: "26 Aug salary",
    note: "No-fee minimum, paid 26 Aug — eight days early, from NBD Current. 1,309.65 net of a 4.85 "
        + "cashback against the 1,314.50 statement minimum, confirmed against the authenticated NBD "
        + "statement (which dates the debit 27 Aug)." },
  { id: "d2", debtId: "debt-tabby", date: "2026-10-03", amount: 1044.11, paid: false,
    paidFrom: null, from: "26 Sep salary",
    note: "UP from 715.33. Confirmed in the Tabby app 12 Sep: the instalment is still 715.33, but "
        + "AED 328.78 of new purchases this cycle ride on top of it. Autopay takes the full 1,044.11 "
        + "on 3 Oct." },
  { id: "d3", debtId: "debt-tabby", date: "2026-11-03", amount: 657.53, paid: false,
    paidFrom: null, from: "26 Oct salary", note: "October statement, confirmed in the Tabby app. "
                                              + "Clears the card — provided nothing further is charged to it." },
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
