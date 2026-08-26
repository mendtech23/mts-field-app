/* ============================================================
   Wealth OS — controller
   Routing, event delegation and boot. All rendering is a full re-render of
   the current page: at this data size it costs nothing and it removes a
   whole class of "the screen disagrees with the state" bugs.
   ============================================================ */
"use strict";

const RENDERERS = {
  home: renderHome, money: renderMoney, budget: renderBudget, invest: renderInvest,
  plan: renderPlan, advisor: renderAdvisor, more: renderMore,
  flow: renderFlow, calendar: renderCalendar, recurring: renderRecurring,
  import: renderImport, income: renderIncome, rules: renderRules, reports: renderReports,
  sips: renderSips, history: renderHistory, debt: renderDebt, accounts: renderAccounts,
  settings: renderSettings, search: renderSearch, help: renderHelp,
  family: renderFamily, rentgap: renderRentGap,
};

function render() {
  const view = RENDERERS[route.view] ? route.view : "home";
  const host = $("#page");
  try {
    host.innerHTML = RENDERERS[view]();
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="card"><div class="note bad">
      Something went wrong rendering this page: ${esc(e.message)}.
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-sm" data-goto="home">Back to home</button></div></div></div>`;
  }
  const m = metrics();
  $("#asOfLabel").textContent = `${money(m.netWorth)} net worth · confirmed to ${longDate(state.asOf)}`;
  $("#undoBtn").hidden = !canUndo();
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.theme === "light" ? "#f4f6f8" : "#071827");
}

/* ------------------------------------------------------------ import --- */
function stageImport(candidates) {
  if (!candidates.length) { toast("Nothing readable in that text"); return; }
  const marked = markDuplicates(candidates);
  state._import = marked.map((c) => ({ ...c, include: !c.duplicate }));
  render();
  const dups = marked.filter((c) => c.duplicate).length;
  toast(`Read ${marked.length} row${marked.length === 1 ? "" : "s"}${dups ? `, ${dups} look like duplicates` : ""}`);
}

function commitImport() {
  const rows = (state._import || []).filter((c) => c.include);
  if (!rows.length) { toast("Nothing ticked"); return; }
  mutate("import transactions", () => {
    for (const c of rows) {
      const acc = state.accounts.find((a) => a.id === c.accountId);
      state.tx.push({
        id: uid(), date: c.date, accountId: c.accountId || null,
        bank: acc ? acc.name.split(" —")[0] : c.bank,
        merchant: c.merchant, amount: c.amount, category: c.category,
        split: c.split, counts: c.counts, balanceAfter: c.balanceAfter ?? null,
        note: c.note, kind: c.kind,
      });
      /* A message that reports a closing balance is a confirmation, and a
         confirmation always wins — so set the balance rather than adjust it. */
      if (acc && c.balanceAfter != null) {
        acc.balance = c.balanceAfter;
        acc.asOf = c.date.slice(0, 10);
        acc.status = "actual";
        if (acc.asOf > state.asOf) state.asOf = acc.asOf;
      } else if (acc && c.counts) {
        moveBalance(acc.id, -c.amount);
      }
    }
    state._import = null;
  });
  render();
  toast(`Imported ${rows.length} transaction${rows.length === 1 ? "" : "s"}`, undoAction());
}

const SAMPLE_SMS = `Purchase of AED 24.50 with Debit Card 4001 at Asas Al Madina General, Dubai on 27-08-2026 19:12. Avl Bal AED 4.20

Purchase of AED 62.00 with Debit Card 3695 at Zomato, Dubai on 27-08-2026 20:40. Avl Bal AED 76.23

AED 450.00 credited to your FAB account 4002 on 27-08-2026. Avl Bal AED 6390.70`;

/* ------------------------------------------------------------ events --- */
document.addEventListener("click", (e) => {
  const t = e.target;
  const near = (sel) => t.closest(sel);

  const tab = near(".tab");
  if (tab) return go(tab.dataset.view);
  const nav = near("[data-goto]");
  if (nav) return go(nav.dataset.goto);

  if (t.id === "addBtn" || t.id === "mAdd") return txModal(null);
  if (t.id === "searchBtn") return go("search");
  if (t.id === "undoBtn") { const l = undo(); render(); return toast(l ? `Undid ${l}` : "Nothing to undo"); }
  if (t.id === "themeBtn") {
    state.theme = state.theme === "light" ? "dark" : "light";
    saveState(); applyTheme(); return render();
  }

  const quick = near("[data-quickadd]");
  if (quick) return txModal(null, {
    merchant: quick.dataset.quickadd, amount: quick.dataset.amount,
    ...classify(quick.dataset.quickadd),
  });

  const rows = [["[data-tx]", "tx", txModal], ["[data-budget]", "budget", budgetModal],
                ["[data-holding]", "holding", holdingModal], ["[data-account]", "account", accountModal],
                ["[data-pot]", "pot", potModal], ["[data-debt]", "debt", debtPaymentModal],
                ["[data-sip]", "sip", sipModal], ["[data-income]", "income", incomeModal],
                ["[data-source]", "source", sourceModal], ["[data-rule]", "rule", ruleModal],
                ["[data-obligation]", "obligation", obligationModal], ["[data-day]", "day", dayModal]];
  for (const [sel, key, fn] of rows) {
    const el = near(sel);
    if (el) return fn(el.dataset[key]);
  }

  if (t.id === "iAdd") {
    return mutate("add holding", () => {
      const h = { id: uid(), name: "New holding", house: "—", cls: "Indian large cap",
                  units: 0, cost: 0, value: 0, nav: 0, ccy: "INR", sip: "Manual", note: "Added by hand" };
      state.holdings.push(h);
      render();
      holdingModal(h.id);
    });
  }
  if (t.id === "potAdd") return potModal(null);
  if (t.id === "acctAdd") {
    return mutate("add account", () => {
      const a = { id: uid(), name: "New account", bank: "—", balance: 0, ccy: "AED",
                  kind: "current", locked: false, asOf: todayISO(), status: "actual", note: "" };
      state.accounts.push(a);
      render();
      accountModal(a.id);
    });
  }
  if (t.id === "allocate") return allocateModal();
  if (t.id === "pLevers") return leversModal();
  if (t.id === "sipAdd") {
    return mutate("add SIP", () => {
      const s = { id: uid(), holdingId: state.holdings[0].id, amountNative: 3000, ccy: "INR",
                  dayOfMonth: 10, active: true, stepUpPct: state.assumptions.sipStepUp, note: "New plan" };
      state.sips.push(s);
      render();
      sipModal(s.id);
    });
  }
  if (t.id === "contribAdd") return contributionModal();
  if (t.id === "incAdd") return incomeModal(null);
  if (t.id === "srcAdd") return sourceModal(null);
  if (t.id === "ruleAdd") return ruleModal(null);
  if (t.id === "snapNow") { recordSnapshot(true); render(); return toast("Snapshot taken"); }
  if (t.id === "printReport") return window.print();

  const dis = near("[data-dismiss]");
  if (dis) {
    const id = dis.dataset.dismiss;
    return mutate("dismiss recommendation", () => {
      state.dismissed = state.dismissed.includes(id)
        ? state.dismissed.filter((x) => x !== id) : state.dismissed.concat(id);
      render();
    });
  }

  const rec = near("[data-recurring]");
  if (rec) {
    const key = rec.dataset.recurring;
    return mutate("toggle recurring", () => {
      const known = state.recurring.find((r) => r.key === key);
      if (known) {
        state.recurring = state.recurring.filter((r) => r.key !== key);
        toast("Removed from the forecast");
      } else {
        const found = detectRecurring().find((r) => r.key === key);
        if (found) {
          state.recurring.push({ ...found, active: true, dismissed: false });
          toast(`${found.merchant} added to the forecast`, undoAction());
        }
      }
      render();
    });
  }

  const fcat = near("[data-filtercat]");
  if (fcat) { state._filter = { ...(state._filter || {}), cat: fcat.dataset.filtercat }; return render(); }

  const fd = near("[data-flowdays]");
  if (fd) { state._flowDays = Number(fd.dataset.flowdays); return render(); }
  const fm = near("[data-flowmode]");
  if (fm) { state._flowMode = fm.dataset.flowmode; return render(); }
  const rm = near("[data-report]");
  if (rm) { state._reportMonth = rm.dataset.report; return render(); }

  if (t.id === "fClear") { state._filter = {}; return render(); }

  if (t.id === "smsParse") {
    const blob = $("#smsBlob").value;
    return stageImport(parsePastedMessages(blob));
  }
  if (t.id === "smsSample") { $("#smsBlob").value = SAMPLE_SMS; return toast("Sample loaded — press Read messages"); }
  if (t.id === "impConfirm") return commitImport();
  if (t.id === "impCancel") { state._import = null; render(); return toast("Discarded"); }

  if (t.id === "expCsv") {
    download(`wealth-os-transactions-${todayISO()}.csv`, exportTransactionsCSV(), "text/csv")
      .then((ok) => { if (ok) toast("Transactions exported"); });
    return;
  }
  if (t.id === "expJson" || t.id === "exportBtn") {
    download(`wealth-os-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json")
      .then((ok) => {
        if (!ok) return;
        state.settings.lastBackup = new Date().toISOString();
        saveState();
        render();
        toast("Backup exported");
      });
    return;
  }
  if (t.id === "importBtn") return $("#importFile").click();
  if (t.id === "resetBtn") {
    return confirmModal("Reset to the workbook",
      "Every figure goes back to the seeded position. Anything you have added here will be lost. "
      + "Export a backup first if you want to keep it.",
      () => {
        snapshotForUndo("reset");
        const fresh = blankState();
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, fresh);
        ensureSeedSnapshot();
        saveState(); applyTheme(); render();
        toast("Reset to the workbook position", undoAction());
      }, "Reset");
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;

  if (t.id === "importFile" && t.files && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = migrate(JSON.parse(fr.result));
        snapshotForUndo("import backup");
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, parsed);
        saveState(); applyTheme(); render();
        toast("Backup imported", undoAction());
      } catch (err) { toast("That file is not a Wealth OS backup"); }
    };
    fr.readAsText(t.files[0]);
    return;
  }
  if (t.id === "csvFile" && t.files && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => stageImport(parseTransactionCSV(fr.result));
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
  if (t.id === "capMode") {
    state.settings.capMode = t.value;
    saveState();
    return render();
  }
  if (t.id === "debtExtra") {
    state._debtExtra = Number(t.value) || 0;
    return render();
  }

  if (t.classList.contains("imp-check")) {
    state._import[Number(t.dataset.i)].include = t.checked;
    return;
  }
  if (t.classList.contains("imp-cat")) {
    state._import[Number(t.dataset.i)].category = t.value;
    return;
  }
  if (t.classList.contains("imp-acc")) {
    state._import[Number(t.dataset.i)].accountId = t.value || null;
    return;
  }

  if (["fq", "fcat", "fsplit", "fmonth"].includes(t.id)) {
    state._filter = {
      q: $("#fq") ? $("#fq").value : "",
      cat: $("#fcat") ? $("#fcat").value : "",
      split: $("#fsplit") ? $("#fsplit").value : "",
      month: $("#fmonth") ? $("#fmonth").value : "",
    };
    render();
  }
});

/* Debounced so a re-render never eats a keystroke mid-word. */
let typeTimer = null;
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id !== "fq" && t.id !== "globalSearch") return;
  clearTimeout(typeTimer);
  const pos = t.selectionStart, id = t.id, value = t.value;
  typeTimer = setTimeout(() => {
    if (id === "fq") state._filter = { ...(state._filter || {}), q: value };
    else state._search = value;
    render();
    const el = $("#" + id);
    if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} }
  }, 240);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeModal();
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
    e.preventDefault();
    const l = undo(); render();
    return toast(l ? `Undid ${l}` : "Nothing to undo");
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); return go("search"); }
  if (e.key.toLowerCase() === "n") { e.preventDefault(); return txModal(null); }
});

window.addEventListener("hashchange", applyRoute);

/* -------------------------------------------------------------- boot --- */
state = loadState();
ensureSeedSnapshot();
recordSnapshot();
applyTheme();
applyRoute();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
