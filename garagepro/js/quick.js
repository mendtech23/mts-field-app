/* mendtech. — quicker daily work (v3.9)
   · Advance / deposit on a job: money taken before the invoice (e.g. 3,000 for parts). It is a payment linked to the job
     (jobId, no invoiceId yet), so Cash & bank and the day report count it at once; creating the invoice attaches it.
   · Quick past job: one form → customer / car (if new) + job + invoice + payment, all on the job's date.
   · Invoice date follows the job when the job is from an earlier day; "not known yet" plates (TEMP-…); missing-info list.
   · Repeat an expense (fuel, the same supplier…). */
'use strict';

const defaultJobType = () => S.settings.lists.jobType.includes('Mechanical Repair') ? 'Mechanical Repair' : S.settings.lists.jobType[0];

/* ---------- advances ---------- */
const jobAdvances = j => S.payments.filter(p => p.jobId === j.id && !p.invoiceId);
const advanceTotal = j => r2(jobAdvances(j).reduce((a, p) => a + num(p.amount), 0));
const customerAdvances = cid => S.payments.filter(p => p.customerId === cid && p.jobId && !p.invoiceId);
function advanceCardHTML(j) {
  if (isMobile(j) || !Auth.canPage('invoice') || jobInvoice(j)) return '';
  const list = jobAdvances(j);
  return `<div class="card mb"><div class="card-head"><h3>💵 Advance / deposit</h3>${j.status !== 'Cancelled' ? `<div class="actions"><button class="btn sm primary" onclick="recordAdvance('${j.id}')">＋ Record advance</button></div>` : ''}</div>
    ${list.length ? list.map(p => `<div class="alert-row"><div class="grow"><b>${money(p.amount)}</b> <span class="muted small">${esc(p.method || '')}</span><div class="small faint">${esc(p.number)} · ${fmtDate(p.date)}${p.reference ? ' · ' + esc(p.reference) : ''}</div></div>
      <button class="btn sm ghost" title="Receipt" onclick="receiptActions('${p.id}')">🧾</button><button class="btn sm ghost" title="Delete" onclick="deletePayment('${p.id}')">✕</button></div>`).join('')
      + `<div class="card-pad small muted">Total ${money(advanceTotal(j))} — taken off the invoice automatically when you create it.</div>`
      : '<div class="card-pad small muted">Customer paid something before the work is finished (e.g. for parts)? Record it here — it shows in Cash & bank today and comes off the invoice later.</div>'}</div>`;
}
function recordAdvance(jobId) {
  const j = get('jobs', jobId); if (!j) return;
  openForm({
    title: `Advance — ${esc(j.number)}`, size: 'narrow', saveLabel: 'Save advance',
    fields: [{ k: 'amount', label: `Amount (${S.settings.currency})`, type: 'number', req: true },
      { k: 'date', label: 'Date received', type: 'date', req: true, def: today() },
      { k: 'method', label: 'Method', type: 'select', options: S.settings.lists.paymentMethod, def: 'Cash', blank: false },
      { k: 'reference', label: 'Note / reference', ph: 'e.g. for parts' }],
    onSave: async vals => {
      if (num(vals.amount) <= 0) throw new Error('Amount must be more than zero');
      if (guardClosed(vals.date, 'That date')) return false;
      await edFlush();
      const p = await save('payments', { ...vals, amount: num(vals.amount), number: await nextNo('receipt'), jobId: j.id, invoiceId: '', advance: true, customerId: j.customerId, vehicleId: j.vehicleId });
      toast(`Advance ${p.number} saved — ${money(p.amount)}`, 'ok'); render();
      setTimeout(async () => { if (await confirmBox(`Send receipt ${p.number} to the customer?`, 'Send receipt')) openSendDialog('receipt', p, {}); }, 100);
    },
  });
}
/* what a receipt says it is for: an invoice, or an advance on a job card */
function receiptRef(p, inv) {
  const j = p.jobId && get('jobs', p.jobId);
  if (inv && inv.number) return { label: 'Invoice no.', no: inv.number, desc: `Payment against invoice ${inv.number}${p.advance && j ? ` (advance on job ${j.number})` : ''}` };
  if (j) return { label: 'Job card no.', no: j.number, desc: `Advance payment — job ${j.number}` };
  return { label: 'Invoice no.', no: '', desc: 'Payment' };
}
function advanceReceiptText(p) {
  const j = get('jobs', p.jobId) || {}, v = get('vehicles', p.vehicleId), c = get('customers', p.customerId);
  return fillTemplate('Dear {customer},\n\nWe have received your advance payment of {amount} ({method}) for job {number} on your {vehicle} ({plate}). Receipt no. {receipt}.\nIt will be taken off your final invoice.\n\nThank you!\n{garage}',
    { ...baseCtx(v, c), amount: money(p.amount), method: p.method || '', number: j.number || '', receipt: p.number });
}
/* when the invoice is made from the job, its advances become payments on that invoice */
async function attachAdvances(j, inv) {
  for (const p of jobAdvances(j)) { p.invoiceId = inv.id; await save('payments', p); }
}
/* the invoice date: today, or the job's own (earlier) date — asked only when the job is from an earlier day */
async function pickInvoiceDate(j) {
  const t = today(), cand = [j.completed, j.date].map(x => (x || '').slice(0, 10)).find(x => x && x < t);
  if (!cand || isClosedPeriod(cand)) return t;
  return (await confirmBox(`This job is from ${fmtDate(cand)}. Date the invoice ${fmtDate(cand)} (when the work was done) or today?`, `Use ${fmtDate(cand)}`, false, `Use today (${fmtDate(t)})`)) ? cand : t;
}

/* ---------- "not known yet" ---------- */
const isTempPlate = v => !!v && (!!v.plateUnknown || /^TEMP/i.test(v.plate || '') || /[A-Z]{4,}/i.test(String(v.plate || '').replace(/[^A-Za-z]/g, '') ));
async function nextTempPlate() {
  let n = 1; const used = new Set(S.vehicles.map(v => v.plateNorm));
  while (used.has(norm('TEMP-' + String(n).padStart(3, '0')))) n++;
  return 'TEMP-' + String(n).padStart(3, '0');
}
const ownPhone = p => { const d = String(p || '').replace(/\D/g, '').slice(-9); return d.length >= 7 && [S.settings.phone, S.settings.whatsapp].some(x => String(x || '').replace(/\D/g, '').slice(-9) === d); };
function missingInfo() {
  const out = [];
  for (const c of S.customers) {
    const why = [!c.phone && 'no phone', ownPhone(c.phone) && 'garage number used as phone', /unknown|pending/i.test(c.name || '') && 'name not known'].filter(Boolean);
    if (why.length) out.push({ kind: 'customer', id: c.id, label: c.name, why: why.join(', ') });
  }
  for (const v of S.vehicles) {
    if (v.status === 'Sold' || v.status === 'Inactive') continue;
    const used = S.jobs.some(j => j.vehicleId === v.id);
    const why = [isTempPlate(v) && 'plate not known yet', !get('customers', v.customerId) && 'no owner', used && !currentOdo(v) && 'no km reading'].filter(Boolean);
    if (why.length) out.push({ kind: 'vehicle', id: v.id, label: `${v.plate} · ${vehicleLabel(v)}`, why: why.join(', ') });
  }
  return out;
}
const missingRow = m => `<div class="alert-row"><div class="alert-ico" style="background:var(--amberSoft)">${m.kind === 'vehicle' ? '🚗' : '👤'}</div><div class="grow"><b>${esc(m.label)}</b><div class="small muted">${esc(m.why)}</div></div>
  <button class="btn sm" onclick="${m.kind === 'vehicle' ? `editVehicle('${m.id}')` : `editCustomer('${m.id}')`}">Fix</button></div>`;
function missingInfoHTML() {
  if (!Auth.canPage('customers')) return '';
  const list = missingInfo(); if (!list.length) return '';
  return `<div class="card mb"><div class="card-head"><h3>📝 Missing details (${list.length})</h3><div class="actions"><button class="btn sm" onclick="go('#/missing')">All</button></div></div>
    ${list.slice(0, 4).map(missingRow).join('')}</div>`;
}
PAGES.missing = () => {
  const list = missingInfo();
  view().innerHTML = pageHead('Missing details', 'Cars and customers saved with something “not known yet” — fill them in when you have them.') +
    `<div class="card">${list.length ? list.map(missingRow).join('') : '<div class="empty">Nothing missing. 🎉</div>'}</div>`;
};

/* ---------- quick past job ---------- */
function quickPastJob() {
  const vs = [...S.vehicles].sort((a, b) => (a.plate || '').localeCompare(b.plate || '')), cs = [...S.customers].sort((a, b) => a.name.localeCompare(b.name));
  const techs = S.technicians.filter(t => t.active !== false), vat = num(S.settings.vatRate);
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(l)}</option>`;
  const m = openModal({
    title: '⚡ Quick past job', size: 'wide',
    body: `<p class="small muted">For work already done (e.g. from the notebook): one Save makes the job card, the invoice and the payment, all dated on the day of the work.</p>
      <div class="grid g4">
        <div class="field"><label>Date of the work <span class="req">*</span></label><input type="date" id="qj_date" value="${today()}"></div>
        <div class="field span3"><label>Car <span class="req">*</span></label><select id="qj_veh">${opt('', '＋ New car (not in the app yet)')}${vs.map(v => opt(v.id, `${v.plate} · ${vehicleLabel(v)} · ${(customerOf(v) || {}).name || 'no owner'}`)).join('')}</select></div>
      </div>
      <div id="qj_new" class="grid g4">
        <div class="field"><label>Number plate</label><input id="qj_plate" class="plate-input"><label class="small row" style="gap:6px;margin-top:4px"><input type="checkbox" id="qj_noplate" style="width:auto"> Not known yet</label></div>
        <div class="field"><label>Make <span class="req">*</span></label><input id="qj_make" list="qj_makes"><datalist id="qj_makes">${MAKES.map(x => `<option value="${x}">`).join('')}</datalist></div>
        <div class="field"><label>Model <span class="req">*</span></label><input id="qj_model"></div>
        <div class="field"><label>Year</label><input id="qj_year" type="number"></div>
        <div class="field span2"><label>Owner</label><select id="qj_cust">${opt('', '＋ New customer')}${cs.map(c => opt(c.id, `${c.name}${c.phone ? ' — ' + c.phone : ''}`)).join('')}</select></div>
        <div class="field" id="qj_cname_f"><label>New customer name</label><input id="qj_cname"></div>
        <div class="field" id="qj_cphone_f"><label>Mobile (optional)</label><input id="qj_cphone" placeholder="not known yet"></div>
      </div>
      <div class="grid g4">
        <div class="field span2"><label>Work done <span class="req">*</span></label><input id="qj_work" placeholder="e.g. Engine repair + labour"></div>
        <div class="field"><label>Job type</label><select id="qj_type">${S.settings.lists.jobType.map(t => opt(t, t, t === defaultJobType())).join('')}</select></div>
        <div class="field"><label>Technician</label><select id="qj_tech">${opt('', '—')}${techs.map(t => opt(t.id, t.name)).join('')}</select></div>
        <div class="field"><label>Amount charged${vat ? ' (before VAT)' : ''} <span class="req">*</span></label><input id="qj_amount" type="number" step="any"></div>
        <div class="field"><label>Odometer (km)</label><input id="qj_odo" type="number" placeholder="not known"></div>
        <div class="field"><label>Paid?</label><select id="qj_paid">${opt('full', 'Paid in full')}${opt('part', 'Part paid')}${opt('none', 'Not paid yet')}</select></div>
        <div class="field"><label>Payment method</label><select id="qj_method">${S.settings.lists.paymentMethod.map(x => opt(x, x, x === 'Cash')).join('')}</select></div>
        <div class="field" id="qj_paidamt_f"><label>Amount paid</label><input id="qj_paidamt" type="number" step="any"></div>
        <div class="field"><label>Payment date</label><input type="date" id="qj_pdate" value="${today()}"></div>
      </div>`,
    foot: '<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>Save job, invoice & payment</button>',
  });
  const $m = s => m.el.querySelector(s);
  const sync = () => {
    $m('#qj_new').style.display = $m('#qj_veh').value ? 'none' : '';
    const nc = !$m('#qj_cust').value; $m('#qj_cname_f').style.display = $m('#qj_cphone_f').style.display = nc ? '' : 'none';
    $m('#qj_paidamt_f').style.display = $m('#qj_paid').value === 'part' ? '' : 'none';
    $m('#qj_plate').disabled = $m('#qj_noplate').checked;
  };
  let pdTouched = false;
  $m('#qj_pdate').oninput = () => { pdTouched = true; };
  $m('#qj_date').oninput = () => { if (!pdTouched) $m('#qj_pdate').value = $m('#qj_date').value; };
  ['#qj_veh', '#qj_cust', '#qj_paid', '#qj_noplate'].forEach(s => { $m(s).onchange = sync; }); sync();
  $m('[data-c]').onclick = m.close;
  $m('[data-ok]').onclick = async () => {
    const g = s => ($m(s).value || '').trim();
    try {
      const d = g('#qj_date'), amount = num(g('#qj_amount')), work = g('#qj_work'), paid = g('#qj_paid');
      if (!d) throw new Error('Enter the date of the work');
      if (d > today()) throw new Error('The date is in the future');
      if (!work) throw new Error('Write what work was done');
      if (amount <= 0) throw new Error('Enter the amount charged');
      if (guardClosed(d, 'That date')) return;
      const pdate = g('#qj_pdate') || d;
      if (paid !== 'none' && guardClosed(pdate, 'That payment date')) return;
      const total = calcDoc({ items: [{ type: 'labour', fixed: true, qty: 1, rate: amount }], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate }).total;
      const pay = paid === 'full' ? total : paid === 'part' ? num(g('#qj_paidamt')) : 0;
      if (paid === 'part' && (pay <= 0 || pay >= total)) throw new Error(`For “Part paid”, the amount paid must be more than 0 and less than ${money(total)}`);
      let v = get('vehicles', g('#qj_veh'));
      if (!v) {
        if (!g('#qj_make') || !g('#qj_model')) throw new Error('Enter the make and model of the new car');
        if (!$m('#qj_noplate').checked && !g('#qj_plate')) throw new Error('Enter the plate, or tick “Not known yet”');
        let c = get('customers', g('#qj_cust'));
        if (!c) {
          if (!g('#qj_cname')) throw new Error('Pick the owner or type the new customer’s name');
          c = await saveCustomer({ name: g('#qj_cname'), phone: g('#qj_cphone'), type: 'Individual' }); if (!c) return;
        }
        const noPlate = $m('#qj_noplate').checked;
        v = await saveVehicle({ customerId: c.id, plate: noPlate ? await nextTempPlate() : g('#qj_plate').toUpperCase(), plateUnknown: noPlate, make: g('#qj_make'), model: g('#qj_model'), year: g('#qj_year'), emirate: S.settings.lists.emirate[0] || '', status: 'Active', odometer: num(g('#qj_odo')) || '' });
        if (!v) return;
      }
      if (!v.customerId || !get('customers', v.customerId)) throw new Error('This car has no owner yet — open the car and pick the owner first');
      const odo = num(g('#qj_odo'));
      const line = { type: 'labour', fixed: true, desc: work, qty: 1, rate: amount, cost: 0 };
      const base = { vehicleId: v.id, customerId: v.customerId, odometer: odo || '', items: [line], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate };
      const job = await save('jobs', { ...base, number: await nextNo('job'), date: d, completed: d, status: 'Delivered', type: g('#qj_type'), technicianId: g('#qj_tech'), complaint: work, diagnosis: work, quick: true });
      const inv = await save('invoices', { ...structuredClone(base), number: await nextNo('invoice'), date: d, jobId: job.id, line: 'auto', workDone: work, dueDate: addDays(d, invoiceDueDaysFor(v.customerId)) });
      job.invoiceId = inv.id; await save('jobs', job);
      if (odo > num(v.odometer)) { v.odometer = odo; await save('vehicles', v); }
      if (pay > 0) await save('payments', { number: await nextNo('receipt'), date: pdate, amount: r2(pay), method: g('#qj_method'), reference: '', invoiceId: inv.id, customerId: v.customerId, vehicleId: v.id });
      m.close(); toast(`Saved — ${job.number}, ${inv.number}${pay ? `, paid ${money(pay)}` : ''}`, 'ok'); render();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---------- repeat an expense ---------- */
function repeatExpense(id) {
  const e = get('expenses', id); if (!e) return;
  const keep = ['category', 'description', 'paidTo', 'supplierId', 'method', 'vanId', 'amount', 'vat'];
  editExpense(null, { ...Object.fromEntries(keep.filter(k => e[k] != null).map(k => [k, e[k]])), date: today() });
}
function repeatLastExpense() {
  const e = [...S.expenses].filter(x => !x.wage && !x.fixedCostId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  if (!e) return toast('No expense to repeat yet', 'err');
  repeatExpense(e.id);
}
