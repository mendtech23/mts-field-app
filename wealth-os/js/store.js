/* ============================================================
   Wealth OS — state, persistence, migration and undo
   Everything lives in localStorage on this device. Nothing is uploaded.
   ============================================================ */
"use strict";

const LS_KEY = "wealth-os-v1";   // key kept from v1 so existing devices migrate
const SCHEMA = 2;

function blankState() {
  return {
    v: SCHEMA,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    asOf: "2026-08-25",
    assumptions: { ...SEED_ASSUMPTIONS, ...SEED_ASSUMPTIONS_EXTRA },
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a })),
    pots: SEED_POTS.map((p) => ({ ...p })),
    holdings: SEED_HOLDINGS.map((h) => ({ ...h })),
    invTx: SEED_INV_TX.map((t) => ({ ...t })),
    sips: SEED_SIPS.map((s) => ({ ...s })),
    obligations: SEED_OBLIGATIONS.map((o) => ({ ...o, paid: false })),
    debts: SEED_DEBTS.map((d) => ({ ...d })),
    debtPayments: SEED_DEBT_PAYMENTS.map((d) => ({ ...d })),
    budget: SEED_BUDGET.map((b) => ({ ...b })),
    tx: SEED_TX.map((t) => ({ ...t })),
    income: SEED_INCOME.map((i) => ({ ...i, sourceId: i.id === "i6" ? "src-salary" : "src-tickets" })),
    incomeSources: SEED_INCOME_SOURCES.map((s) => ({ ...s })),
    goals: SEED_GOALS.map((g) => ({ ...g })),
    rules: SEED_RULES.map((r) => ({ ...r })),
    recurring: [],          // filled by detection, then confirmed or dismissed
    snapshots: [],          // net-worth history; the first is written on boot
    dismissed: [],
    theme: "dark",
    settings: {
      displayCcy: "AED",
      capMode: "living",    // "living" excludes one-off travel and utilities
      lastBackup: null,
      notifications: false,
      onboarded: false,
    },
  };
}

let state = blankState();

/* Undo holds whole-state snapshots. They are cheap at this size and mean any
   action — including a bulk import — is reversible with one tap. */
const undoStack = [];
const UNDO_LIMIT = 25;
let undoLabel = "";

function snapshotForUndo(label) {
  undoStack.push({ label, json: JSON.stringify(state) });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  undoLabel = label;
}
function canUndo() { return undoStack.length > 0; }
function undo() {
  const last = undoStack.pop();
  if (!last) return null;
  const restored = JSON.parse(last.json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, restored);
  persist();
  return last.label;
}

/* Wrap any mutation so it lands in the undo stack and is saved exactly once. */
function mutate(label, fn) {
  snapshotForUndo(label);
  const result = fn();
  saveState();
  return result;
}

function migrate(s) {
  const base = blankState();
  if (!s || typeof s !== "object") return base;

  // v1 had no pots, debts, sips, invTx, rules, recurring, snapshots or settings.
  const out = {
    ...base,
    ...s,
    v: SCHEMA,
    assumptions: { ...base.assumptions, ...(s.assumptions || {}) },
    settings: { ...base.settings, ...(s.settings || {}) },
  };
  for (const key of ["pots", "debts", "sips", "invTx", "rules", "recurring",
                     "snapshots", "incomeSources"]) {
    if (!Array.isArray(out[key]) || (!out[key].length && base[key].length)) {
      out[key] = base[key];
    }
  }
  // v1 debt payments carried no debtId; attach them to the single debt.
  out.debtPayments = (out.debtPayments || base.debtPayments).map((d) => ({
    debtId: d.debtId || "debt-tabby", paidFrom: d.paidFrom || null, ...d,
  }));
  out.tx = (out.tx || []).map((t) => ({ accountId: null, ...t }));
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? migrate(JSON.parse(raw)) : blankState();
  } catch (e) {
    console.warn("Saved state unreadable; starting from the workbook seed.", e);
    return blankState();
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  if (!persist()) toast("Could not save — storage is full or blocked");
}

/* ------------------------------------------------------- net worth log -- */
/* One snapshot a day, written on boot. History is what turns a balance into
   a trend, and a trend is the only thing that proves the plan is working. */
function recordSnapshot(force = false) {
  const m = metrics();
  const today = todayISO();
  const last = state.snapshots[state.snapshots.length - 1];
  if (!force && last && last.date === today) return false;
  const row = {
    date: today,
    netWorth: round2(m.netWorth),
    assets: round2(m.totalAssets),
    liabilities: round2(m.debtOutstanding),
    cash: round2(m.liquidCash),
    invested: round2(m.invested),
    auto: !force,
  };
  if (last && last.date === today) state.snapshots[state.snapshots.length - 1] = row;
  else state.snapshots.push(row);
  persist();
  return true;
}

/* The seeded first snapshot has no figures — fill it from the seeded position
   so the history chart starts at the workbook, not at first launch. */
function ensureSeedSnapshot() {
  if (state.snapshots.length) return;
  const m = metrics(blankState());
  state.snapshots.push({
    date: "2026-08-25", netWorth: round2(m.netWorth), assets: round2(m.totalAssets),
    liabilities: round2(m.debtOutstanding), cash: round2(m.liquidCash),
    invested: round2(m.invested), auto: false, note: "Seeded from the workbook",
  });
}
