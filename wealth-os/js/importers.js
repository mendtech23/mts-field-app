/* ============================================================
   Wealth OS — importers
   Turn what the bank actually sends you into ledger rows. Nothing here
   writes to state: each function returns candidate rows for review, and
   the user confirms before anything lands.
   ============================================================ */
"use strict";

/* UAE bank messages vary by bank, card and channel, so the parser is a set
   of independent probes rather than one grand regex. Each probe pulls one
   fact; a line becomes a candidate when it yields at least an amount. */

const AMOUNT_RE = /(?:AED|USD|INR|SAR|EUR|GBP)\s*([0-9][0-9,]*\.?[0-9]{0,2})|([0-9][0-9,]*\.[0-9]{2})\s*(?:AED|USD|INR)/i;
const CCY_RE    = /\b(AED|USD|INR|SAR|EUR|GBP)\b/i;
const BAL_RE    = /(?:avl(?:\.|able)?\s*(?:bal(?:ance)?)?|available\s*balance|bal(?:ance)?)\s*(?:is)?\s*[:\-]?\s*(?:AED|USD|INR)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/i;
const CARD_RE   = /(?:card|a\/c|acc(?:ount)?)\s*(?:no\.?|ending|xx+|\*+)?\s*(\d{3,6})/i;
const AT_RE     = /\bat\s+([^.,;]+?)(?=\s*(?:,|\.|;|\bon\b|\bAvl\b|\bAvail|\bBal\b|$))/i;
const TO_RE     = /\b(?:to|towards)\s+([^.,;]+?)(?=\s*(?:,|\.|;|\bon\b|\bAvl\b|\bBal\b|$))/i;
const DATE_RE   = /\b(\d{1,2})[-\/ ](\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/ ](\d{2,4})\b/i;
const TIME_RE   = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i;
const CREDIT_RE = /\b(credit(?:ed)?|received|deposit(?:ed)?|refund(?:ed)?|reversal|salary|inward)\b/i;
const DEBIT_RE  = /\b(debit(?:ed)?|purchase|spent|paid|payment|withdraw(?:n|al)?|pos|transfer(?:red)? to)\b/i;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
                 jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function cleanNumber(s) { return Number(String(s || "").replace(/,/g, "")) || 0; }

function guessBank(line) {
  if (/\bFAB\b|first abu dhabi/i.test(line)) return "FAB";
  if (/\bNBD\b|emirates nbd/i.test(line)) return "NBD";
  if (/\btabby\b/i.test(line)) return "Tabby";
  if (/\bwio\b/i.test(line)) return "Wio";
  if (/\bmashreq\b/i.test(line)) return "Mashreq";
  if (/\badcb\b/i.test(line)) return "ADCB";
  return null;
}

function parseSmsDate(line) {
  const m = DATE_RE.exec(line);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = /^\d+$/.test(m[2]) ? Number(m[2]) : MONTHS[m[2].toLowerCase().slice(0, 3)];
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (!d || !mo || !y || d > 31 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseSmsTime(line) {
  const m = TIME_RE.exec(line);
  if (!m) return "12:00";
  let h = Number(m[1]);
  const mi = m[2];
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${mi}`;
}

function tidyMerchant(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/\b(dubai|uae|ae|abu dhabi|sharjah)\b\s*$/i, "")
    .replace(/[,\-\s]+$/, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 60);
}

/* Parse one message. Returns null when there is no amount to be found. */
function parseBankMessage(line, s = state) {
  const text = String(line || "").trim();
  if (text.length < 8) return null;

  const am = AMOUNT_RE.exec(text);
  if (!am) return null;
  const amount = cleanNumber(am[1] || am[2]);
  if (!amount) return null;

  const ccy = (CCY_RE.exec(text) || [, "AED"])[1].toUpperCase();
  const balM = BAL_RE.exec(text);
  const balanceAfter = balM ? cleanNumber(balM[1]) : null;
  const cardM = CARD_RE.exec(text);
  const card = cardM ? cardM[1] : null;

  const isCredit = CREDIT_RE.test(text) && !DEBIT_RE.test(text);
  const merchantRaw = (AT_RE.exec(text) || TO_RE.exec(text) || [])[1];
  const merchant = tidyMerchant(merchantRaw) ||
    (isCredit ? "Credit received" : "Card purchase");

  const date = parseSmsDate(text) || todayISO();
  const time = parseSmsTime(text);

  /* Match the card digits to a real account when we can — that is what lets
     the import move the right balance. */
  const bankName = guessBank(text);
  let account = null;
  if (card) account = s.accounts.find((a) => a.name.includes(card));
  if (!account && bankName) {
    account = s.accounts.find((a) => a.bank === bankName && a.kind === "current");
  }

  const { category, split } = classify(merchant, s);

  return {
    date: `${date}T${time}`,
    merchant,
    amount,
    ccy,
    balanceAfter,
    card,
    bank: account ? account.name.split(" —")[0] : (bankName || "Unknown"),
    accountId: account ? account.id : null,
    category: isCredit ? "Excluded" : category,
    split: isCredit ? "Excluded" : split,
    counts: isCredit ? 0 : 1,
    kind: isCredit ? "income" : "expense",
    note: "Imported from a bank message",
    raw: text,
  };
}

/* A pasted blob may be one message or fifty. Blank lines separate messages;
   so does a line that clearly starts a new one (a bank name plus an amount). */
function splitMessages(blob) {
  const chunks = String(blob || "")
    .split(/\n\s*\n+/)
    .flatMap((c) => c.split(/\n(?=(?:FAB|NBD|Emirates NBD|Tabby|Wio|Mashreq|ADCB)\b)/i))
    .map((c) => c.replace(/\s*\n\s*/g, " ").trim())
    .filter((c) => c.length > 8);
  return chunks.length ? chunks : [String(blob || "").trim()].filter(Boolean);
}

function parsePastedMessages(blob, s = state) {
  return splitMessages(blob)
    .map((line) => parseBankMessage(line, s))
    .filter(Boolean);
}

/* --------------------------------------------------------------- CSV --- */
/* Accepts either our own export or a generic statement with recognisable
   headers. Column names are matched loosely so a bank's own export usually
   works without editing. */
const CSV_ALIASES = {
  date: ["date", "transaction date", "value date", "posting date", "txn date"],
  merchant: ["merchant", "description", "details", "narrative", "particulars", "payee"],
  amount: ["amount", "debit", "value", "txn amount"],
  credit: ["credit", "deposit", "money in"],
  category: ["category"],
  split: ["split"],
  note: ["note", "notes", "remarks"],
  balance: ["balance", "running balance", "balance after", "avl bal"],
};

function matchColumn(headers, key) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of CSV_ALIASES[key] || []) {
    const i = lower.indexOf(alias);
    if (i !== -1) return i;
  }
  for (const alias of CSV_ALIASES[key] || []) {
    const i = lower.findIndex((h) => h.includes(alias));
    if (i !== -1) return i;
  }
  return -1;
}

function parseTransactionCSV(text, s = state) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const col = {
    date: matchColumn(headers, "date"),
    merchant: matchColumn(headers, "merchant"),
    amount: matchColumn(headers, "amount"),
    credit: matchColumn(headers, "credit"),
    category: matchColumn(headers, "category"),
    split: matchColumn(headers, "split"),
    note: matchColumn(headers, "note"),
    balance: matchColumn(headers, "balance"),
  };
  if (col.date === -1 || col.merchant === -1) return [];

  const out = [];
  for (const r of rows.slice(1)) {
    const rawDate = (r[col.date] || "").trim();
    const dateISO = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
      ? rawDate.slice(0, 10)
      : parseSmsDate(rawDate);
    if (!dateISO) continue;

    const debit = col.amount !== -1 ? cleanNumber(r[col.amount]) : 0;
    const credit = col.credit !== -1 ? cleanNumber(r[col.credit]) : 0;
    const isCredit = credit > 0 && debit === 0;
    const amount = Math.abs(isCredit ? credit : debit);
    if (!amount) continue;

    const merchant = tidyMerchant(r[col.merchant]);
    const declared = col.category !== -1 ? (r[col.category] || "").trim() : "";
    const guessed = classify(merchant, s);
    out.push({
      date: dateISO + "T12:00",
      merchant: merchant || "Unnamed",
      amount,
      ccy: "AED",
      balanceAfter: col.balance !== -1 ? cleanNumber(r[col.balance]) || null : null,
      accountId: null,
      bank: "Imported",
      category: CATEGORIES.includes(declared) ? declared : (isCredit ? "Excluded" : guessed.category),
      split: col.split !== -1 && r[col.split] ? r[col.split].trim() : (isCredit ? "Excluded" : guessed.split),
      counts: isCredit ? 0 : 1,
      kind: isCredit ? "income" : "expense",
      note: col.note !== -1 ? (r[col.note] || "") : "Imported from CSV",
      raw: r.join(","),
    });
  }
  return out;
}

/* --------------------------------------------------- duplicate guard --- */
/* Same day, same amount, same merchant shape — almost certainly the message
   you already imported. Flagged rather than dropped, because a genuine second
   coffee at the same shop on the same day does happen. */
function markDuplicates(candidates, s = state) {
  const seen = new Set(s.tx.map((t) =>
    [t.date.slice(0, 10), Math.round(t.amount * 100), merchantKey(t.merchant)].join("|")));
  const withinBatch = new Set();
  return candidates.map((c) => {
    const key = [c.date.slice(0, 10), Math.round(c.amount * 100), merchantKey(c.merchant)].join("|");
    const dup = seen.has(key) || withinBatch.has(key);
    withinBatch.add(key);
    return { ...c, duplicate: dup };
  });
}

/* ------------------------------------------------------- CSV export --- */
function exportTransactionsCSV(s = state) {
  const rows = s.tx.slice().sort((a, b) => a.date.localeCompare(b.date)).map((t) => ({
    date: t.date.slice(0, 10),
    time: t.date.slice(11, 16) || "",
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    split: t.split,
    counts: t.counts ? "yes" : "no",
    account: t.bank,
    balance: t.balanceAfter ?? "",
    note: t.note,
  }));
  return toCSV(rows, ["date", "time", "merchant", "amount", "category", "split",
                      "counts", "account", "balance", "note"]);
}
