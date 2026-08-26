/* ============================================================
   Wealth OS — modals
   Every write to state goes through `mutate`, so every one of them is
   undoable and saved exactly once.
   ============================================================ */
"use strict";

/* Move money on an account. Confirming a balance sets it absolutely; this
   only ever adjusts, and only for things that genuinely happened. */
function moveBalance(accountId, delta) {
  if (!accountId) return;
  const a = state.accounts.find((x) => x.id === accountId);
  if (a) a.balance = round2(a.balance + delta);
}

/* Paying a bill takes money off the account and, when a pot was being held
   against that bill, off the pot as well. Without this the pot would go on
   claiming money that has already gone, and safe-to-spend would understate
   what you have. Returns what the pot could not cover. */
function spendAgainst(accountId, amount, earmarkId) {
  moveBalance(accountId, -amount);
  if (!earmarkId) return amount;
  let left = amount;
  for (const p of state.pots.filter((x) => x.earmark === earmarkId && x.balance > 0)) {
    const draw = Math.min(p.balance, left);
    p.balance = round2(p.balance - draw);
    left = round2(left - draw);
    if (left <= 0) break;
  }
  return left;
}

function txModal(id, prefill) {
  const t = id ? state.tx.find((x) => x.id === id) : null;
  const seed = t || prefill || {};
  const body = `
    ${field("merchant", "Merchant or description", seed.merchant || "", "text",
            "required placeholder='Asas Al Madina'")}
    <div class="grid2">
      ${field("amount", "Amount (AED)", seed.amount ?? "", "number", "step='0.01' min='0' required")}
      ${field("date", "Date", (seed.date || todayISO()).slice(0, 10), "date", "required")}
    </div>
    <div class="grid2">
      ${selectField("category", "Category", seed.category || "Groceries", CATEGORIES)}
      ${selectField("split", "Split", seed.split || "Personal", ["Personal", "Household", "Excluded"])}
    </div>
    <div class="grid2">
      ${accountSelect("accountId", "Paid from", t ? t.accountId : (seed.accountId ?? "fab4001"))}
      ${selectField("counts", "Counts as spending", (seed.counts ?? 1) ? "Yes" : "No", ["Yes", "No"])}
    </div>
    ${field("note", "Note", seed.note || "", "text", "placeholder='Optional'")}
    <div class="note">Mark a line <em>No</em> when it is a transfer between your own accounts, a salary credit or a
      refunded charge — recorded for the audit trail, never counted as spending. Linking an account also takes the
      amount off that balance.</div>`;

  openModal(id ? "Edit transaction" : "Record a transaction", body, (d) => {
    const amount = Math.abs(Number(d.amount) || 0);
    if (!amount || !d.merchant.trim()) { toast("A merchant and an amount are required"); return false; }
    mutate(id ? "edit transaction" : "add transaction", () => {
      const acc = state.accounts.find((a) => a.id === d.accountId);
      const rec = {
        id: id || uid(),
        date: d.date + (t ? t.date.slice(10) : "T12:00"),
        accountId: d.accountId || null,
        bank: acc ? acc.name.split(" —")[0] : (t ? t.bank : "Cash"),
        merchant: d.merchant.trim(), amount,
        category: d.category, split: d.split, counts: d.counts === "Yes" ? 1 : 0,
        balanceAfter: t ? t.balanceAfter : null,
        note: d.note || "", kind: "expense",
      };
      if (t) moveBalance(t.accountId, t.amount);
      moveBalance(rec.accountId, -rec.amount);
      if (id) state.tx = state.tx.map((x) => (x.id === id ? rec : x));
      else state.tx.push(rec);
      // learn from a correction, but only when the guess was genuinely wrong
      const learned = learnRule(rec.merchant, rec.category, rec.split);
      if (learned) toast(`Learned: ${rec.merchant} → ${rec.category}`);
    });
    toast(id ? "Transaction updated" : `Recorded — ${money(amount)}`, undoAction());
  }, id ? {
    danger: () => mutate("delete transaction", () => {
      moveBalance(t.accountId, t.amount);
      state.tx = state.tx.filter((x) => x.id !== id);
      toast("Transaction deleted", undoAction());
    }),
  } : {});
}

function undoAction() {
  return { label: "Undo", run: () => { const l = undo(); render(); toast(l ? `Undid ${l}` : "Nothing to undo"); } };
}

function budgetModal(id) {
  const b = state.budget.find((x) => x.id === id);
  if (!b) return;
  const line = metrics().budget.find((x) => x.id === id);
  openModal(b.line, `
    ${field("plan", "Monthly plan (AED)", b.plan, "number", "step='0.01' min='0' required")}
    ${selectField("priority", "Priority", b.priority,
      ["Critical", "Essential", "Discretionary", "Deferred", "Avoidable", "Control", "Wealth"])}
    ${field("note", "Note", b.note)}
    <div class="note">Actual over the ledger window: <strong>${money(line.actual)}</strong> —
      a run rate of <strong>${money(line.rate)}</strong> a month.
      ${line.cat ? "" : "This line has no ledger category, so it is planned only."}</div>`,
    (d) => mutate("edit budget", () => {
      b.plan = Number(d.plan) || 0;
      b.priority = d.priority;
      b.note = d.note;
      toast("Budget updated", undoAction());
    }));
}

function holdingModal(id) {
  const h = state.holdings.find((x) => x.id === id);
  if (!h) return;
  openModal(h.name, `
    ${field("name", "Name", h.name)}
    <div class="grid2">
      ${field("value", `Current value (${h.ccy})`, h.value, "number", "step='0.01' required")}
      ${field("cost", `Cost (${h.ccy})`, h.cost, "number", "step='0.01' required")}
    </div>
    <div class="grid2">
      ${field("units", "Units", h.units, "number", "step='any'")}
      ${field("nav", "NAV", h.nav, "number", "step='any'")}
    </div>
    <div class="grid2">
      ${selectField("cls", "Asset class", h.cls, Object.keys(ALLOC_TARGETS))}
      ${selectField("sip", "SIP status", h.sip, ["Active", "Cancelled", "Paused", "Manual", "Idle"])}
    </div>
    ${field("note", "Evidence", h.note)}
    <div class="note">Update after each statement. Values are held in the fund's own currency and converted at the
      rates on the settings page, so a rate change re-prices the whole portfolio at once.</div>`,
    (d) => mutate("edit holding", () => {
      Object.assign(h, {
        name: d.name || h.name,
        value: Number(d.value) || 0, cost: Number(d.cost) || 0,
        units: Number(d.units) || 0, nav: Number(d.nav) || 0,
        cls: d.cls, sip: d.sip, note: d.note,
      });
      toast("Holding updated", undoAction());
    }),
    { danger: () => mutate("delete holding", () => {
        state.holdings = state.holdings.filter((x) => x.id !== id);
        state.sips = state.sips.filter((x) => x.holdingId !== id);
        toast("Holding removed", undoAction());
      }) });
}

function accountModal(id) {
  const a = state.accounts.find((x) => x.id === id);
  if (!a) return;
  openModal(a.name, `
    ${field("name", "Name", a.name)}
    ${field("balance", "Balance (AED)", a.balance, "number", "step='0.01' required")}
    ${field("asOf", "Confirmed on", a.asOf, "date", "required")}
    ${selectField("locked", "Ring-fenced", a.locked ? "Yes" : "No", ["No", "Yes"])}
    ${field("note", "Note", a.note)}
    <div class="note">Only enter a balance you can see on a bank message, app screen or statement. This sets the
      balance absolutely — an expected credit is not a balance.</div>`,
    (d) => mutate("confirm balance", () => {
      Object.assign(a, {
        name: d.name || a.name,
        balance: Number(d.balance) || 0, asOf: d.asOf,
        locked: d.locked === "Yes", note: d.note, status: "actual",
      });
      if (d.asOf > state.asOf) state.asOf = d.asOf;
      toast("Balance confirmed", undoAction());
    }));
}

function potModal(id) {
  const p = id ? state.pots.find((x) => x.id === id) : null;
  openModal(p ? p.name : "New pot", `
    ${field("name", "Name", p ? p.name : "", "text", "required")}
    <div class="grid2">
      ${field("balance", "Held (AED)", p ? p.balance : 0, "number", "step='0.01'")}
      ${field("target", "Target (AED)", p ? p.target : 0, "number", "step='0.01'")}
    </div>
    <div class="grid2">
      ${selectField("accountId", "Inside which account", p ? p.accountId : state.accounts[0].id,
        state.accounts.map((a) => ({ value: a.id, label: a.name })))}
      ${selectField("kind", "Kind", p ? p.kind : "vault", ["vault", "float", "emergency", "goal"])}
    </div>
    ${selectField("earmark", "Held against which bill", p ? (p.earmark || "") : "",
      [{ value: "", label: "Nothing in particular" }].concat(
        state.obligations.filter((o) => !o.paid)
          .map((o) => ({ value: o.id, label: `${o.name} — ${money(o.amount)} due ${longDate(o.due)}` }))))}
    ${field("note", "Note", p ? p.note : "")}
    <div class="note">A pot never moves money. It records that part of a balance is already promised, and every
      safe-to-spend figure in the app subtracts it. Naming the bill it is held against also stops the cashflow
      forecast charging you twice for the same dirham.</div>`,
    (d) => mutate(p ? "edit pot" : "add pot", () => {
      const rec = {
        id: p ? p.id : uid(), name: d.name, accountId: d.accountId,
        balance: Number(d.balance) || 0, target: Number(d.target) || 0,
        kind: d.kind, earmark: d.earmark || null, note: d.note || "",
      };
      if (p) state.pots = state.pots.map((x) => (x.id === p.id ? rec : x));
      else state.pots.push(rec);
      toast(p ? "Pot updated" : "Pot created", undoAction());
    }),
    p ? { danger: () => mutate("delete pot", () => {
      state.pots = state.pots.filter((x) => x.id !== id);
      toast("Pot removed", undoAction());
    }) } : {});
}

function allocateModal() {
  const m = metrics();
  const A = m.A;
  const rentMonthly = (A.rentCheque * A.rentChequesPerYear) / 12;
  openModal("Allocate a payday", `
    ${field("amount", "Amount received (AED)", A.salary, "number", "step='0.01' required")}
    ${selectField("accountId", "Into which account", "fab4002",
      state.accounts.map((a) => ({ value: a.id, label: a.name })))}
    <div class="alloc-list">
      ${state.pots.map((p) => `
        <label class="alloc">
          <span>${esc(p.name)}<br><span class="muted" style="font-size:11px">${money(p.balance)} of ${money(p.target)}</span></span>
          <input class="inline-num" type="number" step="0.01" name="pot_${p.id}"
            value="${p.kind === "vault" ? rentMonthly.toFixed(2) : p.kind === "emergency" ? 200 : 0}" />
        </label>`).join("")}
    </div>
    <div class="note">Suggested amounts: the monthly rent accrual into the vault, and the emergency top-up from your
      budget. Whatever is left after allocation is what you can actually spend this month.</div>`,
    (d) => mutate("allocate payday", () => {
      const amount = Number(d.amount) || 0;
      moveBalance(d.accountId, amount);
      let allocated = 0;
      for (const p of state.pots) {
        const v = Number(d["pot_" + p.id]) || 0;
        p.balance = round2(p.balance + v);
        allocated += v;
      }
      state.income.push({
        id: uid(), date: todayISO(), name: "Payday", amount, status: "actual",
        sourceId: "src-salary", note: `Allocated ${money(allocated)} into pots`,
      });
      toast(`Banked ${money(amount)}, ${money(allocated)} into pots`, undoAction());
    }), { submit: "Allocate" });
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
    <div class="note">Return adjustment stresses the whole plan at once: 0 for the base case, −0.03 for a bear case,
      +0.02 for a bull case.</div>`,
    (d) => mutate("change levers", () => {
      A.extraMonthly = Number(d.extraMonthly) || 0;
      A.sipStepUp = Number(d.sipStepUp) || 0;
      A.scenarioAdj = Number(d.scenarioAdj) || 0;
      A.horizonYears = clamp(Math.round(Number(d.horizonYears) || 20), 1, 50);
      toast("Projection updated", undoAction());
    }));
}

function debtPaymentModal(id) {
  const d = state.debtPayments.find((x) => x.id === id);
  if (!d) return;
  if (d.paid) {
    return mutate("unmark debt payment", () => {
      moveBalance(d.paidFrom, d.amount);
      d.paid = false; d.paidFrom = null;
      render();
      toast("Marked unpaid", undoAction());
    });
  }
  openModal(`Pay ${money(d.amount)}`, `
    ${accountSelect("accountId", "Paid from", "fab4001")}
    <div class="note">Settling a debt does not make you richer: the balance falls and so does what you owe, so net
      worth stays exactly where it was. What changes is that the card gets closer to zero.</div>`,
    (f) => mutate("pay debt", () => {
      d.paid = true; d.paidFrom = f.accountId || null;
      moveBalance(f.accountId, -d.amount);
      warnIfPotRaided(f.accountId);
      toast(`Paid — ${money(d.amount)}`, undoAction());
    }), { submit: "Mark paid" });
}

function sipModal(id) {
  const s = state.sips.find((x) => x.id === id);
  if (!s) return;
  openModal("SIP plan", `
    ${selectField("holdingId", "Fund", s.holdingId,
      state.holdings.map((h) => ({ value: h.id, label: h.name })))}
    <div class="grid2">
      ${field("amountNative", `Amount (${s.ccy})`, s.amountNative, "number", "step='any'")}
      ${field("dayOfMonth", "Day of month", s.dayOfMonth, "number", "min='1' max='28'")}
    </div>
    ${selectField("active", "Status", s.active ? "Active" : "Paused", ["Active", "Paused"])}
    ${field("note", "Note", s.note)}
    <div class="note">Pausing a SIP is cheap to reverse; missing a rent cheque is not. But pausing early, while the
      gap might still be closed by earning, gives up compounding for nothing.</div>`,
    (d) => mutate("edit SIP", () => {
      Object.assign(s, {
        holdingId: d.holdingId,
        amountNative: Number(d.amountNative) || 0,
        dayOfMonth: clamp(Number(d.dayOfMonth) || 10, 1, 28),
        active: d.active === "Active", note: d.note,
      });
      toast("SIP updated", undoAction());
    }),
    { danger: () => mutate("delete SIP", () => {
        state.sips = state.sips.filter((x) => x.id !== id);
        toast("SIP removed", undoAction());
      }) });
}

function contributionModal() {
  openModal("Log a contribution", `
    ${selectField("holdingId", "Fund", state.holdings[0].id,
      state.holdings.map((h) => ({ value: h.id, label: h.name })))}
    <div class="grid2">
      ${field("date", "Date", todayISO(), "date", "required")}
      ${field("amountNative", "Amount", "", "number", "step='any' required")}
    </div>
    <div class="grid2">
      ${selectField("ccy", "Currency", "INR", ["INR", "AED", "USD"])}
      ${field("units", "Units bought", "", "number", "step='any'")}
    </div>
    ${field("note", "Note", "", "text", "placeholder='e.g. September SIP'")}
    <div class="note">Logging a contribution adds it to the fund's cost and value, so the return figure stays honest
      rather than treating new money as a gain.</div>`,
    (d) => {
      const amt = Number(d.amountNative) || 0;
      if (!amt) { toast("An amount is required"); return false; }
      mutate("log contribution", () => {
        state.invTx.push({
          id: uid(), date: d.date, holdingId: d.holdingId, type: "buy",
          amountNative: amt, ccy: d.ccy, units: Number(d.units) || 0, note: d.note || "Contribution",
        });
        const h = state.holdings.find((x) => x.id === d.holdingId);
        if (h) {
          h.cost = round2(h.cost + amt);
          h.value = round2(h.value + amt);
          h.units = round2(h.units + (Number(d.units) || 0));
        }
        toast("Contribution logged", undoAction());
      });
    }, { submit: "Log" });
}

function incomeModal(id) {
  const i = id ? state.income.find((x) => x.id === id) : null;
  openModal(i ? "Edit receipt" : "Record income", `
    ${field("name", "What is it", i ? i.name : "", "text", "required")}
    <div class="grid2">
      ${field("amount", "Amount (AED)", i ? i.amount : "", "number", "step='0.01' required")}
      ${field("date", "Date", i ? i.date.slice(0, 10) : todayISO(), "date", "required")}
    </div>
    <div class="grid2">
      ${selectField("sourceId", "Source", i ? i.sourceId : "src-salary",
        state.incomeSources.map((s) => ({ value: s.id, label: s.name })))}
      ${selectField("status", "Status", i ? i.status : "actual", ["actual", "estimate"])}
    </div>
    ${accountSelect("accountId", "Banked into", "")}
    ${field("note", "Note", i ? i.note : "")}
    <div class="note">Mark it <em>estimate</em> until it is on a statement. An estimate appears in the cashflow
      forecast as an event but never as a balance.</div>`,
    (d) => mutate(i ? "edit income" : "record income", () => {
      const amount = Number(d.amount) || 0;
      const rec = { id: i ? i.id : uid(), date: d.date, name: d.name, amount,
                    status: d.status, sourceId: d.sourceId, note: d.note || "" };
      if (i) state.income = state.income.map((x) => (x.id === i.id ? rec : x));
      else state.income.push(rec);
      if (d.accountId && d.status === "actual") moveBalance(d.accountId, amount);
      toast(i ? "Receipt updated" : `Recorded — ${money(amount)}`, undoAction());
    }),
    i ? { danger: () => mutate("delete income", () => {
      state.income = state.income.filter((x) => x.id !== id);
      toast("Receipt deleted", undoAction());
    }) } : {});
}

function sourceModal(id) {
  const s = id ? state.incomeSources.find((x) => x.id === id) : null;
  openModal(s ? s.name : "New income source", `
    ${field("name", "Name", s ? s.name : "", "text", "required")}
    <div class="grid2">
      ${field("expectedMonthly", "Expected monthly (AED)", s ? s.expectedMonthly : 0, "number", "step='0.01'")}
      ${field("dayOfMonth", "Day of month", s ? s.dayOfMonth : 0, "number", "min='0' max='28'")}
    </div>
    <div class="grid2">
      ${selectField("type", "Type", s ? s.type : "Salary", ["Salary", "Side income", "Rental", "Dividend", "Other"])}
      ${selectField("active", "Status", (s ? s.active : true) ? "Active" : "Inactive", ["Active", "Inactive"])}
    </div>
    ${textArea("note", "Note", s ? s.note : "")}
    <div class="note">Set the day to 0 for irregular income. Only sources with an expected amount and a day appear
      in the cashflow forecast — irregular money is real, but a plan that needs it is not a plan.</div>`,
    (d) => mutate(s ? "edit source" : "add source", () => {
      const rec = { id: s ? s.id : uid(), name: d.name, type: d.type,
                    expectedMonthly: Number(d.expectedMonthly) || 0,
                    dayOfMonth: Number(d.dayOfMonth) || 0, ccy: "AED",
                    active: d.active === "Active", note: d.note || "" };
      if (s) state.incomeSources = state.incomeSources.map((x) => (x.id === s.id ? rec : x));
      else state.incomeSources.push(rec);
      toast("Source saved", undoAction());
    }),
    s ? { danger: () => mutate("delete source", () => {
      state.incomeSources = state.incomeSources.filter((x) => x.id !== id);
      toast("Source removed", undoAction());
    }) } : {});
}

function ruleModal(id) {
  const r = id ? state.rules.find((x) => x.id === id) : null;
  openModal(r ? "Edit rule" : "New rule", `
    ${field("match", "When the merchant contains", r ? r.match : "", "text", "required placeholder='enoc'")}
    <div class="grid2">
      ${selectField("category", "Category", r ? r.category : "Groceries", CATEGORIES)}
      ${selectField("split", "Split", r ? r.split : "Personal", ["Personal", "Household", "Excluded"])}
    </div>
    <div class="note">Matching is case-insensitive and looks anywhere in the merchant name. Newer rules win, so you
      can override a built-in one just by adding yours.</div>`,
    (d) => mutate(r ? "edit rule" : "add rule", () => {
      if (r) Object.assign(r, { match: d.match.toLowerCase(), category: d.category, split: d.split });
      else state.rules.push({ id: uid(), match: d.match.toLowerCase(),
                              category: d.category, split: d.split, source: "learned" });
      toast("Rule saved", undoAction());
    }),
    r ? { danger: () => mutate("delete rule", () => {
      state.rules = state.rules.filter((x) => x.id !== id);
      toast("Rule removed", undoAction());
    }) } : {});
}

function obligationModal(id) {
  const o = state.obligations.find((x) => x.id === id);
  if (!o) return;
  openModal(o.name, `
    ${field("name", "Name", o.name)}
    <div class="grid2">
      ${field("amount", "Amount (AED)", o.amount, "number", "step='0.01' required")}
      ${field("due", "Due", o.due, "date", "required")}
    </div>
    <div class="grid2">
      ${selectField("status", "Status", o.status, ["actual", "estimate"])}
      ${selectField("priority", "Priority", o.priority, ["Critical", "Essential", "Wealth", "Optional"])}
    </div>
    ${field("note", "Note", o.note)}`,
    (d) => mutate("edit obligation", () => {
      Object.assign(o, { name: d.name, amount: Number(d.amount) || 0, due: d.due,
                         status: d.status, priority: d.priority, note: d.note });
      toast("Obligation updated", undoAction());
    }),
    { dangerLabel: "Mark paid", danger: () => mutate("mark obligation paid", () => {
      o.paid = true;
      const from = state.pots.find((p) => p.earmark === o.id);
      if (from) {
        const short = spendAgainst(from.accountId, o.amount, o.id);
        toast(short > 0
          ? `${o.name} paid — ${money(short)} came from outside the pot`
          : `${o.name} paid from ${from.name}`, undoAction());
      } else {
        toast(`${o.name} marked paid`, undoAction());
      }
    }) });
}

function dayModal(day) {
  const rows = state.tx.filter((t) => t.date.startsWith(day))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = sum(rows.filter((t) => t.counts), (t) => t.amount);
  openModal(longDate(day), `
    <div class="modal-copy">${dayName(day)} · ${money(total)} counted as spending across ${rows.length} entries</div>
    <div class="modal-rows">${rows.map(txRow).join("") || emptyState("Nothing that day.")}</div>`,
    () => {}, { noSubmit: true, cancel: "Close" });
}


/* A negative free balance means a payment has eaten into money a pot had
   already claimed. That is worth saying out loud rather than leaving as a
   minus sign on a screen nobody scrolled to. */
function warnIfPotRaided(accountId) {
  const a = state.accounts.find((x) => x.id === accountId);
  if (!a) return;
  const held = sum(state.pots.filter((p) => p.accountId === a.id), (p) => p.balance);
  if (a.balance - held < 0) {
    toast(`Careful — ${a.name} is now ${money(held - a.balance)} inside pot money`);
  }
}
