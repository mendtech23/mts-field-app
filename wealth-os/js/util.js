/* ============================================================
   Wealth OS — shared utilities
   Formatting, dates, small maths. No state, no DOM writes.
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
function addMonthsKey(k, n) {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}


/* ------------------------------------------------------- more dates --- */
function parseDate(s) { return new Date(String(s).slice(0, 10) + "T00:00:00"); }
function addDaysISO(isoStr, n) {
  const d = parseDate(isoStr);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function weekKey(isoStr) {
  // ISO-8601 week, Monday start — used for the weekly spending cap.
  const d = parseDate(isoStr);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return iso(d);
}
function startOfMonth(k) { return k + "-01"; }
function endOfMonth(k) {
  const [y, m] = k.split("-").map(Number);
  return iso(new Date(y, m, 0));
}
function daysInMonth(k) {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function dayName(isoStr) {
  return parseDate(isoStr).toLocaleDateString("en-GB", { weekday: "short" });
}
function relativeDays(n) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
/* Nth day of a month, clamped so "the 31st" still lands in February. */
function dayOfMonthISO(monthK, day) {
  return monthK + "-" + String(Math.min(day, daysInMonth(monthK))).padStart(2, "0");
}

/* ---------------------------------------------------------- numbers --- */
function safeDiv(a, b, fallback = 0) { return b ? a / b : fallback; }
function median(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b), h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
function stdev(xs) {
  if (xs.length < 2) return 0;
  const mean = sum(xs) / xs.length;
  return Math.sqrt(sum(xs, (x) => (x - mean) ** 2) / (xs.length - 1));
}

/* -------------------------------------------------------------- csv --- */
function toCSV(rows, headers) {
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n");
}
/* Tolerates quoted fields, embedded commas and CRLF. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function download(name, text, mime = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/* Stable key for "is this the same merchant?" across statement spellings. */
function merchantKey(s) {
  return String(s || "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(llc|l l c|co|company|trading|general|dubai|uae|est|store|branch|site|no|\d{3,})\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
