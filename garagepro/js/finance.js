/* GaragePro — month-end closing, cash-up, receivables aging, payables */
'use strict';

function monthEnd(mk) { const d = new Date(mk + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return toISODate(d); }
function monthLabel(mk) { return new Date(mk + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
/* ---------- bills bought on credit (v3.7) ----------
   An expense without `payments` was paid in full on its date (as before). An expense with `payments` = a bill:
   `amount` is the full bill (it counts in the P&L on its date), `payments` = what was paid and when, the rest is owed.
   v3.8: received purchase orders are supplier bills too (stock, not expenses), and a payment can be a (post-dated) cheque:
   it settles the bill when given, leaves the bank on the cheque date, and a bounced cheque counts as not paid. */
const payOk = p => p && p.status !== 'Bounced';
const payDate = p => p.chequeDate || p.date;   // when the money actually leaves the account
const expPaid = (e, upTo) => Array.isArray(e.payments) ? r2(e.payments.filter(p => payOk(p) && (!upTo || p.date <= upTo)).reduce((a, p) => a + num(p.amount), 0)) : (!upTo || e.date <= upTo ? num(e.amount) : 0);
const expBalance = (e, upTo) => r2(num(e.amount) - expPaid(e, upTo));
const expState = e => expBalance(e) <= 0.005 ? 'Paid' : expPaid(e) > 0 ? 'Part paid' : 'On credit';
const expSupplierName = e => (e.supplierId && (get('suppliers', e.supplierId) || {}).name) || e.paidTo || '';
const unpaidBills = () => S.expenses.filter(e => expBalance(e) > 0.005);
/* purchase orders: payments, or the older "paid on" date */
const poPays = o => Array.isArray(o.payments) ? o.payments : o.paidDate ? [{ date: o.paidDate, amount: poTotal(o), method: o.paidMethod || '', legacy: true }] : [];
/* every supplier bill (expenses + received POs) in one shape */
function billOf(src, kind) {
  if (kind === 'po') return { kind, src, id: src.id, date: src.receivedDate || src.date, due: src.dueDate || '', amount: poTotal(src), pays: poPays(src), supplierId: src.supplierId || '',
    name: (get('suppliers', src.supplierId) || {}).name || 'Supplier', desc: `Purchase order ${src.number || ''}`, ref: src.ref || src.number || '', method: src.paidMethod || '' };
  return { kind: 'exp', src, id: src.id, date: src.date, due: src.dueDate || '', amount: num(src.amount), supplierId: src.supplierId || '', name: expSupplierName(src) || src.category || '—', desc: src.description || src.category || '', ref: src.reference || '', method: src.method || '',
    pays: Array.isArray(src.payments) ? src.payments : [{ date: src.date, amount: num(src.amount), method: src.method || '', initial: true }] };
}
const allBills = () => [...S.expenses.map(e => billOf(e, 'exp')), ...S.purchaseOrders.filter(o => o.status === 'Received').map(o => billOf(o, 'po'))];
const billPaid = (b, upTo) => r2(b.pays.filter(p => payOk(p) && (!upTo || p.date <= upTo)).reduce((a, p) => a + num(p.amount), 0));
const billBalance = (b, upTo) => r2(b.amount - billPaid(b, upTo));
const openBills = () => allBills().filter(b => billBalance(b) > 0.005);
const owedToSuppliers = () => r2(openBills().reduce((a, b) => a + billBalance(b), 0));
/* add a payment to a bill (expense or purchase order) */
async function addBillPayment(b, pay) {
  pay = { id: uid(), ...pay, amount: r2(num(pay.amount)) };
  if (/cheque/i.test(pay.method || '')) { pay.chequeDate = pay.chequeDate || pay.date; pay.status = 'Pending'; } else { delete pay.chequeNo; delete pay.chequeDate; }
  const o = b.src;
  if (b.kind === 'po') {
    if (!Array.isArray(o.payments)) o.payments = poPays(o).map(p => ({ ...p }));
    o.payments.push(pay);
    const nb = billOf(o, 'po'); o.paidDate = billBalance(nb) <= 0.005 ? pay.date : ''; o.paidMethod = pay.method || o.paidMethod || '';
    await save('purchaseOrders', o);
  } else { o.payments = [...(Array.isArray(o.payments) ? o.payments : []), pay]; await save('expenses', o); }
  return pay;
}
function poTotal(o) { return r2((o.items || []).reduce((a, it) => a + num(it.qty) * num(it.cost), 0)); }

/* opening / setup costs (v3.8.1): the money it took to open the garage (fit-out, lifts, tools, first licence…).
   It is an investment, not a running cost: kept out of monthly profit and shown under "Investment & payback"
   (Reports), where the profit of the running business pays it back. Cash & bank and VAT still count it. */
const isSetup = e => !!(e && e.setup);
const expNetOf = e => num(e.amount) - num(e.vat);
const openingDate = () => S.settings.openingDate || S.expenses.filter(isSetup).map(e => e.date).filter(Boolean).sort()[0] || '';
/* profit of the running business between two dates (sales − parts cost − running expenses + other income profit) */
function runningProfit(from, to) {
  const inR = d => d && d >= from && d <= to;
  const gp = S.invoices.filter(i => !i.void && inR(i.date)).reduce((a, i) => { const c = calcDoc(i); return a + c.net - c.cost; }, 0);
  const exp = S.expenses.filter(e => !isSetup(e) && inR(e.date)).reduce((a, e) => a + expNetOf(e), 0);
  return r2(gp - exp + incomeTotals(from, to).profit);
}
function investmentCardHTML() {
  const setups = S.expenses.filter(isSetup), canEdit = Auth.canPage('expenses');
  if (!setups.length) return canEdit ? `<div class="card card-pad mb small">💼 <b>Opening / setup costs</b> — the money spent to open the garage is an investment, not a monthly cost. Mark those expenses so they stay out of monthly profit and you can see when they are paid back.
    <button class="btn sm" onclick="markSetupCosts()">💼 Mark opening costs</button></div>` : '';
  const m = v => money(v, false), from = openingDate(), t = today();
  const invested = r2(setups.reduce((a, e) => a + expNetOf(e), 0)), vat = r2(setups.reduce((a, e) => a + num(e.vat), 0));
  const earned = from && from <= t ? runningProfit(from, t) : 0, left = r2(Math.max(0, invested - Math.max(0, earned)));   // a loss is shown, but doesn't grow the investment
  const done = invested > 0 ? Math.max(0, Math.min(100, Math.round(earned / invested * 100))) : 0;
  const days = from ? Math.max(1, daysBetween(from, t) + 1) : 1, perMonth = r2(earned / days * 30.44);
  const pace = left <= 0 ? '<span class="green"><b>Paid back</b> — the running business has earned back everything it took to open. 🎉</span>'
    : perMonth > 0 ? `At this pace (${m(perMonth)} profit a month) the rest is paid back in about <b>${Math.ceil(left / perMonth)} month(s)</b>${days < 60 ? ' <span class="muted">(early estimate — gets better with time)</span>' : ''}.`
    : '<span class="amber">The running business is not in profit yet, so nothing is being paid back so far.</span>';
  const byCat = {}; setups.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + expNetOf(e));
  const tr = k => r2(S.transfers.filter(x => x.kind === k).reduce((a, x) => a + num(x.amount), 0)), oIn = tr('ownerIn'), oOut = tr('ownerOut');
  return `<div class="card mb"><div class="card-head"><h3>💼 Investment & payback</h3>${canEdit ? `<div class="actions"><button class="btn sm" onclick="markSetupCosts()">Mark opening costs</button></div>` : ''}</div><div class="card-pad">
    <div class="grid g4 mb"><div class="kpi"><div class="lbl">Invested to open</div><div class="val">${m(invested)}</div><div class="hint">${setups.length} expense(s), net of VAT${vat ? ` · VAT ${m(vat)} claimed back` : ''}</div></div>
      <div class="kpi"><div class="lbl">Profit earned since opening</div><div class="val ${earned < 0 ? 'red' : 'green'}">${m(earned)}</div><div class="hint">${from ? 'since ' + fmtDate(from) : ''}</div></div>
      <div class="kpi"><div class="lbl">Still to recover</div><div class="val ${left > 0 ? 'amber' : 'green'}">${m(left)}</div><div class="hint">${done}% paid back</div></div>
      <div class="kpi"><div class="lbl">Owner money</div><div class="val" style="font-size:19px">${m(r2(oIn - oOut))}</div><div class="hint">put in ${m(oIn)} · taken out ${m(oOut)} (Cash & bank)</div></div></div>
    <div style="height:10px;background:var(--line);border-radius:6px;overflow:hidden" role="img" aria-label="${done}% paid back"><div style="width:${done}%;height:100%;background:var(--green)"></div></div>
    <div class="small mt-s">${pace}</div>
    <div class="small muted mt-s">Opening costs: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${m(v)}`).join(' · ')}. They are kept out of the monthly profit, so each month shows how the garage itself is doing.</div></div></div>`;
}
/* tick, in one go, the expenses that were for opening the garage */
function markSetupCosts() {
  const md = openModal({ title: '💼 Mark opening / setup costs', size: 'wide',
    body: `<p class="small">Tick everything that was spent to <b>open</b> the garage (fit-out, lifts, tools, signboard, first licence, deposit…). Untick normal running costs (e.g. a month's rent or salary once you were open). You can change any expense later with its own tick.</p>
      <div class="field"><label>The garage opened on</label><input type="date" class="inp" id="su_date" value="${esc(S.settings.openingDate || openingDate() || today())}"><div class="help">Expenses up to this date are listed. Profit is counted from this date for the payback.</div></div>
      <div class="row mb"><button class="btn sm" id="su_all">Tick all</button><button class="btn sm" id="su_none">Untick all</button></div><div id="su_list"></div>`,
    foot: '<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>Save</button>' });
  const box = md.el.querySelector('#su_list'), dt = md.el.querySelector('#su_date');
  const draw = () => {
    const d = dt.value || today(), list = S.expenses.filter(e => e.date && (e.date <= d || isSetup(e))).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    box.innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Date</th><th>What</th><th class="num">Amount</th></tr></thead><tbody>${list.map(e => { const lock = isClosedPeriod(e.date);
      return `<tr><td><input type="checkbox" data-id="${e.id}" ${isSetup(e) || (!e.setupSet && e.date <= d) ? 'checked' : ''} ${lock ? 'disabled' : ''}></td><td>${fmtDate(e.date)}</td><td>${esc(e.description || e.category)}<div class="small muted">${esc(e.category)}${lock ? ' · month closed' : ''}</div></td><td class="num">${money(e.amount, false)}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="muted">No expenses on or before this date.</div>';
  };
  dt.onchange = draw; draw();
  md.el.querySelector('#su_all').onclick = () => box.querySelectorAll('input:not(:disabled)').forEach(c => { c.checked = true; });
  md.el.querySelector('#su_none').onclick = () => box.querySelectorAll('input:not(:disabled)').forEach(c => { c.checked = false; });
  md.el.querySelector('[data-c]').onclick = md.close;
  md.el.querySelector('[data-ok]').onclick = async () => {
    let n = 0, total = 0;
    for (const c of box.querySelectorAll('input[data-id]:not(:disabled)')) {
      const e = get('expenses', c.dataset.id); if (!e) continue;
      if (c.checked) total += expNetOf(e);
      if (isSetup(e) === c.checked && e.setupSet) continue;
      e.setup = c.checked; e.setupSet = true; await save('expenses', e); n++;
    }
    S.settings.openingDate = dt.value || ''; await saveSettings();
    md.close(); toast(`Saved — opening costs ${money(r2(total))}${n ? ` (${n} expense(s) updated)` : ''}`, 'ok'); render();
  };
}
function monthData(mk) {
  const start = mk + '-01', end = monthEnd(mk);
  const inM = d => d && d >= start && d <= end;
  const invs = S.invoices.filter(i => !i.void && inM(i.date));
  const sales = invs.reduce((a, i) => { const t = calcDoc(i); for (const k of ['parts', 'labour', 'other', 'discount', 'net', 'vat', 'total', 'cost']) a[k] += t[k]; return a; }, { parts: 0, labour: 0, other: 0, discount: 0, net: 0, vat: 0, total: 0, cost: 0 });
  const allExps = S.expenses.filter(e => inM(e.date)), exps = allExps.filter(e => !isSetup(e)), setupExps = allExps.filter(isSetup);
  const expByCat = {}; let expNet = 0, expVat = 0;
  exps.forEach(e => { const n = expNetOf(e); expByCat[e.category] = (expByCat[e.category] || 0) + n; expNet += n; expVat += num(e.vat); });
  const setupNet = r2(setupExps.reduce((a, e) => a + expNetOf(e), 0)); setupExps.forEach(e => { expVat += num(e.vat); });   // opening costs: not in profit, but their VAT is still input VAT
  const oth = incomeTotals(start, end);
  const pays = S.payments.filter(p => inM(p.date));
  const methods = {};
  pays.forEach(p => { const m = p.method || 'Other'; (methods[m] = methods[m] || { in: 0, out: 0 }).in += num(p.amount); });
  // money out = what was actually paid in the month (a bill bought on credit counts when it is paid; a cheque on its date)
  for (const bl of allBills()) for (const p of bl.pays) {
    if (!payOk(p) || !inM(payDate(p))) continue;
    const m = p.method || (p.initial ? bl.method : '') || 'Other'; (methods[m] = methods[m] || { in: 0, out: 0 }).out += num(p.amount);
  }
  oth.list.forEach(i => { const m = i.method || 'Other'; (methods[m] = methods[m] || { in: 0, out: 0 }).in += num(i.amount); });
  // receivables as at month end
  const aging = [0, 0, 0, 0]; const debtors = {};
  for (const i of S.invoices) {
    if (i.void || !i.date || i.date > end) continue;
    const paid = S.payments.filter(p => p.invoiceId === i.id && p.date <= end).reduce((a, p) => a + num(p.amount), 0);
    const bal = r2(calcDoc(i).total - paid); if (bal <= 0.005) continue;
    const d = daysBetween(i.date, end); aging[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += bal;
    debtors[i.customerId] = (debtors[i.customerId] || 0) + bal;
  }
  // work in progress: jobs opened by month end and not invoiced by month end
  const wip = S.jobs.filter(j => j.status !== 'Cancelled' && j.date <= end && (() => { const inv = jobInvoice(j); return !inv || inv.date > end; })());
  // supplier payables: received POs not paid by month end
  const owed = allBills().filter(b => b.date && b.date <= end && billBalance(b, end) > 0.005);   // supplier bills and POs not paid by month end
  const payables = owed.filter(b => b.kind === 'po'), bills = owed.filter(b => b.kind === 'exp');
  const byLine = { auto: 0, mobile: 0 };
  invs.forEach(i => { byLine[lineOf(i)] += calcDoc(i).net; });
  const r = { mk, start, end, invs, sales, exps, setupExps, setupNet, expByCat, expNet, expVat, oth, pays, methods, aging, debtors, wip, payables, bills, byLine };
  r.gp = r2(sales.net - sales.cost); r.np = r2(r.gp - expNet + oth.profit); r.collected = r2(pays.reduce((a, p) => a + num(p.amount), 0) + oth.amount);
  r.receivables = r2(aging.reduce((a, b) => a + b, 0)); r.wipValue = r2(wip.reduce((a, j) => a + calcDoc(j).net, 0)); r.payablesValue = r2(owed.reduce((a, b) => a + billBalance(b, end), 0));
  r.cashExpected = r2(((methods.Cash || {}).in || 0) - ((methods.Cash || {}).out || 0));
  return r;
}
function closingChecks(r) {
  const c = [];
  const noInv = S.jobs.filter(j => DONE_JOB.includes(j.status) && (j.completed || j.date) <= r.end && !jobInvoice(j));
  c.push({ ok: !noInv.length, t: noInv.length ? `${noInv.length} finished job(s) not invoiced: ${noInv.map(j => j.number).join(', ')}` : 'All finished jobs are invoiced', link: noInv[0] ? `#/job/${noInv[0].id}` : '' });
  const unpaid = r.invs.filter(i => invoiceState(i).balance > 0);
  c.push({ ok: !unpaid.length, warn: true, t: unpaid.length ? `${unpaid.length} invoice(s) from this month still unpaid (${money(unpaid.reduce((a, i) => a + invoiceState(i).balance, 0))})` : 'Every invoice from this month is paid', link: '#/invoices' });
  const cats = new Set(r.exps.map(e => e.category));
  const missing = ['Rent', 'Salaries & Wages', 'Utilities'].filter(k => S.settings.lists.expenseCategory.includes(k) && !cats.has(k));
  c.push({ ok: !missing.length, t: missing.length ? `No ${missing.join(', ')} expense recorded for this month` : 'Rent, salaries & utilities recorded', link: '#/expenses' });
  const neg = stockTable().filter(x => x.onHand < 0);
  c.push({ ok: !neg.length, t: neg.length ? `${neg.length} part(s) with negative stock — receive the purchase order or adjust the stock` : 'No negative stock', link: '#/parts' });
  const oldPO = S.purchaseOrders.filter(o => o.status === 'Ordered' && o.date <= r.end);
  c.push({ ok: !oldPO.length, warn: true, t: oldPO.length ? `${oldPO.length} purchase order(s) ordered but not received` : 'No open purchase orders', link: '#/pos' });
  const draftQ = S.quotes.filter(q => ['Draft', 'Sent'].includes(quoteState(q)) && q.date <= r.end);
  c.push({ ok: !draftQ.length, warn: true, t: draftQ.length ? `${draftQ.length} quotation(s) still waiting — follow up or mark Declined` : 'No quotations waiting', link: '#/quotes' });
  const lb = S.settings.lastBackup;
  c.push({ ok: !!(lb && lb.slice(0, 10) >= r.end), t: lb && lb.slice(0, 10) >= r.end ? `Backup taken ${fmtDate(lb.slice(0, 10))}` : 'Take a backup after the month ends', link: '#/settings' });
  return c;
}

PAGES.closing = () => {
  const def = new Date().getDate() <= 10 ? (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return toISODate(d).slice(0, 7); })() : monthKey(today());
  const mk = getFilter('closing', 'month', def);
  const months = []; for (let i = 0; i < 18; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(toISODate(d).slice(0, 7)); }
  const r = monthData(mk), checks = closingChecks(r);
  const closed = (S.settings.closedMonths || {})[mk];
  const m = v => money(v, false);
  const line = (k, v, cls = '') => `<div class="tr ${cls}"><span>${k}</span><span>${v}</span></div>`;
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
  const counted = closed ? closed.cashCounted : getFilter('closing', 'cash_' + mk, '');
  const diff = counted === '' || counted == null ? null : r2(num(counted) - r.cashExpected);

  view().innerHTML = pageHead(`Month-end closing — ${monthLabel(mk)}`, closed ? `🔒 Closed on ${fmtDate(closed.closedAt.slice(0, 10))} — invoices, payments and expenses dated in this month are locked.` : 'Review the checklist, count the cash, then close the month to lock it.',
    `<select class="inp" onchange="setFilter('closing','month',this.value)">${months.map(x => `<option value="${x}" ${x === mk ? 'selected' : ''}>${monthLabel(x)}${(S.settings.closedMonths || {})[x] ? ' 🔒' : ''}</option>`).join('')}</select>
     <button class="btn" onclick="printView()">🖨 Print closing report</button><button class="btn" onclick="exportMonthExcel('${mk}')">⬇ Excel for accountant</button>
     ${closed ? `<button class="btn danger" onclick="reopenMonth('${mk}')">Reopen month</button>` : `<button class="btn primary" onclick="closeMonth('${mk}')">🔒 Close ${monthLabel(mk)}</button>`}`) +
    `<div class="grid g6 mb">
      <div class="kpi"><div class="lbl">Revenue (net)</div><div class="val">${m(r.sales.net)}</div><div class="hint">${r.invs.length} invoices</div></div>
      <div class="kpi"><div class="lbl">Gross profit</div><div class="val">${m(r.gp)}</div><div class="hint">${pct(r.gp, r.sales.net)} margin</div></div>
      <div class="kpi"><div class="lbl">Overheads</div><div class="val">${m(r.expNet)}</div></div>
      <div class="kpi"><div class="lbl">Net profit</div><div class="val ${r.np < 0 ? 'red' : 'green'}">${m(r.np)}</div><div class="hint">${pct(r.np, r.sales.net)} net margin</div></div>
      <div class="kpi"><div class="lbl">Cash collected</div><div class="val">${m(r.collected)}</div></div>
      <div class="kpi"><div class="lbl">Owed to you (month end)</div><div class="val ${r.receivables > 0 ? 'amber' : ''}">${m(r.receivables)}</div></div></div>
    <div class="grid g3">
      <div class="card"><div class="card-head"><h3>✅ Closing checklist</h3></div>${checks.map(c => `<div class="alert-row"><div class="alert-ico" style="background:${c.ok ? 'var(--greenSoft)' : c.warn ? 'var(--amberSoft)' : 'var(--redSoft)'}">${c.ok ? '✔' : c.warn ? '!' : '✖'}</div><div class="grow">${esc(c.t)}</div>${!c.ok && c.link ? `<button class="btn sm" onclick="go('${c.link}')">Fix</button>` : ''}</div>`).join('')}</div>
      <div class="card"><div class="card-head"><h3>📈 Profit & loss</h3></div><div class="card-pad totals" style="width:100%">
        ${line('🔧 MendTech Auto (workshop)', money(r.byLine.auto), 'small')}${line('🚐 ' + esc(S.settings.brandMobile || 'MendTech Mobile'), money(r.byLine.mobile), 'small')}
        ${line('Parts sales', money(r.sales.parts))}${line('Labour sales', money(r.sales.labour))}${r.sales.other ? line('Other / sublet', money(r.sales.other)) : ''}${line('Discounts given', '− ' + money(r.sales.discount))}
        ${line('<b>Net revenue</b>', '<b>' + money(r.sales.net) + '</b>')}${line('Cost of parts used', '− ' + money(r.sales.cost))}${line('<b>Gross profit</b>', '<b>' + money(r.gp) + '</b>')}
        ${Object.entries(r.expByCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => line(esc(k), '− ' + money(v), 'small')).join('')}
        ${line('Total overheads', '− ' + money(r.expNet))}${r.oth.list.length ? Object.entries(r.oth.byCat).map(([k, v]) => line('💰 ' + esc(k), (v < 0 ? '− ' : '+ ') + money(Math.abs(v)), 'small')).join('') + line('Other income (profit)', '+ ' + money(r.oth.profit)) : ''}<div class="tr grand"><span>Net profit</span><span class="${r.np < 0 ? 'red' : ''}">${money(r.np)}</span></div>
        ${r.setupNet ? `<div class="small muted mt-s">💼 Opening / setup costs this month: <b>${money(r.setupNet)}</b> — an investment, kept out of this profit (see <a onclick="go('#/reports')">Reports → Investment & payback</a>).</div>` : ''}</div></div>
      <div class="card"><div class="card-head"><h3>🧾 VAT for the month</h3></div><div class="card-pad totals" style="width:100%">
        ${line('Taxable sales', money(r.sales.net))}${line('Output VAT (charged)', money(r.sales.vat))}${r.oth.vat ? line('Output VAT (other income)', money(r.oth.vat)) : ''}${line('Input VAT (on expenses)', '− ' + money(r.expVat))}
        <div class="tr grand"><span>VAT payable</span><span>${money(r.sales.vat + r.oth.vat - r.expVat)}</span></div>
        <div class="small faint mt-s">Add up three months for a quarterly FTA return, or use Reports → VAT summary with a date range.</div></div></div>
      <div class="card"><div class="card-head"><h3>💵 Cash & bank by payment method</h3></div>${table([{ h: 'Method', v: ([k]) => esc(k) }, { h: 'Received', cls: 'num', v: ([, x]) => m(x.in) }, { h: 'Paid out', cls: 'num', v: ([, x]) => m(x.out) }, { h: 'Net', cls: 'num', v: ([, x]) => `<b>${m(x.in - x.out)}</b>` }], Object.entries(r.methods), { empty: 'No money movements' })}
        <div class="card-pad"><div class="row"><div class="field grow"><label>Cash counted in drawer at month end</label><input class="inp" type="number" value="${esc(counted ?? '')}" ${closed ? 'disabled' : ''} oninput="(UI.filters.closing=UI.filters.closing||{})['cash_${mk}']=this.value" onchange="render()"></div>
          <div class="field"><label>Expected (cash in − cash out)</label><div class="strong" style="padding:8px 0">${money(r.cashExpected)}</div></div></div>
          ${diff != null ? `<div class="mt-s ${Math.abs(diff) < 0.01 ? 'green' : 'red'} strong">${Math.abs(diff) < 0.01 ? '✔ Cash balances' : `Difference: ${money(diff)} ${diff < 0 ? '(short)' : '(over)'}`}</div>` : ''}</div></div>
      <div class="card"><div class="card-head"><h3>⏳ Receivables aging at ${fmtDate(r.end)}</h3></div><div class="card-pad totals" style="width:100%">
        ${line('0–30 days', money(r.aging[0]))}${line('31–60 days', money(r.aging[1]))}${line('61–90 days', money(r.aging[2]), r.aging[2] ? 'amber' : '')}${line('Over 90 days', money(r.aging[3]), r.aging[3] ? 'red strong' : '')}
        <div class="tr grand"><span>Total owed</span><span>${money(r.receivables)}</span></div></div>
        ${table([{ h: 'Top debtors', v: ([id]) => custLink(get('customers', id)) }, { h: '', cls: 'num', v: ([, v]) => m(v) }], Object.entries(r.debtors).sort((a, b) => b[1] - a[1]).slice(0, 6), { empty: 'Nobody owes you money 🎉' })}</div>
      <div class="card"><div class="card-head"><h3>📦 Balance-sheet items</h3></div><div class="card-pad totals" style="width:100%">
        ${line('Work in progress (not yet invoiced)', money(r.wipValue))}<div class="small faint">${r.wip.length} job(s): ${esc(r.wip.map(j => j.number).slice(0, 8).join(', '))}</div>
        ${line('Owed to suppliers (unpaid bills + received POs)', money(r.payablesValue))}<div class="small faint">${r.bills.length} bill(s) bought on credit${r.payables.length ? ` · ${r.payables.length} purchase order(s)` : ''} — pay them on Expenses or Suppliers</div>
        ${line('Stock value (today, at cost)', money(stockTable().reduce((a, x) => a + x.value, 0)))}</div></div>
    </div>
    ${closed && closed.notes ? `<div class="card card-pad mt"><b>Closing notes:</b> ${esc(closed.notes)}</div>` : ''}`;
};
async function closeMonth(mk) {
  const r = monthData(mk), checks = closingChecks(r);
  const bad = checks.filter(c => !c.ok && !c.warn);
  const m = openModal({
    title: `Close ${monthLabel(mk)}`, size: 'narrow',
    body: `${bad.length ? `<div class="red mb">⚠ ${bad.length} checklist item(s) still need attention:<br>${bad.map(b => '• ' + esc(b.t)).join('<br>')}</div>` : '<div class="green mb">✔ Checklist looks good.</div>'}
      <p>Closing locks every invoice, payment and expense dated in ${monthLabel(mk)}. You can reopen it later if you must correct something.</p>
      <div class="field"><label>Notes (optional)</label><textarea id="cl_notes" placeholder="e.g. Cash deposited to bank on 2nd"></textarea></div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>🔒 Close month</button>`
  });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    const counted = getFilter('closing', 'cash_' + mk, '');
    S.settings.closedMonths = S.settings.closedMonths || {};
    S.settings.closedMonths[mk] = {
      closedAt: new Date().toISOString(), notes: m.el.querySelector('#cl_notes').value, cashCounted: counted,
      snapshot: { revenue: r.sales.net, vat: r.sales.vat, cogs: r.sales.cost, grossProfit: r.gp, overheads: r.expNet, setupCosts: r.setupNet, netProfit: r.np, collected: r.collected, receivables: r.receivables, invoices: r.invs.length },
    };
    await saveSettings(); m.close(); toast(`${monthLabel(mk)} closed and locked`, 'ok'); render();
  };
}
async function reopenMonth(mk) {
  if (!(await confirmBox(`Reopen ${monthLabel(mk)}? Invoices, payments and expenses in that month become editable again.`, 'Reopen', true))) return;
  if (!(await ownerApprove(`Reopen closed month ${monthLabel(mk)}`, { level: 'alert', action: 'reopen_month', target: 'settings' }))) return;
  delete S.settings.closedMonths[mk]; await saveSettings(); render();
}
function guardClosed(iso, what = 'This record') {
  if (isClosedPeriod(iso)) { toast(`${what} is in ${monthLabel(monthKey(iso))}, which is closed. Reopen the month in Month-end closing to change it.`, 'err'); return true; }
  return false;
}
async function exportMonthExcel(mk) {
  try { await loadScript(XLSX_SRC); } catch (e) { return toast(e.message, 'err'); }
  const r = monthData(mk), wb = XLSX.utils.book_new(), cn = id => (get('customers', id) || {}).name || '';
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
  add('Summary', [{ Item: 'Net revenue', Amount: r.sales.net }, { Item: 'Parts sales', Amount: r.sales.parts }, { Item: 'Labour sales', Amount: r.sales.labour }, { Item: 'Other sales', Amount: r.sales.other }, { Item: 'Discounts', Amount: r.sales.discount },
    { Item: 'Output VAT', Amount: r.sales.vat }, { Item: 'Input VAT', Amount: r.expVat }, { Item: 'Parts COGS', Amount: r.sales.cost }, { Item: 'Gross profit', Amount: r.gp }, { Item: 'Overheads (net of VAT)', Amount: r.expNet }, { Item: 'Opening / setup costs (investment, not in profit)', Amount: r.setupNet }, { Item: 'Net profit', Amount: r.np },
    { Item: 'Other income received', Amount: r.oth.amount }, { Item: 'Other income profit (net of VAT and cost)', Amount: r.oth.profit }, { Item: 'Output VAT on other income', Amount: r.oth.vat }, { Item: 'Collected', Amount: r.collected }, { Item: 'Receivables at month end', Amount: r.receivables }, { Item: 'Work in progress', Amount: r.wipValue }, { Item: 'Supplier payables', Amount: r.payablesValue }]);
  add('Sales invoices', r.invs.map(i => { const s = invoiceState(i); return { Invoice: i.number, Date: i.date, Customer: cn(i.customerId), 'Customer TRN': (get('customers', i.customerId) || {}).trn || '', Plate: (vehicleOf(i) || {}).plate, Net: s.net, VAT: s.vat, Total: s.total, Paid: s.paid, Balance: s.balance }; }));
  add('Payments', r.pays.map(p => ({ Receipt: p.number, Date: p.date, Invoice: (get('invoices', p.invoiceId) || {}).number, Customer: cn(p.customerId), Method: p.method, Amount: num(p.amount), Reference: p.reference })));
  add('Expenses', [...r.exps, ...r.setupExps].map(e => ({ Date: e.date, Category: e.category, Description: e.description, 'Paid to': e.paidTo, Method: e.method, Net: r2(num(e.amount) - num(e.vat)), VAT: num(e.vat), Total: num(e.amount), 'Opening / setup cost': isSetup(e) ? 'Yes' : '' })));
  add('Other income', r.oth.list.map(i => ({ Date: i.date, Type: i.category, Description: i.description, 'Received from': i.receivedFrom, Method: i.method, Net: incomeNet(i), VAT: num(i.vat), Total: num(i.amount), Cost: num(i.cost), Profit: incomeProfit(i) })));
  XLSX.writeFile(wb, `GaragePro_${mk}_closing.xlsx`);
}
