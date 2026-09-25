/* mendtech. — partner services (v3.3): car wash, recovery, tinting, body shop, detailing…
   A partner's service goes on the job as a normal line: the customer pays your price, the partner's cost is
   tracked, the difference is your margin. The partner page shows what you owe and records payments. */
'use strict';

const PARTNER_TYPES = ['Car wash', 'Recovery / towing', 'Window tinting', 'Body shop', 'Detailing / polishing', 'Tyre supplier', 'Other'];
const partnerLines = pid => {
  const out = [];
  for (const inv of S.invoices) { if (inv.void) continue; (inv.items || []).forEach(it => { if (it.partnerId === pid) out.push({ inv, it }); }); }
  return out.sort((a, b) => (b.inv.date || '').localeCompare(a.inv.date || ''));
};
function partnerTotals(pid) {
  const lines = partnerLines(pid), cost = r2(lines.reduce((a, x) => a + num(x.it.qty) * num(x.it.cost), 0));
  const sales = r2(lines.reduce((a, x) => a + lineTotal(x.it), 0));
  const paid = r2(S.expenses.filter(e => e.partnerId === pid).reduce((a, e) => a + num(e.amount), 0));
  return { jobs: lines.length, sales, cost, margin: r2(sales - cost), paid, owed: r2(cost - paid) };
}

PAGES.partners = id => id ? partnerPage(id) : partnersList();
function partnersList() {
  view().innerHTML = pageHead('🤝 Partners', 'Services you arrange through partners. Add them to a job card with "＋ Partner service".', `<button class="btn primary" onclick="editPartner()">＋ Add partner</button>`) +
    `<div class="card">${table([{ h: 'Partner', v: p => `<b>${esc(p.name)}</b><div class="small muted">${esc(p.type || '')}${p.phone ? ' · ' + esc(p.phone) : ''}</div>` },
      { h: 'Jobs', cls: 'num', v: p => partnerTotals(p.id).jobs }, { h: 'Your margin', cls: 'num', v: p => Auth.can('finance') ? money(partnerTotals(p.id).margin, false) : '—' },
      { h: 'You owe', cls: 'num', v: p => { const o = partnerTotals(p.id).owed; return o > 0 ? `<b class="red">${money(o, false)}</b>` : money(o, false); } },
      { h: 'Status', v: p => p.active === false ? pill('Inactive') : pill('Active') }],
      S.partners, { click: p => `go('#/partners/${p.id}')`, empty: 'No partners yet — add your car wash or recovery partner.', emptyIcon: '🤝' })}</div>`;
}
function partnerPage(id) {
  const p = get('partners', id); if (!p) return go('#/partners');
  const t = partnerTotals(id), lines = partnerLines(id), pays = S.expenses.filter(e => e.partnerId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  view().innerHTML = pageHead(`🤝 ${esc(p.name)}`, `${esc(p.type || '')}${p.phone ? ' · ' + esc(p.phone) : ''}${p.services ? ' · ' + esc(p.services) : ''}`,
    `<button class="btn" onclick="editPartner('${id}')">Edit</button>${p.phone ? `<button class="btn wa" onclick="window.open(waLink(${jsq(p.phone)}, ''), '_blank')">WhatsApp</button>` : ''}<button class="btn primary" onclick="payPartner('${id}')">💸 Record payment</button>`) +
    `<div class="grid g4 mb"><div class="kpi"><div class="lbl">Jobs</div><div class="val">${t.jobs}</div></div>
      <div class="kpi"><div class="lbl">Customers paid</div><div class="val">${money(t.sales, false)}</div></div>
      ${Auth.can('finance') ? `<div class="kpi"><div class="lbl">Your margin</div><div class="val green">${money(t.margin, false)}</div></div>` : ''}
      <div class="kpi"><div class="lbl">You owe ${esc(p.name)}</div><div class="val ${t.owed > 0 ? 'red' : ''}">${money(t.owed, false)}</div><div class="hint">cost ${money(t.cost, false)} − paid ${money(t.paid, false)}</div></div></div>
    <div class="grid g2"><div class="card"><div class="card-head"><h3>Services sold</h3></div>${table([{ h: 'Date', v: x => fmtDate(x.inv.date) }, { h: 'Invoice', v: x => `<a onclick="go('#/invoice/${x.inv.id}')">${esc(x.inv.number)}</a>` },
      { h: 'Service', v: x => esc(x.it.desc) }, { h: 'Price', cls: 'num', v: x => money(lineTotal(x.it), false) }, { h: 'Partner cost', cls: 'num', v: x => money(num(x.it.qty) * num(x.it.cost), false) }], lines, { empty: 'Nothing yet.' })}</div>
      <div class="card"><div class="card-head"><h3>Payments to partner</h3></div>${table([{ h: 'Date', v: e => fmtDate(e.date) }, { h: 'Reference', v: e => esc(e.reference || '') }, { h: 'Amount', cls: 'num', v: e => money(e.amount, false) }], pays, { empty: 'No payments recorded.' })}</div></div>`;
}
function editPartner(id) {
  const p = get('partners', id);
  openForm({
    title: p ? 'Edit partner' : 'New partner', cols: 2,
    fields: [{ k: 'name', label: 'Name', req: true, span: 2 }, { k: 'type', label: 'Type', type: 'select', options: PARTNER_TYPES, def: 'Car wash', blank: false },
      { k: 'phone', label: 'Phone / WhatsApp' }, { k: 'services', label: 'Services & their prices to you', span: 2, ph: 'e.g. Exterior wash 25, full valet 120' },
      { k: 'defaultCost', label: 'Usual cost to you (AED)', type: 'number' }, { k: 'defaultPrice', label: 'Usual price to customer (AED)', type: 'number' },
      { k: 'active', label: 'Active', type: 'checkbox', def: true }],
    data: p || { active: true },
    onSave: async vals => { const o = await save('partners', p ? Object.assign(p, vals) : vals); render(); if (!p) go('#/partners/' + o.id); },
    onDelete: p ? async () => { if (partnerLines(p.id).length) { toast('This partner is on invoices — untick Active instead', 'err'); return false; } if (!(await confirmBox(`Delete ${p.name}?`, 'Delete', true))) return false; await remove('partners', p.id); go('#/partners'); return true; } : null,
  });
}
/* job card / quote / invoice: add a partner service line */
function edAddPartner() {
  const ps = S.partners.filter(p => p.active !== false);
  if (!ps.length) return confirmBox('No partners yet. Add one now?', 'Add partner').then(y => y && editPartner());
  const m = openModal({
    title: '＋ Partner service', size: 'narrow',
    body: `<div class="field"><label>Partner</label><select id="pp_p">${ps.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.type || '')}</option>`).join('')}</select></div>
      <div class="field"><label>Service</label><input id="pp_d" placeholder="e.g. Full valet"></div>
      <div class="grid g2"><div class="field"><label>Customer price (AED)</label><input id="pp_r" type="number"></div><div class="field"><label>Partner's cost to you (AED)</label><input id="pp_c" type="number"></div></div>`,
    foot: `<button class="btn" data-close2>Cancel</button><button class="btn primary" data-ok>Add to ${esc(ED.kind === 'quote' ? 'quote' : ED.kind === 'invoice' ? 'invoice' : 'job')}</button>`,
  });
  const $m = s => m.el.querySelector(s);
  const fill = () => { const p = get('partners', $m('#pp_p').value); $m('#pp_d').value = p.type || ''; $m('#pp_r').value = p.defaultPrice || ''; $m('#pp_c').value = p.defaultCost || ''; };
  $m('#pp_p').onchange = fill; fill();
  $m('[data-close2]').onclick = m.close;
  $m('[data-ok]').onclick = () => {
    const p = get('partners', $m('#pp_p').value);
    if (!$m('#pp_d').value.trim()) return toast('Enter the service', 'err');
    m.close();
    edPushItem({ type: 'other', desc: `${$m('#pp_d').value.trim()} (${p.name})`, qty: 1, rate: num($m('#pp_r').value), cost: num($m('#pp_c').value), partnerId: p.id });
  };
}
function payPartner(id) {
  const p = get('partners', id), t = partnerTotals(id);
  openForm({
    title: `Pay ${p.name}`, cols: 2,
    fields: [{ k: 'date', label: 'Date', type: 'date', def: today(), req: true }, { k: 'amount', label: 'Amount (AED)', type: 'number', req: true, def: t.owed > 0 ? t.owed : '' },
      { k: 'method', label: 'Paid by', type: 'select', options: S.settings.lists.paymentMethod }, { k: 'reference', label: 'Reference' }],
    onSave: async vals => {
      if (guardClosed(vals.date, 'That date')) return false;
      await save('expenses', { ...vals, category: 'Partner payments', description: `Payment to ${p.name}`, paidTo: p.name, partnerId: p.id, vat: 0 });
      toast('Payment recorded as an expense', 'ok'); render();
    },
  });
}
