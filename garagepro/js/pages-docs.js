/* GaragePro — quotations, job cards, invoices, payments */
'use strict';

const KINDS = {
  quote: { coll: 'quotes', label: 'Quotation', list: '#/quotes' },
  job: { coll: 'jobs', label: 'Job Card', list: '#/jobs' },
  invoice: { coll: 'invoices', label: 'Invoice', list: '#/invoices' },
};
const ED = { kind: null, doc: null, timer: null };

/* ---------- autosave ---------- */
function edChanged() {
  clearTimeout(ED.timer);
  const s = $('#saveState'); if (s) s.textContent = 'Saving…';
  ED.timer = setTimeout(edFlush, 400);
}
async function edFlush() {
  if (!ED.timer) return;
  clearTimeout(ED.timer); ED.timer = null;
  if (ED.doc) await save(KINDS[ED.kind].coll, ED.doc);
  const s = $('#saveState'); if (s) s.textContent = '✓ All changes saved';
}
function edSet(k, v, redraw) {
  if (ED.kind === 'invoice' && (guardClosed(ED.doc.date, 'This invoice') || (k === 'date' && guardClosed(v, 'That date')))) return render();
  ED.doc[k] = v; edChanged();
  if (redraw) render(); else edTotals();
}

/* ---------- vehicle picker ---------- */
function pickVehicle(onPick, title = 'Select vehicle') {
  pickFrom({
    title, items: () => S.vehicles,
    filter: (v, q) => (v.plateNorm || '').includes(norm(q)) || (v.vinNorm || '').includes(norm(q)) || vehicleLabel(v).toLowerCase().includes(q) || ((customerOf(v) || {}).name || '').toLowerCase().includes(q) || String((customerOf(v) || {}).phone || '').includes(q),
    row: v => `${plateTag(v)} <b>${esc(vehicleLabel(v))}</b> · ${esc((customerOf(v) || {}).name || '')} <span class="faint small">${esc((customerOf(v) || {}).phone || '')} · ${esc(v.vin || '')}</span>`,
    onPick, addNew: { label: 'New vehicle (check-in)', fn: q => go('#/checkin/' + encodeURIComponent(q)) },
  });
}
async function newDoc(kind) {
  pickVehicle(async v => {
    const base = { vehicleId: v.id, customerId: v.customerId, date: today(), odometer: '', items: [], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate };
    let d;
    if (kind === 'quote') d = { ...base, number: await nextNo('quote'), status: 'Draft', validUntil: addDays(today(), num(S.settings.quoteValidDays) || 14) };
    if (kind === 'job') d = { ...base, number: await nextNo('job'), status: 'Booked', type: S.settings.lists.jobType[0], promised: addDays(today(), 1) };
    if (kind === 'invoice') d = { ...base, number: await nextNo('invoice'), dueDate: addDays(today(), num(S.settings.invoiceDueDays)) };
    await save(KINDS[kind].coll, d);
    go(`#/${kind}/${d.id}`);
  }, `New ${KINDS[kind].label.toLowerCase()} — which vehicle?`);
}

/* ---------- line items ---------- */
function itemsHTML() {
  const d = ED.doc, st = S.settings;
  const svcOpts = sel => `<option value="">—</option>${st.serviceItems.map(s => `<option ${s.name === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;
  const rows = (d.items || []).map((it, i) => `<tr>
    <td class="type"><select class="inp sm" onchange="edItem(${i},'type',this.value,true)">${[['part', 'Part'], ['labour', 'Labour'], ['other', 'Other']].map(([k, l]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><input class="inp" value="${esc(it.desc)}" oninput="edItem(${i},'desc',this.value)" placeholder="Description">
      ${it.partId ? `<div class="small faint">${esc(it.partNo || '')} · ${edStockLoc() ? 'on van' : 'in stock'}: ${fmtNum(onHandOf(it.partId, edStockLoc() || undefined))}</div>` : ''}</td>
    <td style="width:150px"><select class="inp sm" title="Service item — keeps the service schedule up to date" onchange="edItem(${i},'serviceItem',this.value)">${svcOpts(it.serviceItem)}</select></td>
    <td class="qty"><input class="inp right" type="number" step="any" value="${esc(it.qty)}" oninput="edItem(${i},'qty',this.value)"></td>
    <td class="rate"><input class="inp right" type="number" step="any" value="${esc(it.rate)}" oninput="edItem(${i},'rate',this.value)"></td>
    <td class="tot num" id="lt_${i}">${money(lineTotal(it), false)}</td>
    <td class="del"><button class="icon-btn" style="font-size:15px" title="Remove" onclick="edDelItem(${i})">✕</button></td></tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl items-tbl"><thead><tr><th>Type</th><th>Description</th><th>Service item</th><th class="num">Qty / Hrs</th><th class="num">Rate</th><th class="num">Amount</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="empty" style="padding:20px">No items yet — add parts and labour below.</td></tr>`}</tbody></table></div>
    <div class="row mt-s">${ED.kind !== 'package' ? '<button class="btn" onclick="edAddPackage()">📦 ＋ Service package</button>' : ''}<button class="btn" onclick="edAddPart()">⚙ ＋ Part from stock</button><button class="btn" onclick="edAddLabour()">⏱ ＋ Labour operation</button><button class="btn" onclick="edAddCustom()">＋ Custom line</button></div>`;
}
function edTotalsHTML() {
  const d = ED.doc, t = calcDoc(d);
  let extra = '';
  if (ED.kind === 'invoice') { const s = invoiceState(d); extra = `<div class="tr"><span>Paid</span><span>${money(s.paid)}</span></div><div class="tr strong ${s.balance > 0 ? 'red' : 'green'}"><span>Balance due</span><span>${money(s.balance)}</span></div>`; }
  return `<div class="tr"><span>Parts</span><span>${money(t.parts)}</span></div><div class="tr"><span>Labour (${fmtNum(t.hours)} h)</span><span>${money(t.labour)}</span></div>${t.other ? `<div class="tr"><span>Other</span><span>${money(t.other)}</span></div>` : ''}
    <div class="tr strong"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
    ${t.discount ? `<div class="tr"><span>Discount</span><span>− ${money(t.discount)}</span></div>` : ''}
    <div class="tr"><span>VAT ${num(t.vatRate)}%</span><span>${money(t.vat)}</span></div>
    <div class="tr grand"><span>Total</span><span>${money(t.total)}</span></div>${extra}
    <div class="tr small faint"><span>Parts cost ${money(t.cost, false)} · est. gross profit</span><span>${money(t.profit, false)}</span></div>`;
}
function edTotals() {
  (ED.doc.items || []).forEach((it, i) => { const el = $('#lt_' + i); if (el) el.textContent = money(lineTotal(it), false); });
  const t = $('#edTotals'); if (t) t.innerHTML = edTotalsHTML();
}
function edItem(i, k, v, redraw) {
  const it = ED.doc.items[i];
  it[k] = (k === 'qty' || k === 'rate') ? v : v;
  edChanged();
  if (redraw) drawItems(); else edTotals();
}
function edDelItem(i) { ED.doc.items.splice(i, 1); edChanged(); drawItems(); }
function drawItems() { $('#edItems').innerHTML = itemsHTML(); edTotals(); }
function edPushItem(it) { ED.doc.items = ED.doc.items || []; ED.doc.items.push(it); edChanged(); drawItems(); }

/* mobile jobs draw parts from their van */
function edStockLoc() { return ED.kind === 'job' && isMobile(ED.doc) ? jobLocation(ED.doc) : null; }
function edAddPart() {
  const loc = edStockLoc(), vanName = loc ? ((S.settings.mob.vans.find(v => v.id === loc) || {}).name || 'van') : '';
  const stock = stockTable().map(r => ({ ...r, here: loc ? (r.loc[loc] || 0) : r.onHand }));
  if (loc) stock.sort((a, b) => (b.here > 0) - (a.here > 0));
  pickFrom({
    title: loc ? `Add part — from ${esc(vanName)} stock` : 'Add part from stock', items: () => stock,
    filter: (r, q) => [r.p.name, r.p.partNumber, r.p.fits, r.p.category, r.p.code].join(' ').toLowerCase().includes(q),
    row: r => `<div class="row"><div class="grow"><b>${esc(r.p.name)}</b> <span class="faint small">${esc(r.p.partNumber || '')} ${r.p.fits ? '· ' + esc(r.p.fits) : ''}</span></div>
      <span class="${r.here <= 0 ? 'red' : r.low ? 'amber' : 'green'} small strong">${fmtNum(r.here)} ${esc(r.p.unit || '')} ${loc ? 'on ' + esc(vanName) : 'in stock'}</span> <b style="width:110px;text-align:right">${money(r.p.price)}</b></div>`,
    onPick: r => {
      if (r.here <= 0) toast(`${r.p.name} shows 0 ${loc ? 'on the van' : 'in stock'} — added anyway`, 'err');
      edPushItem({ type: 'part', partId: r.p.id, partNo: r.p.partNumber || '', desc: r.p.name, qty: 1, rate: num(r.p.price), cost: num(r.p.cost), serviceItem: r.p.serviceItem || '' });
    },
    addNew: { label: 'New part', fn: q => editPart(null, { name: q }, p => edPushItem({ type: 'part', partId: p.id, partNo: p.partNumber || '', desc: p.name, qty: 1, rate: num(p.price), cost: num(p.cost), serviceItem: p.serviceItem || '' })) },
  });
}
function edAddLabour() {
  pickFrom({
    title: 'Add labour operation', items: () => S.labour,
    filter: (l, q) => [l.name, l.code, l.category, l.serviceItem].join(' ').toLowerCase().includes(q),
    row: l => `<div class="row"><div class="grow"><b>${esc(l.name)}</b> <span class="faint small">${esc(l.code || '')} ${l.serviceItem ? '· ' + esc(l.serviceItem) : ''}</span></div><span class="small muted">${fmtNum(l.hours)} h × ${money(l.rate || S.settings.labourRate, false)}</span> <b style="width:110px;text-align:right">${money(num(l.hours) * num(l.rate || S.settings.labourRate))}</b></div>`,
    onPick: l => edPushItem({ type: 'labour', labourId: l.id, desc: l.name, qty: num(l.hours) || 1, rate: num(l.rate || S.settings.labourRate), cost: 0, serviceItem: l.serviceItem || '', technicianId: ED.doc.technicianId || '' }),
    addNew: { label: 'New operation', fn: q => editLabour(null, { name: q }) },
  });
}
function edAddCustom() { edPushItem({ type: 'labour', desc: '', qty: 1, rate: S.settings.labourRate, cost: 0 }); setTimeout(() => { const ins = document.querySelectorAll('#edItems tbody tr:last-child input'); if (ins[0]) ins[0].focus(); }, 20); }

/* ---------- shared editor shell ---------- */
function docShell({ kind, title, status, actions, header, main, side, before = '' }) {
  const d = ED.doc, v = vehicleOf(d), c = customerOf(d);
  const who = d.createdBy ? ` · created by ${esc(d.createdBy)}${d.updatedBy && d.updatedBy !== d.createdBy ? `, last edit ${esc(d.updatedBy)}` : ''}` : '';
  return `<div class="crumb"><a onclick="go('${KINDS[kind].list}')">${KINDS[kind].label}s</a> / ${esc(d.number || d.name || '')}</div>
  ${pageHead(`${title} <span class="mono">${esc(d.number || '')}</span> ${status}`, `<span id="saveState" class="small faint">✓ All changes saved</span><span class="small faint">${who}</span>`, actions)}
  ${before}
  <div class="grid g3">
    <div class="span2">
      <div class="card mb"><div class="card-pad">
        ${kind === 'package' ? '' : `<div class="selbox row mb">${v ? `<span class="plate lg" style="font-size:20px">${esc(v.plate)}</span><div class="grow"><b>${esc(vehicleLabel(v))}</b> <span class="muted small mono">${esc(v.vin || '')}</span><div>${custLink(c)} · ${esc((c || {}).phone || '')}</div></div>
          <button class="btn sm" onclick="go('#/vehicle/${v.id}')">History</button>` : `<div class="grow muted">No vehicle selected</div>`}<button class="btn sm" onclick="edChangeVehicle()">Change</button></div>`}
        ${header}</div></div>
      ${main}
      <div class="card mb"><div class="card-head"><h3>Parts & labour</h3></div><div class="card-pad" id="edItems">${itemsHTML()}</div></div>
      <div class="card mb"><div class="card-pad grid g2">
        <div class="field"><label>Notes (printed on document)</label><textarea oninput="edSet('notes',this.value)">${esc(d.notes || '')}</textarea></div>
        <div class="field"><label>Internal notes (never printed)</label><textarea oninput="edSet('internal',this.value)">${esc(d.internal || '')}</textarea></div></div></div>
    </div>
    <div>
      <div class="card mb"><div class="card-head"><h3>Totals</h3></div><div class="card-pad">
        <div class="row mb"><div class="field grow"><label>Discount</label><input class="inp" type="number" step="any" value="${esc(d.discount || '')}" oninput="edSet('discount',this.value)"></div>
          <div class="field"><label>&nbsp;</label><select class="inp" onchange="edSet('discountType',this.value)"><option value="pct" ${d.discountType !== 'amt' ? 'selected' : ''}>%</option><option value="amt" ${d.discountType === 'amt' ? 'selected' : ''}>${esc(S.settings.currency)}</option></select></div>
          <div class="field" style="width:80px"><label>VAT %</label><input class="inp" type="number" step="any" value="${esc(d.vatRate ?? S.settings.vatRate)}" oninput="edSet('vatRate',this.value)"></div></div>
        <div class="totals" style="width:100%" id="edTotals">${edTotalsHTML()}</div></div></div>
      ${side || ''}
    </div>
  </div>`;
}
function edChangeVehicle() {
  pickVehicle(v => { ED.doc.vehicleId = v.id; ED.doc.customerId = v.customerId; edChanged(); edFlush().then(render); });
}
function field(label, inner, cls = '') { return `<div class="field ${cls}"><label>${label}</label>${inner}</div>`; }
const inpDate = (k, v) => `<input type="date" value="${esc(v || '')}" onchange="edSet('${k}',this.value)">`;
const inpText = (k, v, ph = '') => `<input value="${esc(v || '')}" placeholder="${esc(ph)}" oninput="edSet('${k}',this.value)">`;
const inpNum = (k, v, ph = '') => `<input type="number" value="${esc(v || '')}" placeholder="${esc(ph)}" oninput="edSet('${k}',this.value)">`;
const selectHTML = (k, opts, v, redraw = false) => `<select onchange="edSet('${k}',this.value,${redraw})">${opts.map(o => Array.isArray(o) ? o : [o, o]).map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;

/* =================== QUOTATIONS =================== */
PAGES.quotes = () => {
  const f = getFilter('quotes', 'status', 'Open');
  view().innerHTML = pageHead('Quotations', 'Estimate first, get approval, then convert to a job card in one click.', `<button class="btn primary" onclick="newDoc('quote')">＋ New quotation</button>`) +
    `<div class="filters">${liveSearch('quotes', 'Search number, plate, customer…', 'drawQuotes')}<div class="seg">${['Open', 'Approved', 'Converted', 'Declined', 'Expired', 'All'].map(k => `<button class="${f === k ? 'on' : ''}" onclick="setFilter('quotes','status','${k}')">${k}</button>`).join('')}</div></div><div class="card" id="qList"></div>`;
  drawQuotes();
};
function docSearchMatch(d, q) {
  if (!q) return true;
  const v = vehicleOf(d) || {}, c = customerOf(d) || {};
  return [d.number, v.plate, v.plateNorm, v.vin, c.name, c.phone, vehicleLabel(v), d.description, d.complaint].join(' ').toLowerCase().includes(q.toLowerCase());
}
function drawQuotes() {
  const f = getFilter('quotes', 'status', 'Open'), q = getFilter('quotes', 'q');
  const list = S.quotes.filter(x => { const s = quoteState(x); return (f === 'All' || (f === 'Open' ? ['Draft', 'Sent'].includes(s) : s === f)) && docSearchMatch(x, q); })
    .sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  $('#qList').innerHTML = table([
    { h: 'No.', v: x => `<b>${esc(x.number)}</b>` }, { h: 'Date', v: x => fmtDate(x.date) }, { h: 'Vehicle', v: x => `${plateTag(vehicleOf(x))} <span class="small muted">${esc(vehicleLabel(vehicleOf(x)))}</span>` },
    { h: 'Customer', v: x => esc((customerOf(x) || {}).name) }, { h: 'Work', v: x => `<span class="small">${esc((x.description || '').slice(0, 60))}</span>` },
    { h: 'Total', cls: 'num', v: x => money(calcDoc(x).total, false) }, { h: 'Valid until', v: x => fmtDate(x.validUntil) }, { h: 'Status', v: x => pill(quoteState(x)) }],
    list, { click: x => `go('#/quote/${x.id}')`, empty: 'No quotations here.' });
}
PAGES.quote = id => {
  const q = get('quotes', id); if (!q) { view().innerHTML = '<div class="empty">Quotation not found.</div>'; return; }
  ED.kind = 'quote'; ED.doc = q;
  const job = q.jobId && get('jobs', q.jobId);
  view().innerHTML = docShell({
    kind: 'quote', title: 'Quotation', status: pill(quoteState(q)),
    actions: `<button class="btn" onclick="previewDoc('quote',ED.doc)">👁 Preview / Print</button><button class="btn wa" onclick="edFlush().then(()=>openSendDialog('quote',ED.doc))">Send WhatsApp / Email</button>
      ${job ? `<button class="btn" onclick="go('#/job/${job.id}')">Open job ${esc(job.number)}</button>` : `<button class="btn primary" onclick="convertQuote()">✔ Approved → Job card</button>`}`,
    header: `<div class="grid g4">
      ${field('Date', inpDate('date', q.date))}${field('Valid until', inpDate('validUntil', q.validUntil))}${field('Odometer (km)', inpNum('odometer', q.odometer))}
      ${field('Status', selectHTML('status', QUOTE_STATUSES.filter(s => s !== 'Expired'), q.status, true))}
      ${field('Work description / customer request', `<textarea oninput="edSet('description',this.value)">${esc(q.description || '')}</textarea>`, 'spanall')}</div>`,
    main: '',
    side: `<div class="card"><div class="card-head"><h3>More</h3></div><div class="card-pad row">
      <button class="btn" onclick="duplicateDoc('quote')">Duplicate</button>
      <button class="btn danger" onclick="deleteDoc('quote')">Delete</button></div></div>`,
  });
};
async function convertQuote() {
  await edFlush();
  const q = ED.doc;
  const open = S.jobs.find(j => j.vehicleId === q.vehicleId && OPEN_JOB.includes(j.status));
  let job;
  if (open && await confirmBox(`${open.number} is already open for this vehicle.\n\nAdd the quoted items to ${open.number}? (Choose Cancel to open a new job card instead.)`, `Add to ${open.number}`)) {
    job = open; job.items = [...(job.items || []), ...structuredClone(q.items || [])];
    if (q.description) job.complaint = [job.complaint, q.description].filter(Boolean).join('\n');
    if (job.status === 'Awaiting Approval') job.status = 'In Progress';
    await save('jobs', job);
  } else {
    job = await save('jobs', {
      number: await nextNo('job'), date: today(), vehicleId: q.vehicleId, customerId: q.customerId, odometer: q.odometer, items: structuredClone(q.items || []),
      discount: q.discount, discountType: q.discountType, vatRate: q.vatRate, status: 'Booked', type: S.settings.lists.jobType[0], complaint: q.description || '', quoteId: q.id, promised: addDays(today(), 1),
    });
  }
  q.status = 'Converted'; q.jobId = job.id; await save('quotes', q);
  toast(`Converted to job card ${job.number}`, 'ok');
  go('#/job/' + job.id);
}
async function duplicateDoc(kind) {
  await edFlush();
  const src = ED.doc;
  const copy = structuredClone(src);
  delete copy.id; delete copy.createdAt; delete copy.jobId; delete copy.invoiceId; delete copy.sentAt; delete copy.quoteId; delete copy.void;
  copy.number = await nextNo(kind); copy.date = today();
  if (kind === 'quote') { copy.status = 'Draft'; copy.validUntil = addDays(today(), num(S.settings.quoteValidDays) || 14); }
  if (kind === 'job') { copy.status = 'Booked'; copy.inspection = []; copy.completed = ''; }
  await save(KINDS[kind].coll, copy);
  go(`#/${kind}/${copy.id}`);
}
async function deleteDoc(kind) {
  const d = ED.doc;
  if (kind === 'job' && jobInvoice(d)) return toast('This job has an invoice — cancel the job instead, or void the invoice first.', 'err');
  if (kind === 'invoice' && S.payments.some(p => p.invoiceId === d.id)) return toast('This invoice has payments — void it instead.', 'err');
  if (kind === 'invoice' && guardClosed(d.date, 'This invoice')) return;
  if (!(await confirmBox(`Delete ${KINDS[kind].label.toLowerCase()} ${d.number}? This cannot be undone.`, 'Delete', true))) return;
  clearTimeout(ED.timer); ED.timer = null;
  if (kind === 'invoice' && d.jobId) { const j = get('jobs', d.jobId); if (j) { j.invoiceId = ''; await save('jobs', j); } }
  if (kind === 'job') S.quotes.filter(q => q.jobId === d.id).forEach(q => { q.jobId = ''; q.status = 'Approved'; save('quotes', q); });
  await remove(KINDS[kind].coll, d.id); ED.doc = null;
  toast('Deleted'); go(KINDS[kind].list);
}

/* =================== JOB CARDS =================== */
function lineSeg(page) {
  const l = getFilter(page, 'line', 'all');
  return `<div class="seg">${[['all', 'All'], ['auto', '🔧 Auto'], ['mobile', '🚐 Mobile']].map(([k, t]) => `<button class="${l === k ? 'on' : ''}" onclick="setFilter('${page}','line','${k}')">${t}</button>`).join('')}</div>`;
}
const lineMatch = (page, d) => { const l = getFilter(page, 'line', 'all'); return l === 'all' || lineOf(d) === l; };
PAGES.jobs = () => {
  const f = getFilter('jobs', 'status', 'In workshop');
  view().innerHTML = pageHead('Job Cards', 'Work orders — everything done to a car during a visit (workshop and mobile).', `<button class="btn" onclick="newMobileJob()">🚐 Mobile request</button><button class="btn primary" onclick="go('#/checkin')">＋ Check-in / new job</button>`) +
    `<div class="filters">${liveSearch('jobs', 'Search job no., plate, customer, complaint…', 'drawJobs')}${lineSeg('jobs')}
      <div class="seg">${['In workshop', 'Ready', 'Delivered', 'Cancelled', 'All'].map(k => `<button class="${f === k ? 'on' : ''}" onclick="setFilter('jobs','status','${k}')">${k}</button>`).join('')}</div>
      <select class="inp" onchange="setFilter('jobs','tech',this.value)"><option value="">All technicians</option>${S.technicians.map(t => `<option value="${t.id}" ${getFilter('jobs', 'tech') === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    <div class="card" id="jList"></div>`;
  drawJobs();
};
function drawJobs() {
  const f = getFilter('jobs', 'status', 'In workshop'), q = getFilter('jobs', 'q'), tech = getFilter('jobs', 'tech');
  const list = S.jobs.filter(j => (f === 'All' || (f === 'In workshop' ? OPEN_JOB.includes(j.status) : j.status === f)) && (!tech || j.technicianId === tech) && lineMatch('jobs', j) && docSearchMatch(j, q))
    .sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  $('#jList').innerHTML = table([
    { h: 'Job', v: j => `<b>${esc(j.number)}</b> ${lineBadge(j)}` }, { h: 'Date', v: j => fmtDate(j.date) }, { h: 'Vehicle', v: j => `${plateTag(vehicleOf(j))} <span class="small muted">${esc(vehicleLabel(vehicleOf(j)))}</span>` },
    { h: 'Customer', v: j => esc((customerOf(j) || {}).name) }, { h: 'Type', v: j => `<span class="small">${esc(isMobile(j) ? (j.mobile || {}).problem || 'Mobile service' : j.type || '')}</span>` }, { h: 'Technician', v: j => esc(isMobile(j) ? crewOf(j).join(', ') : techName(j.technicianId)) },
    { h: 'Status', v: j => isMobile(j) ? pill((j.mobile || {}).status || 'New') : pill(j.status) }, { h: 'Total', cls: 'num', v: j => money(jobTotals(j).total, false) },
    { h: 'Invoice', v: j => { const t = jobTotals(j); return t.status === 'Not invoiced' ? '<span class="faint small">—</span>' : pill(t.status); } },
    { h: 'Days', cls: 'num', v: j => daysBetween(j.date, j.completed || today()) }],
    list, { click: j => `go('#/job/${j.id}')`, empty: 'No job cards here.' });
}
PAGES.job = id => {
  const j = get('jobs', id); if (!j) { view().innerHTML = '<div class="empty">Job card not found.</div>'; return; }
  ED.kind = 'job'; ED.doc = j;
  const inv = jobInvoice(j);
  const techs = [['', '— unassigned —'], ...S.technicians.filter(t => t.active !== false || t.id === j.technicianId).map(t => [t.id, t.name])];
  const stepIdx = JOB_STATUSES.indexOf(j.status);
  const stepper = `<div class="stepper">${JOB_STATUSES.map((s, i) => `<div class="st ${s === j.status ? 'on' : (i < stepIdx && j.status !== 'Cancelled' && s !== 'Cancelled') ? 'done' : ''}" onclick="jobStatus(${jsq(s)})">${esc(s)}</div>`).join('')}</div>`;
  const invBanner = inv ? `<div class="card card-pad mb" style="background:var(--blueSoft);border-color:#bfdbfe">🧾 Invoiced as <a onclick="go('#/invoice/${inv.id}')"><b>${esc(inv.number)}</b></a> ${pill(invoiceState(inv).status)} — changes on this job card don't change the invoice.
      ${invoiceState(inv).paid === 0 && !inv.void ? `<button class="btn sm" onclick="syncInvoiceFromJob()">Update invoice from this job</button>` : ''}</div>` : '';
  const mob = isMobile(j);
  view().innerHTML = invBanner + docShell({
    before: mob ? mobilePanelHTML(j) : '',
    kind: 'job', title: mob ? '🚐 Mobile job' : 'Job Card', status: mob ? '' : pill(j.status),
    actions: `<button class="btn" onclick="previewDoc('job',ED.doc)">🖨 Job card</button><button class="btn" onclick="previewDoc('job',ED.doc,{hidePrices:true})">🖨 Workshop copy</button>
      <button class="btn wa" onclick="edFlush().then(()=>openSendDialog('job',ED.doc))">Send update</button>
      ${!Auth.canPage('invoice') ? '' : inv ? `<button class="btn primary" onclick="go('#/invoice/${inv.id}')">Open invoice →</button>` : `<button class="btn primary" onclick="createInvoiceFromJob()">🧾 Create invoice</button>`}`,
    header: `${mob ? '' : `<div class="mb">${stepper}</div>`}<div class="grid g4">
      ${field('Date in', inpDate('date', j.date))}${field('Odometer in (km)', inpNum('odometer', j.odometer, 'Last ' + fmtNum(currentOdo(vehicleOf(j) || {}))))}
      ${field('Promised', inpDate('promised', j.promised))}${field('Completed', inpDate('completed', j.completed))}
      ${field('Job type', selectHTML('type', S.settings.lists.jobType, j.type))}${field('Technician', selectHTML('technicianId', techs, j.technicianId))}
      ${field('Customer ref / LPO', inpText('lpo', j.lpo))}${field('Fuel level in', selectHTML('fuelIn', ['', 'E', '¼', '½', '¾', 'F'], j.fuelIn))}
      ${field('Customer complaint / request', `<textarea oninput="edSet('complaint',this.value)">${esc(j.complaint || '')}</textarea>`, 'span2')}
      ${field('Diagnosis / work carried out', `<textarea oninput="edSet('diagnosis',this.value)">${esc(j.diagnosis || '')}</textarea>`, 'span2')}</div>`,
    main: jobPhotosCardHTML(j) + `<div class="card mb"><div class="card-head"><h3>🔍 Multi-point inspection</h3><div class="actions" id="inspActions">${inspActionsHTML(j)}</div></div><div class="card-pad" id="inspBox">${inspectionHTML(j)}</div></div>`,
    side: jobSideHTML(j),
  });
  drawJobPhotos(j.id);
};
function jobSideHTML(j) {
  const q = j.quoteId && get('quotes', j.quoteId);
  const labourByTech = {};
  for (const it of j.items || []) if (it.type === 'labour') { const t = techName(it.technicianId || j.technicianId) || 'Unassigned'; labourByTech[t] = (labourByTech[t] || 0) + num(it.qty); }
  return signaturesCardHTML(j) + `<div class="card mb"><div class="card-head"><h3>Job info</h3></div><div class="card-pad"><dl class="kv" style="grid-template-columns:110px 1fr">
    <dt>Days in shop</dt><dd>${daysBetween(j.date, j.completed || today())}</dd>
    ${q ? `<dt>From quote</dt><dd><a onclick="go('#/quote/${q.id}')">${esc(q.number)}</a></dd>` : ''}
    <dt>Hours</dt><dd>${Object.entries(labourByTech).map(([t, h]) => `${esc(t)}: ${fmtNum(h)} h`).join('<br>') || '—'}</dd>
    <dt>Advisories</dt><dd>${inspectionFlags(j).length || 0}</dd></dl></div></div>
    <div class="card"><div class="card-head"><h3>More</h3></div><div class="card-pad row">
      <button class="btn" onclick="duplicateDoc('job')">Duplicate</button>
      ${j.status !== 'Cancelled' ? `<button class="btn danger" onclick="jobStatus('Cancelled')">Cancel job</button>` : ''}
      <button class="btn danger" onclick="deleteDoc('job')">Delete</button></div></div>`;
}
async function jobStatus(s) {
  const j = ED.doc; const prev = j.status;
  if (s === prev) return;
  if (s === 'Cancelled' && !(await confirmBox(`Cancel job ${j.number}? Parts on it will return to stock.`, 'Cancel job', true))) return;
  j.status = s;
  if ((s === 'Ready' || s === 'Delivered') && !j.completed) j.completed = today();
  if (s === 'Delivered' && j.odometer) { const v = vehicleOf(j); if (v && num(j.odometer) > num(v.odometer)) { v.odometer = num(j.odometer); await save('vehicles', v); } }
  await save('jobs', j);
  render();
  if (s === 'Ready') {
    if (await confirmBox(`Job is ready. Send the customer a “ready for collection” message now?`, 'Yes, send message')) openSendDialog('job', j);
  } else if (s === 'Delivered' && !jobInvoice(j)) {
    if (await confirmBox('This job has no invoice yet. Create the invoice now?', 'Create invoice')) createInvoiceFromJob();
  }
}
async function makeInvoiceFromJob(j) {
  if (isMobile(j)) applyCalloutRules(j);
  const inv = await save('invoices', {
    number: await nextNo('invoice'), date: today(), jobId: j.id, vehicleId: j.vehicleId, customerId: j.customerId, odometer: j.odometer, line: j.line || 'auto',
    items: structuredClone(j.items || []), discount: j.discount, discountType: j.discountType, vatRate: j.vatRate ?? S.settings.vatRate,
    workDone: j.diagnosis || (isMobile(j) ? (j.mobile || {}).problem || '' : ''), lpo: j.lpo || '', dueDate: addDays(today(), num(S.settings.invoiceDueDays)),
  });
  j.invoiceId = inv.id; await save('jobs', j);
  toast(`Invoice ${inv.number} created`, 'ok');
  return inv;
}
async function createInvoiceFromJob() {
  await edFlush();
  const j = ED.doc;
  if (!(j.items || []).length && !(await confirmBox('This job card has no parts or labour. Create an empty invoice?'))) return;
  const inv = await makeInvoiceFromJob(j);
  go('#/invoice/' + inv.id);
}
async function syncInvoiceFromJob() {
  await edFlush();
  const j = ED.doc, inv = jobInvoice(j);
  if (!(await confirmBox(`Replace the items on ${inv.number} with the current items on this job card?`))) return;
  Object.assign(inv, { items: structuredClone(j.items || []), discount: j.discount, discountType: j.discountType, vatRate: j.vatRate, workDone: j.diagnosis || inv.workDone, odometer: j.odometer });
  await save('invoices', inv); toast('Invoice updated', 'ok'); render();
}

/* inspection */
function inspActionsHTML(j) {
  if (!(j.inspection || []).length) return '';
  const fl = inspectionFlags(j);
  return `${fl.length ? `<button class="btn sm wa" onclick="sendInspection()">Send results</button><button class="btn sm" onclick="quoteFromInspection()">Quote advisories</button>` : ''}<button class="btn sm" onclick="markAllOK()">Mark rest OK</button>`;
}
function inspectionHTML(j) {
  if (!(j.inspection || []).length) return `<div class="row"><span class="muted grow">Record the condition of the car — anything marked Attention or Replace becomes an advisory on the job card and in the car's history.</span><button class="btn" onclick="startInspection()">Start ${S.settings.inspectionTemplate.length}-point inspection</button></div>`;
  let h = '', cat = '';
  j.inspection.forEach((p, i) => {
    if (p.cat !== cat) { cat = p.cat; h += `<div class="insp-cat">${esc(cat)}</div>`; }
    h += `<div class="insp-row"><div>${esc(p.point)}</div><div>${['OK', 'Attention', 'Replace', 'NA'].map(r => `<button class="rbtn ${r} ${p.result === r ? 'on' : ''}" onclick="setInsp(${i},'${r}')">${r === 'NA' ? 'N/A' : r}</button>`).join('')}</div>
      <input class="inp sm" placeholder="Reading / note" value="${esc(p.note || '')}" oninput="ED.doc.inspection[${i}].note=this.value;edChanged()"></div>`;
  });
  const done = j.inspection.filter(p => p.result).length;
  return `<div class="small muted mb">${done} of ${j.inspection.length} checked · ${inspectionFlags(j).length} advisories</div>${h}`;
}
function drawInspection() { $('#inspBox').innerHTML = inspectionHTML(ED.doc); $('#inspActions').innerHTML = inspActionsHTML(ED.doc); }
function startInspection() { ED.doc.inspection = S.settings.inspectionTemplate.map(([cat, point]) => ({ cat, point, result: '', note: '' })); edChanged(); drawInspection(); }
function setInsp(i, r) { const p = ED.doc.inspection[i]; p.result = p.result === r ? '' : r; edChanged(); drawInspection(); }
function markAllOK() { ED.doc.inspection.forEach(p => { if (!p.result) p.result = 'OK'; }); edChanged(); drawInspection(); }
function sendInspection() {
  const j = ED.doc, v = vehicleOf(j), c = customerOf(j);
  const items = inspectionFlags(j).map(p => `${p.result === 'Replace' ? '🔴 Replace' : '🟠 Attention'}: ${p.point}${p.note ? ' — ' + p.note : ''}`).join('\n');
  openMessageDialog({ vehicle: v, customer: c, type: 'inspection', text: fillTemplate(S.settings.templates.inspection, { ...baseCtx(v, c), items }) });
}
async function quoteFromInspection() {
  await edFlush();
  const j = ED.doc;
  const q = await save('quotes', {
    number: await nextNo('quote'), date: today(), vehicleId: j.vehicleId, customerId: j.customerId, odometer: j.odometer, status: 'Draft',
    validUntil: addDays(today(), num(S.settings.quoteValidDays) || 14), discount: 0, discountType: 'pct', vatRate: S.settings.vatRate,
    description: `Recommended work from inspection on job ${j.number}`,
    items: inspectionFlags(j).map(p => ({ type: 'part', desc: `${p.point}${p.note ? ' (' + p.note + ')' : ''}`, qty: 1, rate: 0, cost: 0 })),
  });
  toast(`Quotation ${q.number} created — add prices`, 'ok'); go('#/quote/' + q.id);
}

/* =================== INVOICES =================== */
PAGES.invoices = () => {
  const f = getFilter('invoices', 'status', 'All');
  const m = getFilter('invoices', 'month', '');
  const months = [...new Set(S.invoices.map(i => monthKey(i.date)))].sort().reverse();
  view().innerHTML = pageHead('Invoices', 'Tax invoices with VAT — send by WhatsApp or email, take payments, track balances.', `<button class="btn" onclick="newDoc('invoice')">＋ Direct invoice</button>`) +
    `<div class="filters">${liveSearch('invoices', 'Search invoice no., plate, customer…', 'drawInvoices')}${lineSeg('invoices')}
      <div class="seg">${['All', 'Unpaid', 'Partial', 'Overdue', 'Paid', 'Void'].map(k => `<button class="${f === k ? 'on' : ''}" onclick="setFilter('invoices','status','${k}')">${k}</button>`).join('')}</div>
      <select class="inp" onchange="setFilter('invoices','month',this.value)"><option value="">All months</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${new Date(x + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="card" id="iList"></div>`;
  drawInvoices();
};
function drawInvoices() {
  const f = getFilter('invoices', 'status', 'All'), q = getFilter('invoices', 'q'), m = getFilter('invoices', 'month', '');
  const list = S.invoices.filter(i => { const s = invoiceState(i).status; return (f === 'All' || s === f || (f === 'Unpaid' && s === 'Overdue')) && (!m || monthKey(i.date) === m) && lineMatch('invoices', i) && docSearchMatch(i, q); })
    .sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  const tot = list.filter(i => !i.void).reduce((a, i) => { const s = invoiceState(i); a.t += s.total; a.p += s.paid; a.b += s.balance; a.v += s.vat; return a; }, { t: 0, p: 0, b: 0, v: 0 });
  $('#iList').innerHTML = table([
    { h: 'Invoice', v: i => `<b>${esc(i.number)}</b> ${lineBadge(i)}` }, { h: 'Date', v: i => fmtDate(i.date) }, { h: 'Vehicle', v: i => plateTag(vehicleOf(i)) },
    { h: 'Customer', v: i => esc((customerOf(i) || {}).name) }, { h: 'VAT', cls: 'num', v: i => money(invoiceState(i).vat, false) }, { h: 'Total', cls: 'num', v: i => money(invoiceState(i).total, false) },
    { h: 'Paid', cls: 'num', v: i => money(invoiceState(i).paid, false) }, { h: 'Balance', cls: 'num', v: i => { const b = invoiceState(i).balance; return b > 0 ? `<b class="red">${money(b, false)}</b>` : '0.00'; } },
    { h: 'Status', v: i => pill(invoiceState(i).status) }, { h: '', v: i => i.sentAt ? '<span title="Sent to customer">📤</span>' : '' }],
    list, {
      click: i => `go('#/invoice/${i.id}')`, empty: 'No invoices here.',
      foot: [{ v: `${list.length} invoices` }, {}, {}, {}, { cls: 'num', v: money(tot.v, false) }, { cls: 'num', v: money(tot.t, false) }, { cls: 'num', v: money(tot.p, false) }, { cls: 'num', v: money(tot.b, false) }, {}, {}]
    });
}
PAGES.invoice = id => {
  const inv = get('invoices', id); if (!inv) { view().innerHTML = '<div class="empty">Invoice not found.</div>'; return; }
  ED.kind = 'invoice'; ED.doc = inv;
  const s = invoiceState(inv);
  const job = inv.jobId && get('jobs', inv.jobId);
  const pays = S.payments.filter(p => p.invoiceId === inv.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const locked = isClosedPeriod(inv.date);
  view().classList.toggle('locked', locked);
  view().innerHTML = (locked ? `<div class="card card-pad mb" style="background:var(--graySoft)">🔒 ${monthLabel(monthKey(inv.date))} is closed — this invoice is read-only. You can still print and send it, or <a onclick="go('#/closing')">reopen the month</a>.</div>` : '') +
    (inv.void ? `<div class="card card-pad mb" style="background:var(--redSoft);border-color:#fecaca">This invoice is <b>VOID</b> — it's excluded from revenue and balances. <button class="btn sm" onclick="voidInvoice(false)">Restore</button></div>` : '') +
    docShell({
      kind: 'invoice', title: docTitle('invoice') === 'TAX INVOICE' ? 'Tax Invoice' : 'Invoice', status: pill(s.status) + ' ' + lineBadge(inv),
      actions: `<button class="btn" onclick="previewDoc('invoice',ED.doc)">👁 Preview / Print</button><button class="btn wa" onclick="edFlush().then(()=>openSendDialog('invoice',ED.doc))">Send WhatsApp / Email</button>
        ${s.balance > 0 && !inv.void && payLinkFor(inv) ? `<button class="btn" onclick="showPayQR(ED.doc)">▦ Pay QR</button>` : ''}
        ${s.balance > 0 && !inv.void ? `<button class="btn primary" onclick="recordPayment('${inv.id}')">💳 Record payment</button>` : ''}`,
      header: `<div class="grid g4">${field('Invoice date', inpDate('date', inv.date))}${field('Due date', inpDate('dueDate', inv.dueDate))}${field('Odometer (km)', inpNum('odometer', inv.odometer))}${field('Customer ref / LPO', inpText('lpo', inv.lpo))}
        ${field('Payment link for this invoice (optional)', inpText('payLink', inv.payLink, S.settings.payStripeLink ? 'Blank = your default Stripe link' : 'Paste a Stripe / WIO payment link'), 'spanall')}
        ${field('Work carried out (printed)', `<textarea oninput="edSet('workDone',this.value)">${esc(inv.workDone || '')}</textarea>`, 'spanall')}</div>
        ${job ? `<div class="small muted mt-s">From job card <a onclick="go('#/job/${job.id}')">${esc(job.number)}</a> (${esc(job.status)})</div>` : ''}
        ${pays.length ? `<div class="small amber mt-s">⚠ Payments have been recorded against this invoice — editing items changes the balance.</div>` : ''}`,
      main: '',
      side: `<div class="card mb"><div class="card-head"><h3>Payments</h3>${s.balance > 0 && !inv.void ? `<div class="actions"><button class="btn sm primary" onclick="recordPayment('${inv.id}')">＋ Add</button></div>` : ''}</div>
        ${pays.length ? pays.map(p => `<div class="alert-row"><div class="grow"><b>${money(p.amount)}</b> <span class="muted small">${esc(p.method)}</span><div class="small faint">${esc(p.number)} · ${fmtDate(p.date)}${p.reference ? ' · ' + esc(p.reference) : ''}</div></div>
          <button class="btn sm ghost" title="Receipt" onclick="receiptActions('${p.id}')">🧾</button><button class="btn sm ghost" title="Delete" onclick="deletePayment('${p.id}')">✕</button></div>`).join('') : '<div class="empty" style="padding:18px">No payments yet</div>'}</div>
        <div class="card"><div class="card-head"><h3>More</h3></div><div class="card-pad row">
          ${s.balance > 0 && !inv.void ? `<button class="btn" onclick="edFlush().then(()=>openMessageDialog({vehicle:vehicleOf(ED.doc),customer:customerOf(ED.doc),type:'payment',text:fillTemplate(S.settings.templates.payment,docMessageCtx('invoice',ED.doc))}))">Payment reminder</button>` : ''}
          <button class="btn" onclick="duplicateDoc('invoice')">Duplicate</button>
          ${inv.void ? '' : `<button class="btn danger" onclick="voidInvoice(true)">Void</button>`}
          <button class="btn danger" onclick="deleteDoc('invoice')">Delete</button></div></div>`,
    });
};
async function voidInvoice(on) {
  if (guardClosed(ED.doc.date, 'This invoice')) return;
  if (on && !(await confirmBox(`Void invoice ${ED.doc.number}? It stays on record (numbering is kept) but is excluded from revenue and balances.`, 'Void invoice', true))) return;
  ED.doc.void = on; await save('invoices', ED.doc); render();
}

/* =================== PAYMENTS =================== */
function recordPayment(invoiceId) {
  const inv = get('invoices', invoiceId), s = invoiceState(inv);
  openForm({
    title: `Record payment — ${esc(inv.number)}`, size: 'narrow', cols: 2,
    fields: [
      { k: 'amount', label: `Amount (${S.settings.currency})`, type: 'number', req: true, def: s.balance.toFixed(2), help: `Balance due ${money(s.balance)}` },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today() },
      { k: 'method', label: 'Method', type: 'select', options: S.settings.lists.paymentMethod, def: 'Cash', blank: false },
      { k: 'reference', label: 'Reference', ph: 'Card slip / cheque / transfer ref' },
    ],
    saveLabel: 'Save payment',
    onSave: async vals => {
      if (num(vals.amount) <= 0) throw new Error('Amount must be more than zero');
      if (guardClosed(vals.date, 'That payment date')) return false;
      if (num(vals.amount) > s.balance + 0.01 && !(await confirmBox(`Amount is more than the balance (${money(s.balance)}). Save anyway?`))) return false;
      await edFlush();
      const p = await save('payments', { ...vals, amount: num(vals.amount), number: await nextNo('receipt'), invoiceId: inv.id, customerId: inv.customerId, vehicleId: inv.vehicleId });
      toast(`Payment ${p.number} saved`, 'ok');
      render();
      setTimeout(async () => { if (await confirmBox(`Send receipt ${p.number} to the customer?`, 'Send receipt')) openSendDialog('receipt', p, { invoice: inv }); }, 100);
    },
  });
}
function receiptActions(pid) {
  const p = get('payments', pid), inv = get('invoices', p.invoiceId);
  previewDoc('receipt', p, { invoice: inv });
}
async function deletePayment(pid) {
  const p = get('payments', pid);
  if (guardClosed(p.date, 'This payment')) return;
  if (!(await confirmBox(`Delete payment ${p.number} of ${money(p.amount)}?`, 'Delete', true))) return;
  await remove('payments', pid); toast('Payment deleted'); render();
}
PAGES.payments = () => {
  const m = getFilter('payments', 'month', monthKey(today()));
  const months = [...new Set([monthKey(today()), ...S.payments.map(p => monthKey(p.date))])].sort().reverse();
  const list = S.payments.filter(p => !m || monthKey(p.date) === m).sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  const byMethod = {};
  list.forEach(p => byMethod[p.method || 'Other'] = (byMethod[p.method || 'Other'] || 0) + num(p.amount));
  const total = list.reduce((a, p) => a + num(p.amount), 0);
  view().innerHTML = pageHead('Payments received', 'Every payment is recorded against an invoice — balances update automatically.') +
    `<div class="filters"><select class="inp" onchange="setFilter('payments','month',this.value)"><option value="">All time</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${new Date(x + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="grid g6 mb"><div class="kpi"><div class="lbl">Total received</div><div class="val">${money(total, false)}</div><div class="hint">${list.length} payments</div></div>
      ${Object.entries(byMethod).map(([k, val]) => `<div class="kpi"><div class="lbl">${esc(k)}</div><div class="val" style="font-size:20px">${money(val, false)}</div></div>`).join('')}</div>
    <div class="card">${table([
      { h: 'Receipt', v: p => `<b>${esc(p.number)}</b>` }, { h: 'Date', v: p => fmtDate(p.date) }, { h: 'Invoice', v: p => { const i = get('invoices', p.invoiceId); return i ? `<a onclick="event.stopPropagation();go('#/invoice/${i.id}')">${esc(i.number)}</a>` : ''; } },
      { h: 'Customer', v: p => esc((get('customers', p.customerId) || {}).name) }, { h: 'Vehicle', v: p => plateTag(get('vehicles', p.vehicleId)) },
      { h: 'Method', v: p => esc(p.method || '') }, { h: 'Reference', v: p => esc(p.reference || '') }, { h: 'Amount', cls: 'num', v: p => `<b>${money(p.amount, false)}</b>` }],
      list, { click: p => `receiptActions('${p.id}')`, empty: 'No payments in this period.', foot: [{ v: 'Total' }, {}, {}, {}, {}, {}, {}, { cls: 'num', v: money(total, false) }] })}</div>`;
};
