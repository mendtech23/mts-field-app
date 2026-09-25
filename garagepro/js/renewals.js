/* mendtech. — registration (Mulkiya) renewal tracker (v3.3)
   Cars expiring soon → renewal job → insurance → passing test → renewed → delivered. Your service fee is invoiced
   with VAT; government fees paid on the customer's behalf go on a separate 0 % VAT invoice. */
'use strict';

const RENEWAL_STAGES = ['Due', 'Customer agreed', 'Insurance done', 'Test passed', 'Renewed', 'Delivered'];
const RENEWAL_DOCS = ['Emirates ID copy', 'Old Mulkiya', 'Insurance renewed', 'Traffic fines cleared', 'Passing test done', 'Government fees paid'];
const renewalOpen = r => !['Delivered', 'Declined'].includes(r.stage);
function renewalsDueList() {
  const active = new Set(S.renewals.filter(renewalOpen).map(r => r.vehicleId));
  return S.vehicles.filter(v => (!v.status || v.status === 'Active') && v.regExpiry && daysLeft(v.regExpiry) <= 45 && daysLeft(v.regExpiry) >= -90 && !active.has(v.id))
    .sort((a, b) => a.regExpiry.localeCompare(b.regExpiry));
}
function renewalsDue() { return renewalsDueList().length + S.renewals.filter(renewalOpen).length; }

PAGES.renewals = () => {
  const due = renewalsDueList(), open = S.renewals.filter(renewalOpen), fee = num(S.settings.offers.renewalFee);
  const done = S.renewals.filter(r => !renewalOpen(r)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 20);
  const card = r => { const v = get('vehicles', r.vehicleId) || {}, c = get('customers', r.customerId) || {}, docs = Object.values(r.docs || {}).filter(Boolean).length;
    return `<div class="card card-pad mb dcard" style="cursor:pointer" onclick="openRenewal('${r.id}')">${plateTag(v)} <b>${esc(vehicleLabel(v))}</b>
      <div class="small muted">${esc(c.name || '')} · ${r.newExpiry && ['Renewed', 'Delivered'].includes(r.stage) ? `renewed to ${fmtDate(r.newExpiry)}` : `expires ${fmtDate(r.expiry)}${daysLeft(r.expiry) < 0 ? ' <b class="red">(expired)</b>' : ''}`}</div>
      <div class="small">${docs}/${RENEWAL_DOCS.length} documents</div></div>`; };
  view().innerHTML = pageHead('🪪 Registration renewals', `Mulkiya renewals you handle for customers. Your service fee: ${money(fee)} (Settings → Invoices & numbering → Services & offers).`) +
    `<div class="card mb"><div class="card-head"><h3>Expiring in the next 45 days — not started</h3><span class="small muted">${due.length}</span></div>
      ${due.length ? due.map(v => { const c = customerOf(v) || {}, dl = daysLeft(v.regExpiry); return `<div class="alert-row"><div class="grow">${plateTag(v)} <b>${esc(vehicleLabel(v))}</b>
        <div class="small muted">${esc(c.name || '')} · ${dl < 0 ? `<b class="red">expired ${-dl} days ago</b>` : `expires in ${dl} days (${fmtDate(v.regExpiry)})`}</div></div>
        <button class="btn sm wa" onclick="openMessageDialog({vehicle:get('vehicles','${v.id}'),type:'regExpiry',text:fillTemplate(S.settings.templates.regExpiry,{...baseCtx(get('vehicles','${v.id}'),customerOf(get('vehicles','${v.id}'))),date:fmtDate('${v.regExpiry}')})})">Offer help</button>
        <button class="btn sm primary" onclick="startRenewal('${v.id}')">Start renewal</button></div>`; }).join('') : '<div class="empty" style="padding:18px">Nothing expiring soon.</div>'}</div>
    <div class="kanban" style="display:grid;grid-template-columns:repeat(${RENEWAL_STAGES.length - 1}, minmax(180px, 1fr));gap:12px;overflow-x:auto">
      ${RENEWAL_STAGES.slice(0, -1).map(s => `<div><div class="fieldset-title" style="margin-bottom:8px">${esc(s)} (${open.filter(r => r.stage === s).length})</div>${open.filter(r => r.stage === s).map(card).join('') || '<div class="small faint">—</div>'}</div>`).join('')}</div>
    ${done.length ? `<h3 class="mt mb" style="font-size:15px">Recently finished</h3><div class="card">${table([{ h: 'Car', v: r => plateTag(get('vehicles', r.vehicleId) || {}) }, { h: 'Customer', v: r => esc((get('customers', r.customerId) || {}).name || '') }, { h: 'Result', v: r => pill(r.stage === 'Delivered' ? 'Delivered' : 'Declined') }, { h: 'New expiry', v: r => fmtDate(r.newExpiry) }], done, { click: r => `openRenewal('${r.id}')` })}</div>` : ''}`;
};
async function startRenewal(vid) {
  const v = get('vehicles', vid);
  const r = await save('renewals', { vehicleId: v.id, customerId: v.customerId, expiry: v.regExpiry, stage: 'Due', fee: num(S.settings.offers.renewalFee), govFees: '', docs: {}, notes: '' });
  render(); openRenewal(r.id);   // render() first: it closes open windows
}
function openRenewal(id) {
  const r = get('renewals', id), v = get('vehicles', r.vehicleId) || {}, c = get('customers', r.customerId) || {};
  const m = openModal({
    title: `🪪 Renewal — ${esc(v.plate || '')}`, size: 'wide',
    body: `<div class="small muted mb">${esc(vehicleLabel(v))} · ${esc(c.name || '')} ${esc(c.phone || '')} · current expiry ${fmtDate(r.expiry)}</div>
      <div class="stepper mb">${RENEWAL_STAGES.map(s => `<div class="st ${s === r.stage ? 'on' : RENEWAL_STAGES.indexOf(s) < RENEWAL_STAGES.indexOf(r.stage) ? 'done' : ''}" data-st="${esc(s)}">${esc(s)}</div>`).join('')}</div>
      <div class="grid g2"><div><div class="fieldset-title" style="margin-bottom:6px">Documents &amp; steps</div>
        ${RENEWAL_DOCS.map(d => `<label class="row small" style="padding:4px 0"><input type="checkbox" data-doc="${esc(d)}" ${(r.docs || {})[d] ? 'checked' : ''} style="width:auto"> ${esc(d)}</label>`).join('')}</div>
        <div class="grid" style="gap:10px"><div class="field"><label>Our service fee (AED, + VAT)</label><input id="rn_fee" type="number" value="${esc(r.fee)}"></div>
          <div class="field"><label>Government fees paid for the customer (AED, no VAT)</label><input id="rn_gov" type="number" value="${esc(r.govFees || '')}"></div>
          <div class="field"><label>New expiry date</label><input id="rn_new" type="date" value="${esc(r.newExpiry || '')}"></div>
          <div class="field"><label>Notes</label><textarea id="rn_notes">${esc(r.notes || '')}</textarea></div></div></div>`,
    foot: `<button class="btn danger left" data-decl>Customer declined</button>${r.invoiceId ? `<button class="btn" data-inv>Open invoice</button>` : `<button class="btn" data-inv>🧾 Invoice</button>`}<button class="btn primary" data-save>Save</button>`,
  });
  const $m = s => m.el.querySelector(s);
  const collect = () => { r.fee = num($m('#rn_fee').value); r.govFees = $m('#rn_gov').value; r.newExpiry = $m('#rn_new').value; r.notes = $m('#rn_notes').value;
    r.docs = {}; m.el.querySelectorAll('[data-doc]').forEach(x => { if (x.checked) r.docs[x.dataset.doc] = today(); }); };
  const persist = async () => {
    collect();
    if (['Renewed', 'Delivered'].includes(r.stage) && r.newExpiry && v.id && v.regExpiry !== r.newExpiry) { v.regExpiry = r.newExpiry; await save('vehicles', v); }
    await save('renewals', r);
  };
  m.el.querySelectorAll('[data-st]').forEach(x => x.onclick = async () => {
    r.stage = x.dataset.st;
    if (['Renewed', 'Delivered'].includes(r.stage) && !$m('#rn_new').value) { toast('Enter the new expiry date', 'err'); $m('#rn_new').focus(); return; }
    await persist(); m.close(); render(); openRenewal(r.id);
  });
  $m('[data-save]').onclick = async () => { await persist(); toast('Saved', 'ok'); m.close(); render(); };
  $m('[data-decl]').onclick = async () => { r.stage = 'Declined'; await persist(); m.close(); render(); };
  $m('[data-inv]').onclick = async () => {
    await persist();
    if (r.invoiceId) { m.close(); return go('#/invoice/' + r.invoiceId); }
    const base = { date: today(), vehicleId: v.id, customerId: c.id, discount: 0, discountType: 'pct', dueDate: today(), line: 'auto' };
    const inv = await save('invoices', { ...base, number: await nextNo('invoice'), vatRate: S.settings.vatRate, workDone: `Registration renewal for ${v.plate}${r.newExpiry ? ' — new expiry ' + fmtDate(r.newExpiry) : ''}`,
      items: [{ type: 'labour', desc: 'Registration renewal service', qty: 1, rate: r.fee, cost: 0 }] });
    r.invoiceId = inv.id;
    if (num(r.govFees) > 0) {
      const g = await save('invoices', { ...base, number: await nextNo('invoice'), vatRate: 0, workDone: 'Government fees paid on your behalf (no VAT)',
        items: [{ type: 'other', desc: 'Government fees — registration renewal (paid on your behalf)', qty: 1, rate: num(r.govFees), cost: num(r.govFees) }] });
      r.govInvoiceId = g.id;
    }
    await save('renewals', r); m.close(); toast(`Invoice ${inv.number} created${r.govInvoiceId ? ' + government fees invoice' : ''}`, 'ok'); go('#/invoice/' + inv.id);
  };
}
