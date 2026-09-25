/* GaragePro — month-end closing, cash-up, receivables aging, payables */
'use strict';

function monthEnd(mk) { const d = new Date(mk + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return toISODate(d); }
function monthLabel(mk) { return new Date(mk + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
function poTotal(o) { return r2((o.items || []).reduce((a, it) => a + num(it.qty) * num(it.cost), 0)); }

function monthData(mk) {
  const start = mk + '-01', end = monthEnd(mk);
  const inM = d => d && d >= start && d <= end;
  const invs = S.invoices.filter(i => !i.void && inM(i.date));
  const sales = invs.reduce((a, i) => { const t = calcDoc(i); for (const k of ['parts', 'labour', 'other', 'discount', 'net', 'vat', 'total', 'cost']) a[k] += t[k]; return a; }, { parts: 0, labour: 0, other: 0, discount: 0, net: 0, vat: 0, total: 0, cost: 0 });
  const exps = S.expenses.filter(e => inM(e.date));
  const expByCat = {}; let expNet = 0, expVat = 0;
  exps.forEach(e => { const n = num(e.amount) - num(e.vat); expByCat[e.category] = (expByCat[e.category] || 0) + n; expNet += n; expVat += num(e.vat); });
  const oth = incomeTotals(start, end);
  const pays = S.payments.filter(p => inM(p.date));
  const methods = {};
  pays.forEach(p => { const m = p.method || 'Other'; (methods[m] = methods[m] || { in: 0, out: 0 }).in += num(p.amount); });
  exps.forEach(e => { const m = e.method || 'Other'; (methods[m] = methods[m] || { in: 0, out: 0 }).out += num(e.amount); });
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
  const payables = S.purchaseOrders.filter(o => o.status === 'Received' && (o.receivedDate || o.date) <= end && !(o.paidDate && o.paidDate <= end));
  const byLine = { auto: 0, mobile: 0 };
  invs.forEach(i => { byLine[lineOf(i)] += calcDoc(i).net; });
  const r = { mk, start, end, invs, sales, exps, expByCat, expNet, expVat, oth, pays, methods, aging, debtors, wip, payables, byLine };
  r.gp = r2(sales.net - sales.cost); r.np = r2(r.gp - expNet + oth.profit); r.collected = r2(pays.reduce((a, p) => a + num(p.amount), 0) + oth.amount);
  r.receivables = r2(aging.reduce((a, b) => a + b, 0)); r.wipValue = r2(wip.reduce((a, j) => a + calcDoc(j).net, 0)); r.payablesValue = r2(payables.reduce((a, o) => a + poTotal(o), 0));
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
        ${line('Total overheads', '− ' + money(r.expNet))}${r.oth.list.length ? Object.entries(r.oth.byCat).map(([k, v]) => line('💰 ' + esc(k), (v < 0 ? '− ' : '+ ') + money(Math.abs(v)), 'small')).join('') + line('Other income (profit)', '+ ' + money(r.oth.profit)) : ''}<div class="tr grand"><span>Net profit</span><span class="${r.np < 0 ? 'red' : ''}">${money(r.np)}</span></div></div></div>
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
        ${line('Supplier bills unpaid (received POs)', money(r.payablesValue))}<div class="small faint">${r.payables.length} PO(s) — mark them paid on the PO page</div>
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
      snapshot: { revenue: r.sales.net, vat: r.sales.vat, cogs: r.sales.cost, grossProfit: r.gp, overheads: r.expNet, netProfit: r.np, collected: r.collected, receivables: r.receivables, invoices: r.invs.length },
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
    { Item: 'Output VAT', Amount: r.sales.vat }, { Item: 'Input VAT', Amount: r.expVat }, { Item: 'Parts COGS', Amount: r.sales.cost }, { Item: 'Gross profit', Amount: r.gp }, { Item: 'Overheads (net of VAT)', Amount: r.expNet }, { Item: 'Net profit', Amount: r.np },
    { Item: 'Other income received', Amount: r.oth.amount }, { Item: 'Other income profit (net of VAT and cost)', Amount: r.oth.profit }, { Item: 'Output VAT on other income', Amount: r.oth.vat }, { Item: 'Collected', Amount: r.collected }, { Item: 'Receivables at month end', Amount: r.receivables }, { Item: 'Work in progress', Amount: r.wipValue }, { Item: 'Supplier payables', Amount: r.payablesValue }]);
  add('Sales invoices', r.invs.map(i => { const s = invoiceState(i); return { Invoice: i.number, Date: i.date, Customer: cn(i.customerId), 'Customer TRN': (get('customers', i.customerId) || {}).trn || '', Plate: (vehicleOf(i) || {}).plate, Net: s.net, VAT: s.vat, Total: s.total, Paid: s.paid, Balance: s.balance }; }));
  add('Payments', r.pays.map(p => ({ Receipt: p.number, Date: p.date, Invoice: (get('invoices', p.invoiceId) || {}).number, Customer: cn(p.customerId), Method: p.method, Amount: num(p.amount), Reference: p.reference })));
  add('Expenses', r.exps.map(e => ({ Date: e.date, Category: e.category, Description: e.description, 'Paid to': e.paidTo, Method: e.method, Net: r2(num(e.amount) - num(e.vat)), VAT: num(e.vat), Total: num(e.amount) })));
  add('Other income', r.oth.list.map(i => ({ Date: i.date, Type: i.category, Description: i.description, 'Received from': i.receivedFrom, Method: i.method, Net: incomeNet(i), VAT: num(i.vat), Total: num(i.amount), Cost: num(i.cost), Profit: incomeProfit(i) })));
  XLSX.writeFile(wb, `GaragePro_${mk}_closing.xlsx`);
}
