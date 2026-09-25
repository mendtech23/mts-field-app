/* GaragePro — reminders, expenses, reports, settings, backup, Excel import/export */
'use strict';

/* =================== REMINDERS =================== */
function lastMessage(vehicleId, type) {
  return S.messages.filter(m => m.vehicleId === vehicleId && m.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
}
function reminderList(includeDone = false) {
  const out = [];
  const add = r => {
    const lm = r.vehicle ? lastMessage(r.vehicle.id, r.tpl) : null;
    r.reminded = lm && daysBetween(lm.date.slice(0, 10), today()) <= 14 ? lm.date : null;
    if (includeDone || !r.reminded) out.push(r);
  };
  for (const v of S.vehicles) {
    if (v.status && v.status !== 'Active') continue;
    const c = customerOf(v);
    const rd = daysLeft(v.regExpiry);
    if (rd != null && rd <= 30 && rd >= -60) add({ cat: 'Registration', ico: '🪪', bg: 'var(--violetSoft)', sort: rd, vehicle: v, customer: c, tpl: 'regExpiry', date: v.regExpiry, title: `${v.plate} registration ${rd < 0 ? 'expired ' + (-rd) + ' days ago' : 'expires in ' + rd + ' days'}`, sub: `${vehicleLabel(v)} · ${c ? c.name : ''}` });
    const id = daysLeft(v.insExpiry);
    if (id != null && id <= 30 && id >= -60) add({ cat: 'Insurance', ico: '🛡', bg: 'var(--blueSoft)', sort: id, vehicle: v, customer: c, tpl: 'insExpiry', date: v.insExpiry, title: `${v.plate} insurance ${id < 0 ? 'expired ' + (-id) + ' days ago' : 'expires in ' + id + ' days'}`, sub: `${vehicleLabel(v)} · ${c ? c.name : ''}` });
    const due = serviceSchedule(v).filter(x => x.status === 'Overdue' || x.status === 'Due Soon');
    if (due.length) add({ cat: 'Service', ico: '🛠', bg: 'var(--amberSoft)', sort: due.some(d => d.status === 'Overdue') ? -1 : 10, vehicle: v, customer: c, tpl: 'serviceDue', item: due.map(d => d.name).join(', '), title: `${v.plate} service ${due.some(d => d.status === 'Overdue') ? 'overdue' : 'due soon'}: ${due.map(d => d.name).join(', ')}`, sub: `${vehicleLabel(v)} · ${c ? c.name : ''} · ${fmtNum(currentOdo(v))} km` });
  }
  for (const j of S.jobs.filter(j => j.status === 'Ready')) {
    const v = vehicleOf(j), c = customerOf(j);
    add({ cat: 'Collection', ico: '✅', bg: 'var(--greenSoft)', sort: -5, vehicle: v, customer: c, tpl: 'ready', doc: j, kind: 'job', title: `${v ? v.plate : ''} ready for collection (${j.number})`, sub: `${c ? c.name : ''} · ready since ${fmtDate(j.completed || j.date)}` });
  }
  for (const i of S.invoices) {
    if (i.void) continue;
    const s = invoiceState(i);
    if (s.balance <= 0.005 || daysBetween(i.date, today()) < 1) continue;
    const v = vehicleOf(i), c = customerOf(i);
    add({ cat: 'Payment', ico: '💰', bg: 'var(--redSoft)', sort: -daysBetween(i.date, today()), vehicle: v, customer: c, tpl: 'payment', doc: i, kind: 'invoice', title: `${money(s.balance)} outstanding on ${i.number}`, sub: `${c ? c.name : ''} · ${v ? v.plate : ''} · ${daysBetween(i.date, today())} days old${s.status === 'Overdue' ? ' · OVERDUE' : ''}` });
  }
  for (const b of S.bookings) {
    if (b.date !== addDays(today(), 1) || !['Booked', 'Confirmed'].includes(b.status || 'Booked')) continue;
    const { v, c } = bookingParty(b);
    add({ cat: 'Booking', ico: '📅', bg: 'var(--blueSoft)', sort: -8, vehicle: v, customer: c, tpl: 'bookingReminder', bookingId: b.id, title: `Remind ${c.name || ''} about tomorrow ${b.time}`, sub: `${v ? v.plate : b.plate || ''} · ${b.service || ''}` });
  }
  for (const r of S.requests.filter(x => (x.status || 'New') === 'New')) {
    const reqId = r.id;
    out.push({ cat: 'Online request', ico: '📥', bg: 'var(--accentSoft)', sort: -20, requestId: reqId, title: `Online request: ${r.service || ''} — ${r.name || ''}`, sub: `${r.serviceType === 'mobile' ? '🚐 come to me' : '🔧 workshop'} · ${[r.make, r.model].filter(Boolean).join(' ')} · ${r.urgency === 'urgent' ? 'URGENT' : fmtDate(r.date)}` });
  }
  for (const j of S.jobs.filter(x => isMobile(x) && (x.mobile || {}).status === 'New')) {
    out.push({ cat: 'Mobile', ico: '🚐', bg: 'var(--accentSoft)', sort: -15, jobId: j.id, vehicle: vehicleOf(j), customer: customerOf(j), title: `${j.number} not assigned yet — ${(j.mobile || {}).problem || ''}`, sub: `${(customerOf(j) || {}).name || ''} · ${((j.mobile || {}).zone || '').split('(')[0]}` });
  }
  for (const q of S.quotes) {
    if (quoteState(q) !== 'Sent' || daysBetween((q.sentAt || q.date).slice(0, 10), today()) < 2) continue;
    const v = vehicleOf(q), c = customerOf(q);
    add({ cat: 'Quote follow-up', ico: '✎', bg: 'var(--graySoft)', sort: 20, vehicle: v, customer: c, tpl: 'quote', doc: q, kind: 'quote', title: `Follow up quotation ${q.number} (${money(calcDoc(q).total)})`, sub: `${c ? c.name : ''} · ${v ? v.plate : ''} · sent ${fmtDate((q.sentAt || q.date).slice(0, 10))}` });
  }
  if (typeof followUpReminders === 'function') followUpReminders(add);
  return out.sort((a, b) => a.sort - b.sort);
}
function reminderRowHTML(r) {
  const key = REM_CACHE.push(r) - 1;
  return `<div class="alert-row"><div class="alert-ico" style="background:${r.bg}">${r.ico}</div>
    <div class="grow" style="min-width:0"><b>${esc(r.title)}</b><div class="small muted">${esc(r.sub)}</div>${r.reminded ? `<div class="small green">✓ reminded ${fmtDate(r.reminded.slice(0, 10))}</div>` : ''}</div>
    ${r.requestId || r.jobId ? `<button class="btn sm primary" onclick="sendReminder(${key})">Open</button>` : `<button class="btn sm wa" onclick="sendReminder(${key})">WhatsApp</button>${r.vehicle ? `<button class="btn sm ghost" onclick="go('#/vehicle/${r.vehicle.id}')">Open</button>` : ''}`}</div>`;
}
const REM_CACHE = [];
function sendReminder(key) {
  const r = REM_CACHE[key];
  if (r.requestId) return go('#/requests');
  if (r.jobId) return go('#/job/' + r.jobId);
  if (r.bookingId) return sendBookingMsg(r.bookingId, 'bookingReminder');
  if (r.doc) return openSendDialog(r.kind, r.doc);
  openMessageDialog({ vehicle: r.vehicle, customer: r.customer, type: r.tpl, text: fillTemplate(S.settings.templates[r.tpl], { ...baseCtx(r.vehicle, r.customer), date: fmtDate(r.date), item: r.item || '' }) });
}
PAGES.reminders = () => {
  const f = getFilter('reminders', 'cat', 'All'), showDone = getFilter('reminders', 'done', false);
  const all = reminderList(showDone);
  const cats = ['All', 'Online request', 'Mobile', 'Booking', 'Collection', 'Payment', 'Service', 'Registration', 'Insurance', 'Quote follow-up', 'Recommended work', 'Review request'];
  const list = all.filter(r => f === 'All' || r.cat === f);
  view().innerHTML = pageHead('Reminders — who to contact today', 'Built automatically from expiry dates, the service schedule, unpaid invoices and quotes. Anything messaged in the last 14 days is hidden.') +
    `<div class="filters"><div class="seg">${cats.map(k => { const n = all.filter(r => k === 'All' || r.cat === k).length; return `<button class="${f === k ? 'on' : ''}" onclick="setFilter('reminders','cat','${k}')">${k}${n ? ` (${n})` : ''}</button>`; }).join('')}</div>
      <label class="small row"><input type="checkbox" ${showDone ? 'checked' : ''} onchange="setFilter('reminders','done',this.checked)"> include already reminded</label></div>
    <div class="card">${list.length ? list.map(reminderRowHTML).join('') : '<div class="empty"><div class="big">🎉</div>Nothing to chase right now.</div>'}</div>`;
};

/* =================== EXPENSES =================== */
const expenseFields = () => [
  { k: 'date', label: 'Date', type: 'date', req: true, def: today() }, { k: 'category', label: 'Category', type: 'select', options: S.settings.lists.expenseCategory, req: true },
  { k: 'description', label: 'Description', req: true, span: 2 }, { k: 'amount', label: 'Amount (total paid)', type: 'number', req: true },
  { k: 'vat', label: 'VAT included (input VAT)', type: 'number', help: 'For your VAT return — leave 0 if none' },
  { k: 'paidTo', label: 'Paid to' }, { k: 'method', label: 'Payment method', type: 'select', options: S.settings.lists.paymentMethod },
  { k: 'vanId', label: 'For a van? (van costs)', type: 'select', options: () => S.settings.mob.vans.map(v => [v.id, v.name + (v.plate ? ' · ' + v.plate : '')]) },
  { k: 'reference', label: 'Reference / bill no.' }];
function editExpense(id) {
  const e = get('expenses', id);
  openForm({
    title: e ? 'Edit expense' : 'New expense', fields: expenseFields(), data: e || {},
    onSave: async vals => { if ((e && guardClosed(e.date, 'This expense')) || guardClosed(vals.date, 'That date')) return false; await save('expenses', e ? Object.assign(e, vals) : vals); render(); },
    onDelete: e ? async () => { if (guardClosed(e.date, 'This expense')) return false; if (!(await confirmBox('Delete expense?', 'Delete', true))) return false; await remove('expenses', e.id); render(); return true; } : null,
  });
}
PAGES.expenses = () => {
  const m = getFilter('expenses', 'month', monthKey(today()));
  const months = [...new Set([monthKey(today()), ...S.expenses.map(e => monthKey(e.date))])].sort().reverse();
  const list = S.expenses.filter(e => !m || monthKey(e.date) === m).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const byCat = {}; list.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + num(e.amount));
  const total = list.reduce((a, e) => a + num(e.amount), 0);
  view().innerHTML = pageHead('Expenses & overheads', 'Rent, salaries, utilities, tools — everything that isn\'t a part on a job. Feeds the P&L.', `<button class="btn primary" onclick="editExpense()">＋ Add expense</button>`) +
    `<div class="filters"><select class="inp" onchange="setFilter('expenses','month',this.value)"><option value="">All time</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${new Date(x + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="grid g6 mb"><div class="kpi"><div class="lbl">Total</div><div class="val">${money(total, false)}</div></div>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `<div class="kpi"><div class="lbl">${esc(k)}</div><div class="val" style="font-size:19px">${money(v, false)}</div></div>`).join('')}</div>
    <div class="card">${table([{ h: 'Date', v: e => fmtDate(e.date) }, { h: 'Category', v: e => esc(e.category) }, { h: 'Description', v: e => esc(e.description) }, { h: 'Paid to', v: e => esc(e.paidTo || '') },
      { h: 'Method', v: e => esc(e.method || '') }, { h: 'VAT', cls: 'num', v: e => num(e.vat) ? money(e.vat, false) : '' }, { h: 'Amount', cls: 'num', v: e => `<b>${money(e.amount, false)}</b>` }],
      list, { click: e => `editExpense('${e.id}')`, empty: 'No expenses recorded for this period.', foot: [{ v: 'Total' }, {}, {}, {}, {}, { cls: 'num', v: money(list.reduce((a, e) => a + num(e.vat), 0), false) }, { cls: 'num', v: money(total, false) }] })}</div>`;
};

/* =================== REPORTS =================== */
PAGES.reports = () => {
  const years = [...new Set([today().slice(0, 4), ...S.invoices.map(i => (i.date || '').slice(0, 4)), ...S.expenses.map(e => (e.date || '').slice(0, 4))])].filter(Boolean).sort().reverse();
  const y = getFilter('reports', 'year', today().slice(0, 4));
  const rows = [];
  for (let mth = 1; mth <= 12; mth++) {
    const mk = `${y}-${String(mth).padStart(2, '0')}`;
    const invs = S.invoices.filter(i => !i.void && monthKey(i.date) === mk);
    const t = invs.reduce((a, i) => { const c = calcDoc(i); a.net += c.net; a.vat += c.vat; a.cost += c.cost; a.parts += c.parts; a.labour += c.labour; return a; }, { net: 0, vat: 0, cost: 0, parts: 0, labour: 0 });
    const exp = S.expenses.filter(e => monthKey(e.date) === mk).reduce((a, e) => a + num(e.amount) - num(e.vat), 0);
    const oth = incomeTotals(mk + '-01', mk + '-31');
    const col = S.payments.filter(p => monthKey(p.date) === mk).reduce((a, p) => a + num(p.amount), 0);
    const jobs = S.jobs.filter(j => j.status !== 'Cancelled' && monthKey(j.date) === mk).length;
    rows.push({ mk, jobs, invs: invs.length, ...t, gp: t.net - t.cost, exp, oth: oth.profit, othVat: oth.vat, np: t.net - t.cost - exp + oth.profit, col: col + oth.amount });
  }
  const T = rows.reduce((a, r) => { for (const k of ['jobs', 'invs', 'net', 'vat', 'cost', 'parts', 'labour', 'gp', 'exp', 'oth', 'othVat', 'np', 'col']) a[k] = (a[k] || 0) + r[k]; return a; }, {});
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const m = v => money(v, false);

  // VAT period
  const vf = getFilter('reports', 'vfrom', `${y}-01-01`), vt = getFilter('reports', 'vto', today());
  const vInv = S.invoices.filter(i => !i.void && i.date >= vf && i.date <= vt);
  const vOth = incomeTotals(vf, vt);
  const outVat = vInv.reduce((a, i) => a + calcDoc(i).vat, 0) + vOth.vat, sales = vInv.reduce((a, i) => a + calcDoc(i).net, 0) + vOth.net;
  const inVat = S.expenses.filter(e => e.date >= vf && e.date <= vt).reduce((a, e) => a + num(e.vat), 0);

  // top customers & job types (year)
  const yInv = S.invoices.filter(i => !i.void && (i.date || '').startsWith(y));
  const byCust = {}; yInv.forEach(i => byCust[i.customerId] = (byCust[i.customerId] || 0) + calcDoc(i).net);
  const top = Object.entries(byCust).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const byType = {}; S.jobs.filter(j => j.status !== 'Cancelled' && (j.date || '').startsWith(y)).forEach(j => { const k = j.type || 'Other'; byType[k] = byType[k] || { n: 0, v: 0 }; byType[k].n++; byType[k].v += jobTotals(j).net; });

  view().innerHTML = pageHead('Reports & Profit/Loss', 'Revenue is counted from invoices (net of VAT). Expenses exclude their VAT.',
    `<select class="inp" onchange="setFilter('reports','year',this.value)">${years.map(x => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn" onclick="exportExcel()">⬇ Export all data to Excel</button>`) +
    `<div class="grid g6 mb">
      <div class="kpi"><div class="lbl">Revenue ${y}</div><div class="val">${m(T.net)}</div><div class="hint">parts ${m(T.parts)} · labour ${m(T.labour)}</div></div>
      <div class="kpi"><div class="lbl">Gross profit</div><div class="val">${m(T.gp)}</div><div class="hint">margin ${pct(T.gp, T.net)}</div></div>
      <div class="kpi"><div class="lbl">Overheads</div><div class="val">${m(T.exp)}</div>${T.oth ? `<div class="hint">other income + ${m(T.oth)}</div>` : ''}</div>
      <div class="kpi"><div class="lbl">Net profit</div><div class="val ${T.np < 0 ? 'red' : 'green'}">${m(T.np)}</div><div class="hint">net margin ${pct(T.np, T.net)}</div></div>
      <div class="kpi"><div class="lbl">Collected</div><div class="val">${m(T.col)}</div></div>
      <div class="kpi"><div class="lbl">Avg. invoice</div><div class="val">${m(T.invs ? T.net / T.invs : 0)}</div><div class="hint">${T.invs} invoices</div></div></div>
    <div class="card mb"><div class="card-head"><h3>Monthly P&L — ${y}</h3></div>${table([
      { h: 'Month', v: r => new Date(r.mk + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' }) }, { h: 'Jobs', cls: 'num', v: r => r.jobs || '' }, { h: 'Invoices', cls: 'num', v: r => r.invs || '' },
      { h: 'Revenue (net)', cls: 'num', v: r => m(r.net) }, { h: 'VAT collected', cls: 'num', v: r => m(r.vat) }, { h: 'Parts COGS', cls: 'num', v: r => m(r.cost) },
      { h: 'Gross profit', cls: 'num', v: r => m(r.gp) }, { h: 'GP %', cls: 'num', v: r => pct(r.gp, r.net) }, { h: 'Overheads', cls: 'num', v: r => m(r.exp) }, { h: 'Other income', cls: 'num', v: r => r.oth ? m(r.oth) : '' },
      { h: 'Net profit', cls: 'num', v: r => `<b class="${r.np < 0 ? 'red' : ''}">${m(r.np)}</b>` }, { h: 'Collected', cls: 'num', v: r => m(r.col) }], rows,
      { foot: [{ v: 'Total' }, { cls: 'num', v: T.jobs }, { cls: 'num', v: T.invs }, { cls: 'num', v: m(T.net) }, { cls: 'num', v: m(T.vat) }, { cls: 'num', v: m(T.cost) }, { cls: 'num', v: m(T.gp) }, { cls: 'num', v: pct(T.gp, T.net) }, { cls: 'num', v: m(T.exp) }, { cls: 'num', v: T.oth ? m(T.oth) : '' }, { cls: 'num', v: m(T.np) }, { cls: 'num', v: m(T.col) }] })}</div>
    ${lineReportHTML(y)}
    <div class="grid g3">
      <div class="card"><div class="card-head"><h3>VAT summary</h3></div><div class="card-pad">
        <div class="row mb"><input type="date" class="inp" value="${vf}" onchange="setFilter('reports','vfrom',this.value)"> to <input type="date" class="inp" value="${vt}" onchange="setFilter('reports','vto',this.value)"></div>
        <div class="totals" style="width:100%"><div class="tr"><span>Taxable sales</span><span>${money(sales)}</span></div><div class="tr"><span>Output VAT (invoices${vOth.vat ? ' + other income' : ''})</span><span>${money(outVat)}</span></div>
        <div class="tr"><span>Input VAT (expenses)</span><span>− ${money(inVat)}</span></div><div class="tr grand"><span>VAT payable</span><span>${money(outVat - inVat)}</span></div></div>
        <div class="small faint mt-s">Guide figures for your accountant / FTA return. Record input VAT on expenses to include it.</div></div></div>
      <div class="card"><div class="card-head"><h3>Top customers ${y}</h3></div>${table([{ h: 'Customer', v: ([id]) => custLink(get('customers', id)) }, { h: 'Revenue', cls: 'num', v: ([, v]) => m(v) }], top, { empty: 'No sales yet' })}</div>
      <div class="card"><div class="card-head"><h3>Jobs by type ${y}</h3></div>${table([{ h: 'Type', v: ([k]) => esc(k) }, { h: 'Jobs', cls: 'num', v: ([, x]) => x.n }, { h: 'Revenue', cls: 'num', v: ([, x]) => m(x.v) }], Object.entries(byType).sort((a, b) => b[1].v - a[1].v), { empty: 'No jobs yet' })}</div>
    </div>`;
};

/* =================== SETTINGS =================== */
PAGES.settings = () => {
  let tab = getFilter('settings', 'tab', 'garage');
  if ((Auth.active && Auth.role().hideTabs || []).includes(tab)) tab = 'garage';
  const hide = Auth.active && Auth.role().hideTabs || [];
  const tabs = [['garage', 'Garage details'], ['docs', 'Invoices & numbering'], ['lists', 'Lists & service intervals'], ['mobile', '🚐 Mobile & booking'], ['templates', 'Message templates'], ['staff', 'Staff & security'], ['cloud', 'Cloud & devices'], ['data', 'Backup & data']].filter(([k]) => !hide.includes(k));
  const st = S.settings;
  let body = '';
  if (tab === 'mobile') body = mobileSettingsHTML();
  if (tab === 'staff') body = staffSettingsHTML();
  if (tab === 'cloud') body = cloudSettingsHTML();
  if (tab === 'garage') body = `<div class="card card-pad"><div class="grid g4">
      <div class="field span2"><label>Garage / brand name</label><input id="s_garageName" value="${esc(st.garageName)}"></div>
      <div class="field span2"><label>Legal name (as on trade licence / TRN)</label><input id="s_legalName" value="${esc(st.legalName || '')}" placeholder="Printed under the brand name on tax invoices"></div>
      <div class="field spanall"><label>Tagline</label><input id="s_tagline" value="${esc(st.tagline)}"></div>
      <div class="field spanall"><label>Address</label><input id="s_address" value="${esc(st.address)}"></div>
      <div class="field"><label>Phone for calls</label><input id="s_phone" value="${esc(st.phone)}"></div><div class="field"><label>WhatsApp number</label><input id="s_whatsapp" value="${esc(st.whatsapp || '')}"><div class="help">Used on the booking page, QR poster, invoices and all messages</div></div>
      <div class="field"><label>Email</label><input id="s_email" value="${esc(st.email)}"></div><div class="field"><label>Website</label><input id="s_website" value="${esc(st.website)}"></div>
      <div class="field"><label>TRN (VAT registration no.)</label><input id="s_trn" value="${esc(st.trn)}"><div class="help">When filled, invoices are titled “TAX INVOICE”.</div></div>
      <div class="field"><label>VAT rate %</label><input id="s_vatRate" type="number" value="${esc(st.vatRate)}"></div>
      <div class="field"><label>Currency</label><input id="s_currency" value="${esc(st.currency)}"></div>
      <div class="field"><label>Default labour rate / hour</label><input id="s_labourRate" type="number" value="${esc(st.labourRate)}"></div>
      <div class="field"><label>Country dialling code</label><input id="s_countryCode" value="${esc(st.countryCode)}"><div class="help">971 = UAE. Used to turn 050… into WhatsApp numbers.</div></div>
      <div class="field span2"><label>Logo</label><div class="row">${st.logo ? `<img src="${st.logo}" style="height:54px;border:1px solid var(--line);border-radius:6px;padding:3px;background:#fff">` : '<span class="faint">No logo</span>'}
        <input type="file" accept="image/*" onchange="uploadLogo(this.files[0])">${st.logo ? '<button class="btn sm danger" onclick="S.settings.logo=\'\';saveSettings().then(render)">Remove</button>' : ''}</div></div>
      <div class="fieldset-title">💳 Payments — shared with customers in WhatsApp, email, SMS and on invoices</div>
      <div class="field spanall"><label>Stripe payment link</label><input id="s_payStripeLink" value="${esc(st.payStripeLink || '')}" placeholder="https://buy.stripe.com/…">
        <div class="help">In Stripe: Payment Links → New → choose “Customers choose what to pay” → copy the link here. One link works for every invoice; the message tells the customer the amount.</div></div>
      <div class="field span2"><label>WIO account name</label><input id="s_wioName" value="${esc(st.wioName || '')}" placeholder="MendTech Auto …"></div>
      <div class="field"><label>Bank</label><input id="s_wioBank" value="${esc(st.wioBank || 'Wio Bank')}"></div>
      <div class="field"><label>IBAN</label><input id="s_wioIban" value="${esc(st.wioIban || '')}" placeholder="AE.."></div>
      <div class="field spanall"><label>WIO payment link (optional)</label><input id="s_wioLink" value="${esc(st.wioLink || '')}" placeholder="If you use WIO payment links"></div>
      <div class="field spanall"><label>…or simply paste your WIO bank details here (as copied from the WIO app)</label><textarea id="s_bankDetails" placeholder="Account name, account number, IBAN, SWIFT…">${esc(pastedBankDetails() ? st.bankDetails : '')}</textarea>
        <div class="help">Whatever you paste here prints on every invoice and goes into invoice / payment messages. You don't need to fill both this box and the IBAN fields above.</div></div>
      <div class="spanall small muted">Preview of what customers receive:<pre class="mono" style="white-space:pre-wrap;background:var(--panel2);padding:10px;border-radius:8px;margin:6px 0 0" data-noicon>${esc(payInfoText({ number: 'INV-0001' }, S.settings.currency + ' 525.00') || '— add a Stripe link or WIO IBAN above —')}</pre></div>
    </div><div class="row end mt"><button class="btn primary" onclick="saveSettingsForm(['garageName','legalName','tagline','address','phone','whatsapp','email','website','trn','vatRate','currency','labourRate','countryCode','bankDetails','payStripeLink','wioName','wioBank','wioIban','wioLink'])">Save</button></div></div>`;
  if (tab === 'docs') body = `<div class="card card-pad"><div class="grid g4">
      <div class="field"><label>Quote valid for (days)</label><input id="s_quoteValidDays" type="number" value="${esc(st.quoteValidDays)}"></div>
      <div class="field"><label>Invoice due in (days)</label><input id="s_invoiceDueDays" type="number" value="${esc(st.invoiceDueDays)}"><div class="help">0 = due on receipt</div></div>
      <div class="field spanall"><label>Quotation terms — one per line, numbered automatically. {validDays} = the quote validity above</label><textarea id="s_quoteTerms" style="min-height:96px">${esc(st.quoteTerms)}</textarea></div>
      <div class="field spanall"><label>Invoice terms / warranty (one per line)</label><textarea id="s_invoiceTerms">${esc(st.invoiceTerms)}</textarea></div>
      <div class="field spanall"><label>Document footer (bottom right of every quotation, invoice and job card)</label><input id="s_docFooter" value="${esc(st.docFooter || '')}" placeholder="Workshop 08:00–20:00 · Mobile 24/7 · Sharjah"></div>
      <div class="fieldset-title">Document numbering — prefix and last number used</div>
      ${Object.keys(st.prefixes).map(k => `<div class="field"><label>${esc(k)}</label><div class="row" style="flex-wrap:nowrap"><input id="p_${k}" value="${esc(st.prefixes[k])}" style="width:80px"><input id="c_${k}" type="number" value="${esc(st.counters[k] || 0)}" title="Last number used"></div></div>`).join('')}
    </div><div class="row end mt"><button class="btn primary" onclick="saveDocSettings()">Save</button></div></div>` + offersSettingsHTML() + brandStationeryHTML();
  if (tab === 'lists') body = `<div class="card card-pad"><p class="muted" style="margin-top:0">One entry per line.</p><div class="grid g3">
      ${Object.entries(st.lists).map(([k, arr]) => `<div class="field"><label>${esc(LIST_LABELS[k] || k)}</label><textarea id="l_${k}" style="min-height:150px">${esc(arr.join('\n'))}</textarea></div>`).join('')}
      <div class="field spanall"><label>Service items & intervals — format: <code>Name | km | months</code> (0 = not used)</label><textarea id="l_service" style="min-height:220px" class="mono">${esc(st.serviceItems.map(s => `${s.name} | ${s.km} | ${s.months}`).join('\n'))}</textarea></div>
      <div class="field spanall"><label>Inspection checklist — format: <code>Category | Check point</code></label><textarea id="l_insp" style="min-height:220px" class="mono">${esc(st.inspectionTemplate.map(([a, b]) => `${a} | ${b}`).join('\n'))}</textarea></div>
    </div><div class="row end mt"><button class="btn primary" onclick="saveListSettings()">Save</button></div></div>`;
  if (tab === 'templates') body = `<div class="card card-pad"><p class="muted" style="margin-top:0">Placeholders: <code>{customer} {plate} {vehicle} {vin} {odometer} {number} {amount} {paid} {balance} {validUntil} {approveLine} {items} {status} {item} {date} {time} {address} {method} {receipt} {garage} {garagePhone} {bank}</code></p>
      <div class="grid g2">${Object.entries(st.templates).map(([k, t]) => `<div class="field"><label>${esc(TEMPLATE_LABELS[k] || k)}</label><textarea id="t_${k}" style="min-height:170px">${esc(t)}</textarea></div>`).join('')}</div>
      <div class="row end mt"><button class="btn" onclick="resetTemplates()">Reset to defaults</button><button class="btn primary" onclick="saveTemplateSettings()">Save</button></div></div>`;
  if (tab === 'data') {
    const counts = COLLECTIONS.map(c => `${c}: ${S[c].length}`).join(' · ');
    body = `<div class="grid g2">
      <div class="card card-pad"><h3>💾 Backup</h3><p class="muted">Your data lives in this browser on this computer. <b>Download a backup file regularly</b> (weekly at least) and keep a copy on a USB / Google Drive. Backups are locked with a password you choose. ${st.lastBackup ? 'Last backup: ' + fmtDate(st.lastBackup) : '<span class="red">No backup taken yet.</span>'}</p>
        <div class="row"><button class="btn primary" onclick="downloadBackup()">⬇ Download backup</button><label class="btn">⬆ Restore from backup<input type="file" accept=".json" hidden onchange="restoreBackup(this.files[0]);this.value=''"></label></div>
        <p class="small faint">${counts}</p></div>
      <div class="card card-pad"><h3>📊 Excel</h3><p class="muted">Export everything to an Excel workbook, or import customers, vehicles, parts, labour, suppliers and technicians from your <b>Auto_Garage_Management_System.xlsx</b> template.</p>
        <div class="row"><button class="btn" onclick="exportExcel()">⬇ Export to Excel</button><label class="btn">⬆ Import from Excel template<input type="file" accept=".xlsx,.xls" hidden onchange="importExcel(this.files[0])"></label></div>
        <p class="small faint">Works offline.</p></div>
      <div class="card card-pad"><h3>🧪 Demo example (for training)</h3><p class="muted">One complete example car — <b>DEMO 12345</b> — with a past visit, a job in progress, inspection advisories, a quotation, a booking and a payment. ${S.demoLoaded ? '<b class="green">Demo is loaded.</b>' : ''}</p>
        <div class="row"><button class="btn" onclick="resetToOneDemo()">Keep only 1 demo (clear everything else)</button>${S.demoLoaded ? '<button class="btn danger" onclick="removeDemoData()">Remove demo — go live</button>' : '<button class="btn" onclick="loadDemoData()">Load demo example</button>'}</div></div>
      <div class="card card-pad" style="border-color:#fecaca"><h3 class="red">⚠ Erase all data</h3><p class="muted">Deletes every record from this computer. Download a backup first.</p><button class="btn danger" onclick="eraseAll()">Erase everything…</button></div></div>`;
  }
  view().innerHTML = pageHead('Settings & Backup') + `<div class="tabs">${tabs.map(([k, l]) => `<div class="tab ${tab === k ? 'active' : ''}" onclick="setFilter('settings','tab','${k}')">${l}</div>`).join('')}</div>${body}`;
  if (tab === 'staff') checkSecurityHeaders();
};
Object.assign(TEMPLATE_LABELS, { booking: 'Booking confirmation', bookingReminder: 'Booking reminder (day before)', mobileReceived: 'Mobile — request received', mobileOnWay: 'Mobile — on the way', mobileArrived: 'Mobile — arrived', mobileCompleted: 'Mobile — completed + payment', needsWorkshop: 'Mobile — needs workshop', requestDeclined: 'Online request declined' });
const LIST_LABELS = { incomeCategory: 'Other income types', jobType: 'Job types', fuel: 'Fuel types', transmission: 'Transmissions', drive: 'Drive types', emirate: 'Emirates / regions', customerType: 'Customer types', paymentMethod: 'Payment methods', partCategory: 'Part categories', expenseCategory: 'Expense categories', trade: 'Technician trades' };
const PAY_KEYS = { bankDetails: 'pasted bank details', payStripeLink: 'Stripe payment link', wioName: 'WIO account name', wioBank: 'bank name', wioIban: 'IBAN', wioLink: 'WIO payment link' };
async function saveSettingsForm(keys) {
  const vals = {};
  for (const k of keys) { const el = $('#s_' + k); if (el) vals[k] = el.type === 'number' ? num(el.value) : el.value.trim(); }
  // where customers send money: always needs the Owner PIN, even when the Owner is signed in
  const payChanged = Object.keys(vals).filter(k => PAY_KEYS[k] && String(vals[k] ?? '') !== String((k === 'bankDetails' ? pastedBankDetails() : S.settings[k]) ?? ''));
  if (payChanged.length && !(await ownerApprove(`Change payment details: ${payChanged.map(k => PAY_KEYS[k]).join(', ')}`, { always: true, level: 'alert', action: 'bank_details', target: 'settings' }))) return toast('Nothing saved — payment details need the Owner PIN', 'err');
  Object.assign(S.settings, vals);
  await saveSettings(); toast('Settings saved', 'ok'); render();
}
async function saveDocSettings() {
  const st = S.settings;
  st.quoteValidDays = num($('#s_quoteValidDays').value); st.invoiceDueDays = num($('#s_invoiceDueDays').value);
  st.quoteTerms = $('#s_quoteTerms').value; st.invoiceTerms = $('#s_invoiceTerms').value; st.docFooter = $('#s_docFooter').value.trim();
  for (const k of Object.keys(st.prefixes)) { st.prefixes[k] = $('#p_' + k).value; st.counters[k] = num($('#c_' + k).value); }
  await saveSettings(); toast('Saved', 'ok');
}
async function saveListSettings() {
  const st = S.settings;
  for (const k of Object.keys(st.lists)) st.lists[k] = $('#l_' + k).value.split('\n').map(s => s.trim()).filter(Boolean);
  st.serviceItems = $('#l_service').value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0]).map(([name, km, months]) => ({ name, km: num(km), months: num(months) }));
  st.inspectionTemplate = $('#l_insp').value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0] && a[1]);
  await saveSettings(); toast('Saved', 'ok'); render();
}
async function saveTemplateSettings() { for (const k of Object.keys(S.settings.templates)) S.settings.templates[k] = $('#t_' + k).value; await saveSettings(); toast('Templates saved', 'ok'); }
async function resetTemplates() { if (!(await confirmBox('Reset all message templates to the defaults?'))) return; S.settings.templates = structuredClone(DEFAULT_SETTINGS.templates); await saveSettings(); render(); }
function uploadLogo(file) {
  if (!file) return;
  const img = new Image();
  img.onload = async () => {
    const scale = Math.min(1, 400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    S.settings.logo = c.toDataURL('image/png');
    await saveSettings(); toast('Logo saved', 'ok'); render();
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
}

/* ---------- backup / restore ---------- */
async function downloadBackup() {
  const pw = await askPassword({
    title: 'Protect this backup with a password', confirm: true, okLabel: 'Download backup',
    text: 'The backup holds every customer, phone number, invoice and your bank details. It is locked with this password — <b>without it the file cannot be opened, not even by us</b>. Write it down and keep it away from the backup file.',
  });
  if (!pw) return;
  toast('Preparing backup…');
  const data = { app: 'GaragePro', version: APP_VERSION, exportedAt: new Date().toISOString(), settings: S.settings };
  COLLECTIONS.forEach(c => data[c] = S[c]);
  data.photos = await DB.all('photos');
  S.settings.lastBackup = new Date().toISOString(); S.settings.lastBackupEncrypted = true;
  data.settings = S.settings;
  const file = await encryptBackup(data, pw);
  await saveSettings();
  downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), `GaragePro_backup_${today()}.json`);
  secLog('backup', 'Password-protected backup downloaded', 'info');
  toast('Backup downloaded — keep it somewhere safe', 'ok'); render();
}
async function restoreBackup(file) {
  if (!file) return;
  try {
    let data = JSON.parse(await file.text());
    if (data.app !== 'GaragePro') throw new Error('This is not a GaragePro backup file');
    if (!(await confirmBox(`Restore backup from ${fmtDate((data.exportedAt || '').slice(0, 10))}?\n\nThis REPLACES all current data on this computer.`, 'Replace & restore', true))) return;
    if (!(await ownerApprove(`Restore backup from ${fmtDate((data.exportedAt || '').slice(0, 10))} (replaces all data)`, { always: true, level: 'alert' }))) return;
    if (data.format === 'encrypted') {
      const pw = await askPassword({ title: 'Backup password', text: 'This backup is password-protected. Enter the password used when it was downloaded.', okLabel: 'Unlock & restore' });
      if (!pw) return;
      data = await decryptBackup(data, pw);
    }
    for (const c of COLLECTIONS) { if (c === 'secLog') continue; await DB.clear(c); S[c] = data[c] || []; if (S[c].length) await DB.putMany(c, S[c]); }   // the security log is kept, not replaced
    await DB.clear('photos'); if ((data.photos || []).length) await DB.putMany('photos', data.photos);
    S.settings = mergeDeep(structuredClone(DEFAULT_SETTINGS), data.settings || {}); await saveSettings();
    const syncMeta = (await DB.all('meta')).find(x => x.id === 'sync'); if (syncMeta) { syncMeta.lastPush = ''; await DB.put('meta', syncMeta); }   // upload the restored data again
    await migrateSettings();
    secLog('restore', `Backup from ${fmtDate((data.exportedAt || '').slice(0, 10))} restored — all data replaced`, 'alert');
    toast('Backup restored', 'ok'); go('#/dashboard'); if (typeof Sync !== 'undefined') Sync.markDirty();
  } catch (e) { toast('Restore failed: ' + e.message, 'err'); }
}
async function eraseAll() {
  const m = openModal({
    title: 'Erase all data', size: 'narrow', body: `<p>Type <b>ERASE</b> to delete all customers, vehicles, jobs, invoices and stock ${Sync.user ? '<b>on every synced device and in the cloud</b>' : 'from this computer'}. Settings and staff logins are kept. Download a backup first.</p><input class="inp" id="er_c">`,
    foot: `<button class="btn" data-close2>Cancel</button><button class="btn danger" data-go>Erase everything</button>`
  });
  m.el.querySelector('[data-close2]').onclick = m.close;
  m.el.querySelector('[data-go]').onclick = async () => {
    if (m.el.querySelector('#er_c').value !== 'ERASE') return toast('Type ERASE to confirm', 'err');
    if (!(await ownerApprove('Erase all data', { always: true, level: 'alert' }))) return;
    await wipeCollections(COLLECTIONS.filter(c => c !== 'staff' && c !== 'secLog'));
    secLog('erase', 'All data erased', 'alert');
    Object.keys(S.settings.counters).forEach(k => S.settings.counters[k] = 0); await saveSettings();
    m.close(); toast('All data erased'); go('#/dashboard');
  };
}

/* ---------- Excel ---------- */
const XLSX_SRC = 'lib/xlsx.full.min.js';   // bundled — works offline
async function exportExcel() {
  try { await loadScript(XLSX_SRC); } catch (e) { return toast(e.message, 'err'); }
  const wb = XLSX.utils.book_new();
  const cn = id => (get('customers', id) || {}).name || '', vp = id => (get('vehicles', id) || {}).plate || '';
  const sheets = {
    Customers: S.customers.map(c => ({ Code: c.code, Name: c.name, Type: c.type, Mobile: c.phone, WhatsApp: c.whatsapp, Email: c.email, Address: c.address, TRN: c.trn, Balance: customerBalance(c.id) })),
    Vehicles: S.vehicles.map(v => ({ Code: v.code, Plate: v.plate, Emirate: v.emirate, Make: v.make, Model: v.model, Year: v.year, Colour: v.color, VIN: v.vin, Owner: cn(v.customerId), Odometer: currentOdo(v), 'Reg expiry': v.regExpiry, 'Ins expiry': v.insExpiry, Status: v.status })),
    Quotations: S.quotes.map(q => { const t = calcDoc(q); return { No: q.number, Date: q.date, Plate: vp(q.vehicleId), Customer: cn(q.customerId), Net: t.net, VAT: t.vat, Total: t.total, Status: quoteState(q) }; }),
    'Job Cards': S.jobs.map(j => { const t = jobTotals(j); return { No: j.number, Date: j.date, Plate: vp(j.vehicleId), Customer: cn(j.customerId), Odometer: j.odometer, Type: j.type, Technician: techName(j.technicianId), Status: j.status, Complaint: j.complaint, 'Work done': j.diagnosis, Total: t.total }; }),
    Invoices: S.invoices.map(i => { const s = invoiceState(i); return { No: i.number, Date: i.date, Plate: vp(i.vehicleId), Customer: cn(i.customerId), Parts: s.parts, Labour: s.labour, Discount: s.discount, Net: s.net, VAT: s.vat, Total: s.total, Paid: s.paid, Balance: s.balance, Status: s.status, COGS: s.cost }; }),
    'Invoice Lines': S.invoices.flatMap(i => (i.items || []).map(it => ({ Invoice: i.number, Date: i.date, Plate: vp(i.vehicleId), Type: it.type, Description: it.desc, 'Part no': it.partNo, Qty: num(it.qty), Rate: num(it.rate), Amount: lineTotal(it), 'Service item': it.serviceItem }))),
    Payments: S.payments.map(p => ({ Receipt: p.number, Date: p.date, Invoice: (get('invoices', p.invoiceId) || {}).number, Customer: cn(p.customerId), Amount: num(p.amount), Method: p.method, Reference: p.reference })),
    Stock: stockTable().map(r => ({ Code: r.p.code, Part: r.p.name, 'Part no': r.p.partNumber, Category: r.p.category, 'On hand': r.onHand, Cost: num(r.p.cost), Price: num(r.p.price), Value: r.value, 'Reorder level': num(r.p.reorderLevel), Bin: r.p.bin })),
    'Other income': S.incomes.map(i => ({ Date: i.date, Type: i.category, Description: i.description, Amount: num(i.amount), VAT: num(i.vat), Cost: num(i.cost), Profit: incomeProfit(i), 'Received from': i.receivedFrom, Method: i.method, Reference: i.reference })),
    Expenses: S.expenses.map(e => ({ Date: e.date, Category: e.category, Description: e.description, Amount: num(e.amount), VAT: num(e.vat), 'Paid to': e.paidTo, Method: e.method })),
  };
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
  XLSX.writeFile(wb, `GaragePro_export_${today()}.xlsx`);
}
function xlDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return toISODate(v);
  if (typeof v === 'number') return toISODate(new Date(Math.round((v - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000));
  const d = new Date(v); return isNaN(d) ? '' : toISODate(d);
}
function sheetRows(wb, sheetName, keyHeader) {
  const ws = wb.Sheets[sheetName]; if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const hi = rows.findIndex(r => r.includes(keyHeader)); if (hi < 0) return [];
  const H = rows[hi].map(h => String(h).trim());
  return rows.slice(hi + 1).filter(r => String(r[0] || '').trim()).map(r => Object.fromEntries(H.map((h, i) => [h, r[i]])));
}
async function importExcel(file) {
  if (!file) return;
  try { await loadScript(XLSX_SRC); } catch (e) { return toast(e.message, 'err'); }
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sup = sheetRows(wb, 'Suppliers', 'Supplier ID'), tech = sheetRows(wb, 'Technicians', 'Tech ID'), cust = sheetRows(wb, 'Customers', 'Customer ID'),
      veh = sheetRows(wb, 'Vehicles', 'Vehicle ID'), parts = sheetRows(wb, 'Parts Inventory', 'Part ID'), lab = sheetRows(wb, 'Labour Catalogue', 'Op Code');
    const total = sup.length + tech.length + cust.length + veh.length + parts.length + lab.length;
    if (!total) throw new Error('No recognisable sheets found (expected the Auto Garage template)');
    if (!(await confirmBox(`Found in ${file.name}:\n• ${cust.length} customers\n• ${veh.length} vehicles\n• ${parts.length} parts\n• ${lab.length} labour operations\n• ${sup.length} suppliers\n• ${tech.length} technicians\n\nRecords whose plate / name already exists will be skipped. Import now?`, 'Import'))) return;
    const map = {}; let added = 0;
    for (const r of sup) { if (S.suppliers.some(s => s.name === r['Supplier Name'])) continue; const s = await save('suppliers', { code: r['Supplier ID'], name: r['Supplier Name'], contact: r['Contact Person'], phone: String(r['Phone'] || ''), email: r['Email'], category: r['Category / Speciality'], terms: r['Payment Terms'] }); map[r['Supplier ID']] = s.id; added++; }
    for (const r of tech) { if (!r['Technician Name'] || S.technicians.some(t => t.name === r['Technician Name'])) continue; await save('technicians', { code: r['Tech ID'], name: r['Technician Name'], trade: r['Trade / Speciality'], phone: String(r['Phone'] || ''), costRate: num(r['Cost to Garage (AED/hr)']), active: true }); added++; }
    for (const r of cust) {
      if (!r['Customer Name']) continue;
      const ex = S.customers.find(c => c.name === r['Customer Name']);
      if (ex) { map[r['Customer ID']] = ex.id; continue; }
      const c = await save('customers', { code: r['Customer ID'], name: r['Customer Name'], type: r['Type'] || 'Individual', phone: String(r['Phone'] || ''), email: r['Email'], address: r['Area / Address'], trn: String(r['TRN'] || '') }); map[r['Customer ID']] = c.id; added++;
    }
    for (const r of veh) {
      const plate = String(r['Plate No.'] || '').toUpperCase(); if (!plate || S.vehicles.some(v => v.plateNorm === norm(plate))) continue;
      await save('vehicles', {
        code: r['Vehicle ID'], customerId: map[r['Customer ID']] || '', plate, plateNorm: norm(plate), emirate: r['Emirate'], make: r['Make'], model: r['Model'], year: r['Year'], vin: String(r['VIN / Chassis No.'] || '').toUpperCase(), vinNorm: norm(r['VIN / Chassis No.']),
        engineNo: r['Engine No.'], fuel: r['Fuel Type'], transmission: r['Transmission'], engineSize: r['Engine Size (L)'], drive: r['Drive Type'], oilGrade: r['Engine Oil Grade'], oilCapacity: r['Oil Capacity (L)'], tyreSize: r['Tyre Size'], battery: r['Battery Type'],
        odometer: num(r['CURRENT ODOMETER (km)'] || r['Odometer - Last Entered (km)']), regExpiry: xlDate(r['Registration Expiry']), insExpiry: xlDate(r['Insurance Expiry']), status: ['Active', 'Inactive', 'Sold'].includes(r['Status']) ? r['Status'] : 'Active', notes: r['Notes'],
      }); added++;
    }
    for (const r of parts) {
      if (!r['Part Name'] || S.parts.some(p => p.name === r['Part Name'])) continue;
      await save('parts', { code: r['Part ID'], name: r['Part Name'], category: r['Category'], partNumber: String(r['Part Number (OEM)'] || ''), fits: r['Fits / Application'], unit: r['Unit'] || 'pcs', openingStock: num(r['On Hand'] !== '' && r['On Hand'] != null ? r['On Hand'] : r['Opening Stock']), cost: num(r['Unit Cost (AED)']), price: num(r['Selling Price (AED)']), reorderLevel: num(r['Reorder Level']), supplierId: map[r['Supplier ID']] || '', bin: r['Bin / Location'] }); added++;
    }
    for (const r of lab) {
      if (!r['Operation'] || S.labour.some(l => l.name === r['Operation'])) continue;
      const si = r['Service Item Covered'] || '';
      if (si && !S.settings.serviceItems.some(s => s.name === si)) S.settings.serviceItems.push({ name: si, km: 0, months: 12 });
      await save('labour', { code: r['Op Code'], name: r['Operation'], category: r['Category'], hours: num(r['Standard Hours']) || 1, rate: num(r['Rate (AED/hr)']), serviceItem: si }); added++;
    }
    await saveSettings();
    toast(`Imported ${added} records`, 'ok'); render();
  } catch (e) { console.error(e); toast('Import failed: ' + e.message, 'err'); }
}

/* ---------- Services & offers (v3.3) ---------- */
function offersSettingsHTML() {
  const o = S.settings.offers;
  return `<div class="card card-pad mt"><h3 style="margin-top:0">🏷 Services &amp; offers</h3><div class="grid g4">
    <div class="field"><label>Health check fee without a paid service (AED)</label><input id="of_hc" type="number" value="${esc(o.healthCheckFee)}"><div class="help">Free automatically when the job has other paid work</div></div>
    <div class="field"><label>Pre-purchase inspection price (AED)</label><input id="of_ppi" type="number" value="${esc(o.ppiPrice)}"></div>
    <div class="field"><label>Registration renewal service fee (AED)</label><input id="of_rn" type="number" value="${esc(o.renewalFee)}"></div>
    <div class="field"><label>Follow up recommended work after (days)</label><input id="of_fu" value="${esc((o.followUpDays || []).join(', '))}"><div class="help">e.g. 7, 30, 90</div></div>
    <div class="field span2"><label>Google review link</label><input id="of_rev" value="${esc(o.googleReviewLink || '')}" placeholder="https://g.page/r/…/review"><div class="help">Google Business Profile → Ask for reviews → copy link</div></div>
    <div class="field"><label>Ask for a review after (days)</label><input id="of_ra" type="number" value="${esc(o.reviewAfterDays)}"></div>
    <div class="field"><label>Ask the same customer again after (months)</label><input id="of_rm" type="number" value="${esc(o.reviewEveryMonths)}"></div>
  </div><div class="row end mt"><button class="btn primary" onclick="saveOffers()">Save</button></div></div>`;
}
async function saveOffers() {
  const o = S.settings.offers, v = id => $(id).value.trim();
  Object.assign(o, { healthCheckFee: num(v('#of_hc')), ppiPrice: num(v('#of_ppi')), renewalFee: num(v('#of_rn')), googleReviewLink: v('#of_rev'), reviewAfterDays: num(v('#of_ra')) || 1, reviewEveryMonths: num(v('#of_rm')) || 6,
    followUpDays: v('#of_fu').split(/[^\d]+/).map(num).filter(Boolean).sort((a, b) => a - b) });
  if (o.googleReviewLink && !/^https:\/\//.test(o.googleReviewLink)) return toast('The review link must start with https://', 'err');
  await saveSettings(); secLog('settings', 'Prices / offers changed', 'info'); toast('Saved', 'ok'); render();
}
