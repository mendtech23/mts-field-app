/* GaragePro — parts & stock, purchase orders, suppliers, labour catalogue, technicians */
'use strict';

/* =================== PARTS & STOCK =================== */
const partFields = () => [
  { k: 'name', label: 'Part name', req: true, span: 2 },
  { k: 'category', label: 'Category', type: 'select', options: S.settings.lists.partCategory },
  { k: 'partNumber', label: 'Part no. (OEM / aftermarket)' },
  { k: 'fits', label: 'Fits / application', span: 2, ph: 'Toyota Camry 2018-2023' },
  { k: 'brand', label: 'Brand' },
  { k: 'unit', label: 'Unit', list: ['pcs', 'L', 'set', 'pair', 'kg', 'm', 'can'], def: 'pcs' },
  { k: 'cost', label: 'Unit cost', type: 'number', req: true },
  { k: 'price', label: 'Selling price', type: 'number', req: true },
  { k: 'openingStock', label: 'Opening stock', type: 'number', def: 0, help: 'Stock on hand when you started — after that it counts itself' },
  { k: 'reorderLevel', label: 'Reorder level', type: 'number', def: 1 },
  { k: 'supplierId', label: 'Main supplier', type: 'select', options: () => S.suppliers.map(s => [s.id, s.name]) },
  { k: 'bin', label: 'Bin / shelf location' },
  { k: 'serviceItem', label: 'Service item (for schedule)', type: 'select', options: () => S.settings.serviceItems.map(s => s.name), span: 2 },
];
function editPart(id, preset = {}, after) {
  const p = get('parts', id);
  openForm({
    title: p ? `Edit part` : 'New part', fields: partFields(), data: p || preset, size: 'wide', cols: 4,
    onSave: async vals => {
      const obj = p ? Object.assign(p, vals) : vals;
      if (!obj.code) obj.code = await nextNo('part');
      await save('parts', obj); toast('Part saved', 'ok');
      if (after) after(obj); else render();
    },
    onDelete: p ? async () => {
      const used = S.jobs.some(j => (j.items || []).some(i => i.partId === p.id)) || S.purchaseOrders.some(o => (o.items || []).some(i => i.partId === p.id));
      if (used) { toast('This part is used on jobs or POs — it cannot be deleted.', 'err'); return false; }
      if (!(await confirmBox(`Delete ${p.name}?`, 'Delete', true))) return false;
      await remove('parts', p.id); render(); return true;
    } : null,
  });
}
PAGES.parts = () => {
  const rows = stockTable();
  const value = rows.reduce((a, r) => a + r.value, 0), low = rows.filter(r => r.low).length;
  view().innerHTML = pageHead('Parts & Stock', 'Stock counts itself: opening + received purchase orders − parts used on jobs ± adjustments.',
    `<button class="btn" onclick="go('#/van')">🚐 Van stock</button><button class="btn" onclick="go('#/pos')">🚚 Purchase orders</button><button class="btn primary" onclick="editPart()">＋ Add part</button>`) +
    `<div class="grid g4 mb"><div class="kpi"><div class="lbl">Parts</div><div class="val">${rows.length}</div></div><div class="kpi"><div class="lbl">Stock value (cost)</div><div class="val">${money(value, false)}</div></div>
      <div class="kpi link" onclick="setFilter('parts','f','Low')"><div class="lbl">Low / out of stock</div><div class="val ${low ? 'red' : ''}">${low}</div><div class="hint">at or below reorder level</div></div>
      <div class="kpi"><div class="lbl">Retail value</div><div class="val">${money(rows.reduce((a, r) => a + r.onHand * num(r.p.price), 0), false)}</div></div></div>
    <div class="filters">${liveSearch('parts', 'Search name, part no., fits, category…', 'drawParts')}
      <div class="seg">${['All', 'Low'].map(k => `<button class="${getFilter('parts', 'f', 'All') === k ? 'on' : ''}" onclick="setFilter('parts','f','${k}')">${k === 'Low' ? 'Low stock' : k}</button>`).join('')}</div>
      ${rows.some(r => r.low) ? `<button class="btn" onclick="poFromLowStock()">Create PO for low stock</button>` : ''}</div>
    <div class="card" id="partList"></div>`;
  drawParts();
};
function drawParts() {
  const q = getFilter('parts', 'q').toLowerCase(), f = getFilter('parts', 'f', 'All');
  const rows = stockTable().filter(r => (f !== 'Low' || r.low) && (!q || [r.p.name, r.p.partNumber, r.p.fits, r.p.category, r.p.code, r.p.brand].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => a.p.name.localeCompare(b.p.name));
  $('#partList').innerHTML = table([
    { h: 'Code', v: r => `<span class="small muted">${esc(r.p.code || '')}</span>` }, { h: 'Part', v: r => `<b>${esc(r.p.name)}</b><div class="small faint">${esc([r.p.partNumber, r.p.fits].filter(Boolean).join(' · '))}</div>` },
    { h: 'Category', v: r => `<span class="small">${esc(r.p.category || '')}</span>` }, { h: 'Bin', v: r => esc(r.p.bin || '') },
    { h: 'On hand', cls: 'num', v: r => `<b class="${r.onHand <= 0 ? 'red' : r.low ? 'amber' : ''}">${fmtNum(r.onHand)}</b> <span class="small faint">${esc(r.p.unit || '')}</span>${stockLocations().length > 1 && stockLocations().some(l => l.id !== WORKSHOP && r.loc[l.id]) ? `<div class="small faint">${stockLocations().map(l => `${esc(l.name)} ${fmtNum(r.loc[l.id] || 0)}`).join(' · ')}</div>` : ''}` },
    { h: 'Used', cls: 'num', v: r => fmtNum(r.consumed) }, { h: 'Cost', cls: 'num', v: r => money(r.p.cost, false) }, { h: 'Price', cls: 'num', v: r => money(r.p.price, false) },
    { h: 'Margin', cls: 'num', v: r => num(r.p.price) ? Math.round((num(r.p.price) - num(r.p.cost)) / num(r.p.price) * 100) + '%' : '' },
    { h: 'Value', cls: 'num', v: r => money(r.value, false) },
    { h: '', v: r => `<button class="btn sm ghost" onclick="event.stopPropagation();adjustStock('${r.p.id}')">± Adjust</button><button class="btn sm ghost" onclick="event.stopPropagation();partMovements('${r.p.id}')">History</button>` }],
    rows, { click: r => `editPart('${r.p.id}')`, empty: 'No parts yet. Add the parts you keep on the shelf.' });
}
function adjustStock(pid) {
  const p = get('parts', pid);
  openForm({
    title: `Adjust stock — ${esc(p.name)}`, size: 'narrow', cols: 1,
    fields: [{ k: 'qty', label: `Quantity (+ add / − remove). On hand now: ${fmtNum(onHandOf(pid))}`, type: 'number', req: true },
      { k: 'reason', label: 'Reason', type: 'select', options: ['Stock count correction', 'Damaged / expired', 'Returned to supplier', 'Used in workshop (not billed)', 'Found / returned', 'Other'], def: 'Stock count correction', blank: false },
      { k: 'location', label: 'Where', type: 'select', options: () => stockLocations().map(l => [l.id, l.name]), def: WORKSHOP, blank: false },
      { k: 'date', label: 'Date', type: 'date', def: today() }],
    onSave: async vals => { await save('stockAdjustments', { ...vals, partId: pid }); toast('Stock adjusted', 'ok'); render(); },
  });
}
function partMovements(pid) {
  const p = get('parts', pid), mv = [];
  mv.push({ date: (p.createdAt || '').slice(0, 10), what: 'Opening stock', qty: num(p.openingStock) });
  for (const po of S.purchaseOrders) if (po.status === 'Received') for (const it of po.items || []) if (it.partId === pid) mv.push({ date: po.receivedDate || po.date, what: `Received ${po.number}`, qty: num(it.qty), link: `#/po/${po.id}` });
  for (const j of S.jobs) {
    if (j.status === 'Cancelled') continue;
    const inv = jobInvoice(j); const items = inv && !inv.void ? inv.items : j.items;
    for (const it of items || []) if (it.partId === pid) mv.push({ date: j.date, what: `Used on ${j.number} (${(vehicleOf(j) || {}).plate || ''})`, qty: -num(it.qty), link: `#/job/${j.id}` });
  }
  for (const i of S.invoices) if (!i.jobId && !i.void) for (const it of i.items || []) if (it.partId === pid) mv.push({ date: i.date, what: `Sold on ${i.number}`, qty: -num(it.qty), link: `#/invoice/${i.id}` });
  const locName = id => (stockLocations().find(l => l.id === (id || WORKSHOP)) || {}).name || 'Workshop';
  for (const a of S.stockAdjustments) if (a.partId === pid) {
    if (a.transferId) { if (num(a.qty) > 0) mv.push({ date: a.date, what: `Moved to ${locName(a.location)} (${a.reason})`, qty: 0 }); }
    else mv.push({ date: a.date, what: `Adjustment (${locName(a.location)}): ${a.reason}`, qty: num(a.qty) });
  }
  mv.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let bal = 0;
  openModal({
    title: `Stock history — ${esc(p.name)}`, size: 'wide',
    body: table([{ h: 'Date', v: m => fmtDate(m.date) }, { h: 'Movement', v: m => m.link ? `<a onclick="go('${m.link}')">${esc(m.what)}</a>` : esc(m.what) },
      { h: 'Qty', cls: 'num', v: m => `<span class="${m.qty < 0 ? 'red' : 'green'}">${m.qty > 0 ? '+' : ''}${fmtNum(m.qty)}</span>` }, { h: 'Balance', cls: 'num', v: m => { bal += m.qty; return `<b>${fmtNum(r2(bal))}</b>`; } }], mv),
  });
}

/* =================== PURCHASE ORDERS =================== */
PAGES.pos = () => {
  const f = getFilter('pos', 'status', 'Ordered');
  const list = S.purchaseOrders.filter(o => f === 'All' || o.status === f).sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  const poTotal = o => r2((o.items || []).reduce((a, it) => a + num(it.qty) * num(it.cost), 0));
  view().innerHTML = pageHead('Purchase Orders', 'Order parts from suppliers. Mark as Received and stock goes up automatically.', `<button class="btn primary" onclick="newPO()">＋ New purchase order</button>`) +
    `<div class="filters"><div class="seg">${['Ordered', 'Received', 'Cancelled', 'All'].map(k => `<button class="${f === k ? 'on' : ''}" onclick="setFilter('pos','status','${k}')">${k}</button>`).join('')}</div></div>
    <div class="card">${table([{ h: 'PO', v: o => `<b>${esc(o.number)}</b>` }, { h: 'Date', v: o => fmtDate(o.date) }, { h: 'Supplier', v: o => esc((get('suppliers', o.supplierId) || {}).name || '') },
      { h: 'Items', v: o => `<span class="small">${esc((o.items || []).map(i => i.desc).slice(0, 3).join(', '))}${(o.items || []).length > 3 ? '…' : ''}</span>` },
      { h: 'Total', cls: 'num', v: o => money(poTotal(o), false) }, { h: 'Received', v: o => fmtDate(o.receivedDate) }, { h: 'Status', v: o => pill(o.status) },
      { h: 'Supplier paid', v: o => o.status !== 'Received' ? '' : o.paidDate ? pill('Paid') : pill('Unpaid', 'red') }],
      list, { click: o => `go('#/po/${o.id}')`, empty: 'No purchase orders here.' })}</div>`;
};
async function newPO(items = [], supplierId = '') {
  const po = await save('purchaseOrders', { number: await nextNo('po'), date: today(), supplierId, status: 'Ordered', items });
  go('#/po/' + po.id);
}
function poFromLowStock() {
  const low = stockTable().filter(r => r.low);
  newPO(low.map(r => ({ partId: r.p.id, desc: r.p.name, qty: Math.max(1, num(r.p.reorderLevel) * 2 - r.onHand), cost: num(r.p.cost) })), low[0] && low[0].p.supplierId || '');
}
PAGES.po = id => {
  const o = get('purchaseOrders', id); if (!o) { view().innerHTML = '<div class="empty">PO not found.</div>'; return; }
  const locked = o.status === 'Received';
  const tot = r2((o.items || []).reduce((a, it) => a + num(it.qty) * num(it.cost), 0));
  const sup = get('suppliers', o.supplierId);
  view().innerHTML = `<div class="crumb"><a onclick="go('#/pos')">Purchase orders</a> / ${esc(o.number)}</div>` +
    pageHead(`Purchase Order <span class="mono">${esc(o.number)}</span> ${pill(o.status)}`, locked ? `Received ${fmtDate(o.receivedDate)} — stock has been added.` : 'Editable until received.',
      `${sup && sup.phone ? `<button class="btn wa" onclick="sendPO('${o.id}')">Send to supplier</button>` : ''}
       ${!locked && o.status !== 'Cancelled' ? `<button class="btn primary" onclick="receivePO('${o.id}')">✔ Mark received</button>` : ''}
       ${locked ? `<button class="btn" onclick="unreceivePO('${o.id}')">Undo receive</button>` : ''}
       ${o.status === 'Ordered' ? `<button class="btn danger" onclick="poSet('${o.id}','status','Cancelled',true)">Cancel PO</button>` : ''}
       ${!locked ? `<button class="btn danger" onclick="deletePO('${o.id}')">Delete</button>` : ''}`) +
    `<div class="card mb card-pad grid g4">
      ${field('Supplier', `<select ${locked ? 'disabled' : ''} onchange="poSet('${o.id}','supplierId',this.value,true)"><option value="">—</option>${S.suppliers.map(s => `<option value="${s.id}" ${s.id === o.supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`)}
      ${field('Date', `<input type="date" value="${esc(o.date)}" ${locked ? 'disabled' : ''} onchange="poSet('${o.id}','date',this.value)">`)}
      ${field('Supplier invoice / ref', `<input value="${esc(o.ref || '')}" oninput="poSet('${o.id}','ref',this.value)">`)}
      ${field('Notes', `<input value="${esc(o.notes || '')}" oninput="poSet('${o.id}','notes',this.value)">`)}
      ${locked ? field('Supplier bill paid on', `<div class="row" style="flex-wrap:nowrap"><input type="date" value="${esc(o.paidDate || '')}" onchange="poSet('${o.id}','paidDate',this.value,true)">${o.paidDate ? pill('Paid') : pill('Unpaid', 'red')}</div>`) : ''}
      ${locked ? field('Paid by', `<select onchange="poSet('${o.id}','paidMethod',this.value)"><option value="">—</option>${S.settings.lists.paymentMethod.map(x => `<option ${x === o.paidMethod ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`) : ''}</div>
    <div class="card"><div class="card-head"><h3>Items</h3>${locked ? '' : `<div class="actions"><button class="btn sm" onclick="poAddItem('${o.id}')">＋ Add part</button></div>`}</div>
      <div class="tbl-wrap"><table class="tbl items-tbl"><thead><tr><th>Part</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th><th></th></tr></thead><tbody>
      ${(o.items || []).map((it, i) => `<tr><td><b>${esc(it.desc)}</b></td>
        <td class="qty"><input class="inp right" type="number" value="${esc(it.qty)}" ${locked ? 'disabled' : ''} onchange="poItem('${o.id}',${i},'qty',this.value)"></td>
        <td class="rate"><input class="inp right" type="number" value="${esc(it.cost)}" ${locked ? 'disabled' : ''} onchange="poItem('${o.id}',${i},'cost',this.value)"></td>
        <td class="num">${money(num(it.qty) * num(it.cost), false)}</td><td class="del">${locked ? '' : `<button class="icon-btn" style="font-size:15px" onclick="poItem('${o.id}',${i},'_del')">✕</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No items</td></tr>'}
      </tbody><tfoot><tr><td>Total</td><td></td><td></td><td class="num">${money(tot)}</td><td></td></tr></tfoot></table></div></div>`;
};
async function poSet(id, k, v, redraw) { const o = get('purchaseOrders', id); o[k] = v; await save('purchaseOrders', o); if (redraw) render(); }
async function poItem(id, i, k, v) { const o = get('purchaseOrders', id); if (k === '_del') o.items.splice(i, 1); else o.items[i][k] = num(v); await save('purchaseOrders', o); render(); }
function poAddItem(id) {
  const o = get('purchaseOrders', id);
  pickFrom({
    title: 'Add part to PO', items: () => stockTable(), filter: (r, q) => [r.p.name, r.p.partNumber, r.p.fits].join(' ').toLowerCase().includes(q),
    row: r => `<div class="row"><b class="grow">${esc(r.p.name)}</b><span class="small muted">on hand ${fmtNum(r.onHand)} · reorder ${fmtNum(r.p.reorderLevel)}</span><b style="width:100px;text-align:right">${money(r.p.cost)}</b></div>`,
    onPick: async r => { o.items = o.items || []; o.items.push({ partId: r.p.id, desc: r.p.name, qty: 1, cost: num(r.p.cost) }); if (!o.supplierId && r.p.supplierId) o.supplierId = r.p.supplierId; await save('purchaseOrders', o); render(); },
    addNew: { label: 'New part', fn: q => editPart(null, { name: q }, async p => { o.items.push({ partId: p.id, desc: p.name, qty: 1, cost: num(p.cost) }); await save('purchaseOrders', o); render(); }) },
  });
}
async function receivePO(id) {
  const o = get('purchaseOrders', id);
  if (!(o.items || []).length) return toast('Add items first', 'err');
  const changed = o.items.filter(it => { const p = get('parts', it.partId); return p && num(p.cost) !== num(it.cost); });
  o.status = 'Received'; o.receivedDate = today(); await save('purchaseOrders', o);
  if (changed.length && await confirmBox(`${changed.length} part(s) arrived at a different cost. Update the unit cost on those parts to the new price?`, 'Update costs')) {
    for (const it of changed) { const p = get('parts', it.partId); p.cost = num(it.cost); await save('parts', p); }
  }
  toast('Received — stock updated', 'ok'); render();
}
async function unreceivePO(id) { if (!(await confirmBox('Undo receiving? The quantities will be removed from stock again.'))) return; const o = get('purchaseOrders', id); o.status = 'Ordered'; o.receivedDate = ''; await save('purchaseOrders', o); render(); }
async function deletePO(id) { if (!(await confirmBox('Delete this purchase order?', 'Delete', true))) return; await remove('purchaseOrders', id); go('#/pos'); }
function sendPO(id) {
  const o = get('purchaseOrders', id), s = get('suppliers', o.supplierId);
  const text = `Dear ${s.contact || s.name},\n\nPlease supply the following (PO ${o.number}):\n\n${(o.items || []).map(it => { const p = get('parts', it.partId) || {}; return `• ${it.desc}${p.partNumber ? ' [' + p.partNumber + ']' : ''} — qty ${fmtNum(it.qty)}`; }).join('\n')}\n\nPlease confirm price and delivery.\n\nThank you,\n${S.settings.garageName}\n${S.settings.phone}`;
  openMessageDialog({ customer: { name: s.name, phone: s.phone, email: s.email }, type: 'po', text, subject: `Purchase order ${o.number} — ${S.settings.garageName}` });
}

/* =================== SUPPLIERS =================== */
const supplierFields = () => [
  { k: 'name', label: 'Supplier name', req: true, span: 2 }, { k: 'contact', label: 'Contact person' }, { k: 'phone', label: 'Phone / WhatsApp' },
  { k: 'email', label: 'Email', type: 'email' }, { k: 'trn', label: 'TRN' }, { k: 'category', label: 'Supplies (category)', span: 2 },
  { k: 'terms', label: 'Payment terms', list: ['Cash', '7 days', '15 days', '30 days credit', '60 days credit'] }, { k: 'address', label: 'Address' },
  { k: 'notes', label: 'Notes', type: 'textarea', span: 'all' }];
function editSupplier(id) {
  const s = get('suppliers', id);
  openForm({
    title: s ? 'Edit supplier' : 'New supplier', fields: supplierFields(), data: s || {},
    onSave: async vals => { const o = s ? Object.assign(s, vals) : vals; if (!o.code) o.code = await nextNo('supplier'); await save('suppliers', o); render(); },
    onDelete: s ? async () => { if (S.parts.some(p => p.supplierId === s.id) || S.purchaseOrders.some(p => p.supplierId === s.id)) { toast('Supplier is linked to parts or POs', 'err'); return false; } if (!(await confirmBox('Delete supplier?', 'Delete', true))) return false; await remove('suppliers', s.id); render(); return true; } : null,
  });
}
PAGES.suppliers = () => {
  const val = stockTable();
  view().innerHTML = pageHead('Suppliers', 'Who you buy parts from.', `<button class="btn primary" onclick="editSupplier()">＋ Add supplier</button>`) +
    `<div class="card">${table([{ h: 'Code', v: s => `<span class="small muted">${esc(s.code || '')}</span>` }, { h: 'Supplier', v: s => `<b>${esc(s.name)}</b>` }, { h: 'Contact', v: s => esc(s.contact || '') }, { h: 'Phone', v: s => esc(s.phone || '') },
      { h: 'Email', v: s => esc(s.email || '') }, { h: 'Supplies', v: s => esc(s.category || '') }, { h: 'Terms', v: s => esc(s.terms || '') },
      { h: 'Parts', cls: 'num', v: s => S.parts.filter(p => p.supplierId === s.id).length }, { h: 'Stock value', cls: 'num', v: s => money(val.filter(r => r.p.supplierId === s.id).reduce((a, r) => a + r.value, 0), false) },
      { h: 'Open POs', cls: 'num', v: s => S.purchaseOrders.filter(p => p.supplierId === s.id && p.status === 'Ordered').length }],
      S.suppliers, { click: s => `editSupplier('${s.id}')`, empty: 'No suppliers yet.' })}</div>`;
};

/* =================== LABOUR CATALOGUE =================== */
const labourFields = () => [
  { k: 'name', label: 'Operation', req: true, span: 2, ph: 'Engine oil & filter change' },
  { k: 'category', label: 'Category', list: ['Service', 'Engine', 'Brakes', 'Suspension', 'Electrical', 'AC', 'Transmission', 'Tyres', 'Body', 'Diagnostics'] },
  { k: 'hours', label: 'Standard hours', type: 'number', req: true, def: 1 },
  { k: 'rate', label: `Rate per hour (blank = default ${S.settings.labourRate})`, type: 'number' },
  { k: 'serviceItem', label: 'Service item it resets', type: 'select', options: () => S.settings.serviceItems.map(s => s.name) },
];
function editLabour(id, preset = {}) {
  const l = get('labour', id);
  openForm({
    title: l ? 'Edit labour operation' : 'New labour operation', fields: labourFields(), data: l || preset,
    onSave: async vals => { const o = l ? Object.assign(l, vals) : vals; if (!o.code) o.code = await nextNo('labour'); await save('labour', o); render(); },
    onDelete: l ? async () => { if (!(await confirmBox('Delete this operation?', 'Delete', true))) return false; await remove('labour', l.id); render(); return true; } : null,
  });
}
PAGES.labour = () => {
  const list = [...S.labour].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
  view().innerHTML = pageHead('Labour Catalogue', `Standard operations with fixed hours — pick them on quotes and job cards. Default rate: ${money(S.settings.labourRate)}/h.`, `<button class="btn primary" onclick="editLabour()">＋ Add operation</button>`) +
    `<div class="card">${table([{ h: 'Code', v: l => `<span class="small muted">${esc(l.code || '')}</span>` }, { h: 'Operation', v: l => `<b>${esc(l.name)}</b>` }, { h: 'Category', v: l => esc(l.category || '') },
      { h: 'Hours', cls: 'num', v: l => fmtNum(l.hours) }, { h: 'Rate', cls: 'num', v: l => money(l.rate || S.settings.labourRate, false) }, { h: 'Price', cls: 'num', v: l => `<b>${money(num(l.hours) * num(l.rate || S.settings.labourRate), false)}</b>` },
      { h: 'Resets service item', v: l => l.serviceItem ? pill(l.serviceItem, 'blue') : '' }],
      list, { click: l => `editLabour('${l.id}')`, empty: 'No labour operations yet.' })}</div>`;
};

/* =================== TECHNICIANS =================== */
const techFields = () => [
  { k: 'name', label: 'Name', req: true }, { k: 'trade', label: 'Trade / speciality', type: 'select', options: S.settings.lists.trade },
  { k: 'phone', label: 'Phone' }, { k: 'costRate', label: 'Cost to garage per hour', type: 'number', help: 'Salary + benefits ÷ working hours — used to show contribution' },
  { k: 'active', label: 'Active', type: 'checkbox', def: true }];
function editTech(id) {
  const t = get('technicians', id);
  openForm({
    title: t ? 'Edit technician' : 'New technician', fields: techFields(), data: t || { active: true },
    onSave: async vals => { const o = t ? Object.assign(t, vals) : vals; if (!o.code) o.code = await nextNo('tech'); await save('technicians', o); render(); },
    onDelete: t ? async () => { if (S.jobs.some(j => j.technicianId === t.id)) { toast('Technician has jobs — untick Active instead.', 'err'); return false; } if (!(await confirmBox('Delete technician?', 'Delete', true))) return false; await remove('technicians', t.id); render(); return true; } : null,
  });
}
function techStats(t, month) {
  let hours = 0, revenue = 0; const jobs = new Set(), delivered = new Set();
  for (const j of S.jobs) {
    if (j.status === 'Cancelled' || (month && monthKey(j.date) !== month)) continue;
    if (j.technicianId === t.id) { jobs.add(j.id); if (DONE_JOB.includes(j.status)) delivered.add(j.id); }
    for (const it of j.items || []) if (it.type === 'labour' && (it.technicianId || j.technicianId) === t.id) { hours += num(it.qty); revenue += lineTotal(it); }
  }
  const cost = hours * num(t.costRate);
  return { jobs: jobs.size, delivered: delivered.size, hours: r2(hours), revenue: r2(revenue), cost: r2(cost), contribution: r2(revenue - cost) };
}
PAGES.technicians = () => {
  const m = getFilter('technicians', 'month', monthKey(today()));
  const months = [...new Set([monthKey(today()), ...S.jobs.map(j => monthKey(j.date))])].sort().reverse();
  view().innerHTML = pageHead('Technicians', 'Productivity: hours billed, labour revenue and contribution per person.', `<button class="btn primary" onclick="editTech()">＋ Add technician</button>`) +
    `<div class="filters"><select class="inp" onchange="setFilter('technicians','month',this.value)"><option value="">All time</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${new Date(x + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="card">${table([{ h: 'Name', v: t => `<b>${esc(t.name)}</b> ${t.active === false ? pill('Inactive') : ''}` }, { h: 'Trade', v: t => esc(t.trade || '') }, { h: 'Phone', v: t => esc(t.phone || '') },
      { h: 'Jobs', cls: 'num', v: t => techStats(t, m).jobs }, { h: 'Completed', cls: 'num', v: t => techStats(t, m).delivered }, { h: 'Hours billed', cls: 'num', v: t => fmtNum(techStats(t, m).hours) },
      { h: 'Labour revenue', cls: 'num', v: t => money(techStats(t, m).revenue, false) }, { h: 'Labour cost', cls: 'num', v: t => money(techStats(t, m).cost, false) },
      { h: 'Contribution', cls: 'num', v: t => { const c = techStats(t, m).contribution; return `<b class="${c < 0 ? 'red' : 'green'}">${money(c, false)}</b>`; } }],
      S.technicians, { click: t => `editTech('${t.id}')`, empty: 'No technicians yet.' })}</div>`;
};
