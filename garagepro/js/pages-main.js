/* GaragePro — dashboard, check-in, lookup, vehicle history, customers, vehicles */
'use strict';

const jsq = s => esc(JSON.stringify(s ?? ''));
const MAKES = ['Toyota', 'Nissan', 'Lexus', 'Honda', 'Mitsubishi', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'GMC', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Land Rover', 'Porsche', 'Jeep', 'Dodge', 'Mazda', 'Infiniti', 'Suzuki', 'Tesla', 'MG', 'Geely', 'Chery', 'Changan', 'Haval', 'Peugeot', 'Renault', 'Volvo', 'Jaguar', 'Cadillac', 'Lincoln', 'Isuzu', 'Subaru', 'Mini', 'Bentley', 'Rolls-Royce', 'Ferrari', 'Lamborghini', 'Maserati', 'Genesis', 'Jetour', 'BYD'];

/* ---------- Forms: customer & vehicle ---------- */
const customerFields = () => [
  { k: 'name', label: 'Customer / company name', req: true, span: 2 },
  { k: 'type', label: 'Type', type: 'select', options: S.settings.lists.customerType, def: 'Individual', blank: false },
  { k: 'phone', label: 'Mobile', type: 'tel', req: true, ph: '050 123 4567' },
  { k: 'whatsapp', label: 'WhatsApp (if different)', type: 'tel' },
  { k: 'email', label: 'Email', type: 'email' },
  { k: 'address', label: 'Area / address', span: 2 },
  { k: 'trn', label: 'TRN (VAT no.)' },
  { k: 'contactPerson', label: 'Contact person' },
  { k: 'noMarketing', label: 'No marketing messages (leave out of campaigns and follow-ups)', type: 'checkbox', span: 2 },
  { k: 'notes', label: 'Notes', type: 'textarea', span: 'all' },
];
const vehicleFields = (withOwner = true) => [
  ...(withOwner ? [{ k: 'customerId', label: 'Owner', type: 'select', req: true, span: 'all', options: () => [...S.customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, `${c.name} — ${c.phone || ''}`]) }] : []),
  { section: 'Identification' },
  { k: 'plate', label: 'Number plate', type: 'plate', req: true, ph: 'A 12345' },
  { k: 'emirate', label: 'Emirate / state', type: 'select', options: S.settings.lists.emirate, def: 'Dubai' },
  { k: 'vin', label: 'VIN / chassis no.', type: 'plate', ph: '17 characters' },
  { k: 'make', label: 'Make', req: true, list: MAKES },
  { k: 'model', label: 'Model', req: true },
  { k: 'year', label: 'Year', type: 'number', step: 1 },
  { k: 'color', label: 'Colour' },
  { k: 'engineNo', label: 'Engine no.' },
  { section: 'Specification' },
  { k: 'fuel', label: 'Fuel', type: 'select', options: S.settings.lists.fuel },
  { k: 'transmission', label: 'Transmission', type: 'select', options: S.settings.lists.transmission },
  { k: 'engineSize', label: 'Engine size (L)' },
  { k: 'drive', label: 'Drive', type: 'select', options: S.settings.lists.drive },
  { k: 'oilGrade', label: 'Engine oil grade', ph: '5W-30 Synthetic' },
  { k: 'oilCapacity', label: 'Oil capacity (L)', type: 'number' },
  { k: 'tyreSize', label: 'Tyre size', ph: '215/55 R17' },
  { k: 'battery', label: 'Battery type', ph: '70Ah AGM' },
  { section: 'Status & dates' },
  { k: 'odometer', label: 'Odometer (km)', type: 'number', help: 'Updates automatically from job cards' },
  { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Sold'], def: 'Active', blank: false },
  { k: 'regExpiry', label: 'Registration expiry', type: 'date' },
  { k: 'insExpiry', label: 'Insurance expiry', type: 'date' },
  { k: 'insurer', label: 'Insurance company' },
  { k: 'fleetNo', label: 'Fleet / unit no.' },
  { k: 'notes', label: 'Notes', type: 'textarea', span: 'all' },
];

async function saveCustomer(vals, existing) {
  const c = existing ? Object.assign(existing, vals) : vals;
  const dup = S.customers.find(x => x.id !== c.id && x.phone && String(x.phone).replace(/\D/g, '') === String(c.phone).replace(/\D/g, ''));
  if (dup && !existing && !(await confirmBox(`${dup.name} already uses phone ${dup.phone}. Create another customer anyway?`))) return false;
  if (!c.code) c.code = await nextNo('customer');
  await save('customers', c);
  toast('Customer saved', 'ok');
  return c;
}
async function saveVehicle(vals, existing) {
  const v = existing ? { ...existing } : {};
  const oldOwner = v.customerId;
  Object.assign(v, vals);
  v.plateNorm = norm(v.plate); v.vinNorm = norm(v.vin);
  const dup = S.vehicles.find(x => x.id !== v.id && ((v.plateNorm && x.plateNorm === v.plateNorm && (x.emirate || '') === (v.emirate || '')) || (v.vinNorm && x.vinNorm === v.vinNorm)));
  if (dup) { toast(`A vehicle with this ${dup.vinNorm === v.vinNorm && v.vinNorm ? 'VIN' : 'plate'} already exists (${dup.plate})`, 'err'); return false; }
  if (existing && oldOwner && oldOwner !== v.customerId) {
    v.ownerHistory = [...(v.ownerHistory || []), { date: today(), from: oldOwner, to: v.customerId }];
  }
  if (!v.code) v.code = await nextNo('vehicle');
  await save('vehicles', v);
  toast('Vehicle saved', 'ok');
  return v;
}
function editCustomer(id, after) {
  const c = get('customers', id);
  openForm({
    title: c ? 'Edit customer' : 'New customer', fields: customerFields(), data: c || {},
    onSave: async vals => { const r = await saveCustomer(vals, c); if (r === false) return false; if (after) after(r); else render(); },
    onDelete: c ? async () => {
      if (S.vehicles.some(v => v.customerId === c.id) || S.invoices.some(i => i.customerId === c.id)) { toast('This customer has vehicles or invoices — cannot delete. Mark notes instead.', 'err'); return false; }
      if (!(await confirmBox(`Delete ${c.name}?`, 'Delete', true))) return false;
      await remove('customers', c.id); go('#/customers'); return true;
    } : null,
  });
}
function editVehicle(id, preset = {}, after) {
  const v = get('vehicles', id);
  openForm({
    title: v ? `Edit vehicle ${esc(v.plate)}` : 'New vehicle', fields: vehicleFields(true), data: v || preset, size: 'wide', cols: 4,
    onSave: async vals => { const r = await saveVehicle(vals, v); if (r === false) return false; if (after) after(r); else go('#/vehicle/' + r.id); },
    onDelete: v ? async () => {
      if (S.jobs.some(j => j.vehicleId === v.id) || S.invoices.some(i => i.vehicleId === v.id)) { toast('This vehicle has history — set status to Inactive/Sold instead of deleting.', 'err'); return false; }
      if (!(await confirmBox(`Delete vehicle ${v.plate}?`, 'Delete', true))) return false;
      await remove('vehicles', v.id); go('#/vehicles'); return true;
    } : null,
  });
}

/* ---------- Global search ---------- */
function doGlobalSearch(q) {
  q = (q || '').trim(); if (!q) return;
  const v = exactVehicle(q);
  $('#globalSearch').value = '';
  $('#globalSearch').blur();
  if (v) return go('#/vehicle/' + v.id);
  const r = globalSearch(q);
  if (r.vehicles.length === 1 && !r.customers.length && !r.docs.length) return go('#/vehicle/' + r.vehicles[0].id);
  if (r.docs.length === 1 && !r.vehicles.length && !r.customers.length) return go(`#/${r.docs[0].kind}/${r.docs[0].d.id}`);
  go('#/search/' + encodeURIComponent(q));
}
PAGES.search = q => {
  const r = globalSearch(q);
  const none = !r.vehicles.length && !r.customers.length && !r.docs.length;
  view().innerHTML = pageHead(`Search: “${esc(q)}”`, `${r.vehicles.length} vehicles · ${r.customers.length} customers · ${r.docs.length} documents`) +
    (none ? `<div class="card card-pad"><div class="empty"><div class="big">🔍</div>Nothing found for <b>${esc(q)}</b>.<br><br>
      <button class="btn primary" onclick="go('#/checkin/${encodeURIComponent(q)}')">＋ Register this vehicle & check it in</button></div></div>` : '') +
    (r.vehicles.length ? `<div class="card mb"><div class="card-head"><h3>Vehicles</h3></div>${vehicleTable(r.vehicles)}</div>` : '') +
    (r.customers.length ? `<div class="card mb"><div class="card-head"><h3>Customers</h3></div>${customerTable(r.customers)}</div>` : '') +
    (r.docs.length ? `<div class="card"><div class="card-head"><h3>Documents</h3></div>${table([
      { h: 'Type', v: x => ({ quote: 'Quotation', job: 'Job card', invoice: 'Invoice' }[x.kind]) }, { h: 'No.', v: x => `<b>${esc(x.d.number)}</b>` },
      { h: 'Date', v: x => fmtDate(x.d.date) }, { h: 'Vehicle', v: x => plateTag(vehicleOf(x.d)) }, { h: 'Customer', v: x => esc((customerOf(x.d) || {}).name) }],
      r.docs, { click: x => `go('#/${x.kind}/${x.d.id}')` })}</div>` : '');
};

/* ---------- Dashboard ---------- */
PAGES.dashboard = () => {
  const st = S.settings;
  const openJobs = S.jobs.filter(j => OPEN_JOB.includes(j.status) || j.status === 'Ready').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const mk = monthKey(today());
  const monthInv = S.invoices.filter(i => !i.void && monthKey(i.date) === mk);
  const revenue = r2(monthInv.reduce((a, i) => a + calcDoc(i).net, 0));
  const cogs = r2(monthInv.reduce((a, i) => a + calcDoc(i).cost, 0));
  const collected = r2(S.payments.filter(p => monthKey(p.date) === mk).reduce((a, p) => a + num(p.amount), 0));
  const outstanding = r2(S.invoices.filter(i => !i.void).reduce((a, i) => a + invoiceState(i).balance, 0));
  const quotesWaiting = S.quotes.filter(q => quoteState(q) === 'Sent').length;
  const rem = reminderList();
  const low = stockTable().filter(r => r.low);
  const empty = !S.vehicles.length && !S.customers.length;

  // last 6 months chart
  const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(toISODate(d).slice(0, 7)); }
  const series = months.map(m => ({
    m, rev: S.invoices.filter(i => !i.void && monthKey(i.date) === m).reduce((a, i) => a + calcDoc(i).net, 0),
    col: S.payments.filter(p => monthKey(p.date) === m).reduce((a, p) => a + num(p.amount), 0)
  }));
  const max = Math.max(1, ...series.map(s => Math.max(s.rev, s.col)));
  const chart = `<div class="bars">${series.map(s => `<div class="bar-col"><div class="bar-val">${s.rev ? fmtNum(Math.round(s.rev)) : ''}</div>
    <div style="display:flex;gap:3px;align-items:flex-end;width:100%;justify-content:center;height:100%"><div class="bar" style="height:${s.rev / max * 100}%" title="Revenue ${money(s.rev)}"></div><div class="bar alt" style="height:${s.col / max * 100}%" title="Collected ${money(s.col)}"></div></div>
    <div class="bar-lbl">${new Date(s.m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}</div></div>`).join('')}</div>
    <div class="row small muted" style="justify-content:center;margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px"></span> Revenue (net) &nbsp; <span style="display:inline-block;width:10px;height:10px;background:#fdba74;border-radius:2px"></span> Collected</div>`;

  // this week vs last week (rolling 7 days)
  const inRange = (d, a, b) => d && d > addDays(today(), -a) && d <= addDays(today(), -b);
  const wkRev = S.invoices.filter(i => !i.void && inRange(i.date, 7, 0)).reduce((a, i) => a + calcDoc(i).net, 0);
  const pwRev = S.invoices.filter(i => !i.void && inRange(i.date, 14, 7)).reduce((a, i) => a + calcDoc(i).net, 0);
  const wkJobs = S.jobs.filter(j => j.status !== 'Cancelled' && inRange(j.date, 7, 0)).length;
  const pwJobs = S.jobs.filter(j => j.status !== 'Cancelled' && inRange(j.date, 14, 7)).length;
  const trend = (cur, prev) => {
    if (!prev && !cur) return '<span class="trend flat">no change</span>';
    if (!prev) return `<span class="trend up">${ic('trending-up')} new this week</span>`;
    const p = Math.round((cur - prev) / prev * 100);
    return `<span class="trend ${p > 0 ? 'up' : p < 0 ? 'down' : 'flat'}">${ic(p >= 0 ? 'trending-up' : 'trending-down')} ${p > 0 ? '+' : ''}${p}% vs last week</span>`;
  };
  const kpi = (lbl, val, hint, link) => `<div class="kpi ${link ? 'link' : ''}" ${link ? `onclick="go('${link}')"` : ''}><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="hint">${hint || ''}</div></div>`;
  view().innerHTML = `
    <div class="hero mb"><h2>${esc(st.garageName)} — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      <p>Type a number plate or VIN to pull up the car's complete history, or check a new car in.</p>
      <div class="lookup"><input id="heroQ" placeholder="PLATE OR VIN…" onkeydown="if(event.key==='Enter')heroLookup()" autocomplete="off"><button class="btn primary lg" onclick="heroLookup()">Find vehicle</button></div></div>
    ${empty ? `<div class="card card-pad mb" style="border-color:var(--accent)"><h3>👋 Welcome! Set up in 4 steps</h3>
      <ol style="line-height:2;margin:8px 0 12px">
        <li><a onclick="go('#/settings')">Enter your garage details</a> — name, logo, TRN, VAT, bank details (they appear on every invoice)</li>
        <li><a onclick="go('#/technicians')">Add your technicians</a> and <a onclick="go('#/labour')">labour operations</a> with your rates</li>
        <li><a onclick="go('#/parts')">Add parts you stock</a> (or import them from your Excel sheet in Settings)</li>
        <li><a onclick="go('#/checkin')">Check in your first car</a> — type the plate, create the job card, then invoice it</li></ol>
      <button class="btn" onclick="loadDemoData()">Try it with demo data first</button> <span class="small muted">&nbsp;You can wipe demo data later in Settings.</span></div>` : ''}
    <div class="grid g6 mb">
      ${kpi('Jobs open', S.jobs.filter(j => OPEN_JOB.includes(j.status)).length, `${wkJobs} checked in this week<br>${trend(wkJobs, pwJobs)}`, '#/jobs')}
      ${kpi('Ready to collect', S.jobs.filter(j => j.status === 'Ready').length, 'call the customer', '#/jobs')}
      ${kpi('Awaiting parts', S.jobs.filter(j => j.status === 'Awaiting Parts').length, '', '#/jobs')}
      ${Auth.canPage('quotes') ? kpi('Quotes awaiting reply', quotesWaiting, 'follow up', '#/quotes') : kpi('Bookings today', S.bookings.filter(b => b.date === today() && b.status !== 'Cancelled').length, '', '#/bookings')}
      ${Auth.can('finance') ? kpi('Revenue this month', money(revenue, false), `GP ${money(revenue - cogs, false)} · collected ${money(collected, false)}<br>This week ${money(wkRev, false)} ${trend(wkRev, pwRev)}`, '#/reports') : kpi('Vehicles on file', S.vehicles.length, '', '#/vehicles')}
      ${Auth.canPage('invoices') ? kpi('Outstanding', money(outstanding, false), 'unpaid invoices', '#/invoices') : kpi('Low stock parts', low.length, '', '#/parts')}
    </div>
    ${todaysBookingsHTML()}${Auth.canPage('dispatch') ? mobileTodayHTML() : ''}
    <div class="grid g3">
      <div class="card span2"><div class="card-head"><h3>🔧 Workshop board</h3><div class="actions"><button class="btn sm" onclick="go('#/jobs')">All jobs</button></div></div>
        ${table([
    { h: 'Job', v: j => `<b>${esc(j.number)}</b>` }, { h: 'Vehicle', v: j => `${plateTag(vehicleOf(j))} <span class="small muted">${esc(vehicleLabel(vehicleOf(j)))}</span>` },
    { h: 'Customer', v: j => esc((customerOf(j) || {}).name) }, { h: 'Technician', v: j => esc(techName(j.technicianId)) },
    { h: 'Status', v: j => pill(j.status) }, { h: 'In', v: j => `${daysBetween(j.date, today())}d` },
    { h: 'Promised', v: j => j.promised ? `<span class="${j.promised < today() && j.status !== 'Ready' ? 'red strong' : ''}">${fmtDate(j.promised)}</span>` : '' }],
    openJobs, { click: j => `go('#/job/${j.id}')`, empty: 'No cars in the workshop right now.', emptyIcon: '🅿' })}</div>
      <div class="card"><div class="card-head"><h3>🔔 Action required</h3><div class="actions"><button class="btn sm" onclick="go('#/reminders')">All</button></div></div>
        ${rem.length || low.length ? rem.slice(0, 8).map(reminderRowHTML).join('') + (low.length ? `<div class="alert-row"><div class="alert-ico" style="background:var(--redSoft)">📦</div><div class="grow"><b>${low.length} part(s) at or below reorder level</b><div class="small muted">${esc(low.slice(0, 3).map(r => r.p.name).join(', '))}${low.length > 3 ? '…' : ''}</div></div><button class="btn sm" onclick="go('#/parts')">View</button></div>` : '') : '<div class="empty">All clear ✔</div>'}</div>
    </div>
    ${!Auth.can('finance') ? '' : `<div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>📈 Revenue — last 6 months</h3></div><div class="card-pad">${chart}</div></div>
      <div class="card"><div class="card-head"><h3>🧾 Recent invoices</h3><div class="actions"><button class="btn sm" onclick="go('#/invoices')">All</button></div></div>
        ${table([{ h: 'No.', v: i => `<b>${esc(i.number)}</b>` }, { h: 'Date', v: i => fmtDate(i.date) }, { h: 'Vehicle', v: i => plateTag(vehicleOf(i)) },
    { h: 'Total', cls: 'num', v: i => money(invoiceState(i).total, false) }, { h: 'Status', v: i => pill(invoiceState(i).status) }],
    [...S.invoices].sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)).slice(0, 7), { click: i => `go('#/invoice/${i.id}')`, empty: 'No invoices yet.' })}</div>
    </div>`}`;
  setTimeout(() => { const h = $('#heroQ'); if (h) h.focus(); }, 30);
};
function heroLookup() {
  const q = $('#heroQ').value.trim(); if (!q) return;
  const v = exactVehicle(q);
  if (v) return go('#/vehicle/' + v.id);
  const list = findVehicles(q);
  if (list.length === 1) return go('#/vehicle/' + list[0].id);
  if (list.length > 1) return go('#/search/' + encodeURIComponent(q));
  go('#/checkin/' + encodeURIComponent(q));
}

/* ---------- Vehicle lookup page ---------- */
PAGES.lookup = () => {
  view().innerHTML = pageHead('Vehicle Lookup', 'Enter a number plate or VIN (full or partial) — the complete history appears instantly.') +
    `<div class="hero"><div class="lookup"><input id="lkQ" placeholder="PLATE OR VIN…" oninput="drawLookup()" onkeydown="if(event.key==='Enter'){const v=exactVehicle(this.value)||findVehicles(this.value)[0]; if(v) go('#/vehicle/'+v.id)}" autocomplete="off" value="${esc(getFilter('lookup', 'q'))}"></div></div>
    <div id="lkRes" class="mt"></div>`;
  drawLookup();
  $('#lkQ').focus();
};
function drawLookup() {
  const q = $('#lkQ').value; (UI.filters.lookup = UI.filters.lookup || {}).q = q;
  const box = $('#lkRes');
  if (!q.trim()) { box.innerHTML = `<div class="card"><div class="card-head"><h3>Recently serviced</h3></div>${vehicleTable(recentVehicles(10))}</div>`; return; }
  const res = findVehicles(q);
  box.innerHTML = res.length ? `<div class="card">${vehicleTable(res)}</div>` :
    `<div class="card card-pad"><div class="empty"><div class="big">🚗</div><b>${esc(q.toUpperCase())}</b> is not in the system yet.<br><br><button class="btn primary" onclick="go('#/checkin/'+encodeURIComponent($('#lkQ').value))">＋ Register & check in this vehicle</button></div></div>`;
}
function recentVehicles(n) {
  const last = {};
  for (const j of S.jobs) if (!last[j.vehicleId] || j.date > last[j.vehicleId]) last[j.vehicleId] = j.date;
  return [...S.vehicles].sort((a, b) => (last[b.id] || b.createdAt || '').localeCompare(last[a.id] || a.createdAt || '')).slice(0, n);
}

/* ---------- Check-in ---------- */
PAGES.checkin = (q = '') => {
  view().innerHTML = pageHead('Check-in', 'Car arrives → type plate or VIN → confirm owner → job card created. Takes under a minute.') +
    `<div class="hero mb"><div class="lookup"><input id="ciQ" placeholder="PLATE OR VIN…" value="${esc(q)}" oninput="drawCheckin()" autocomplete="off"></div></div><div id="ciRes"></div>`;
  drawCheckin();
  $('#ciQ').focus();
};
function drawCheckin() {
  const q = $('#ciQ').value.trim();
  const box = $('#ciRes');
  if (!q) { box.innerHTML = '<div class="empty">Start typing the plate number or VIN…</div>'; return; }
  const exact = exactVehicle(q);
  const matches = exact ? [exact] : findVehicles(q).slice(0, 6);
  let h = '';
  if (matches.length && !exact) h += `<div class="card mb"><div class="card-head"><h3>Possible matches</h3></div>${matches.map(v => `<div class="dd-item" onclick="$('#ciQ').value=${jsq(v.plate)};drawCheckin()">${plateTag(v)} ${esc(vehicleLabel(v))} · <span class="muted">${esc((customerOf(v) || {}).name || '')}</span> <span class="faint small mono">${esc(v.vin || '')}</span></div>`).join('')}</div>`;
  if (exact) h += checkinExisting(exact);
  else h += checkinNew(q);
  box.innerHTML = h;
  if (!exact) wireCheckinNew();
}
function checkinJobFields(v) {
  const techs = S.technicians.filter(t => t.active !== false);
  return `<div class="grid g4">
    <div class="field"><label>Odometer in (km) <span class="req">*</span></label><input id="ci_odo" type="number" placeholder="${v ? 'Last: ' + fmtNum(currentOdo(v)) : ''}"></div>
    <div class="field"><label>Job type</label><select id="ci_type">${S.settings.lists.jobType.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div class="field"><label>Technician</label><select id="ci_tech"><option value="">— assign later —</option>${techs.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Promised date</label><input id="ci_prom" type="date" value="${addDays(today(), 1)}"></div>
    <div class="field spanall"><label>Customer complaint / request</label><textarea id="ci_comp" placeholder="e.g. Periodic service, AC not cooling, noise from front left when braking…"></textarea></div></div>`;
}
function checkinExisting(v) {
  const c = customerOf(v) || {}, s = vehicleStats(v);
  const open = S.jobs.filter(j => j.vehicleId === v.id && OPEN_JOB.concat('Ready').includes(j.status));
  const due = serviceSchedule(v).filter(x => x.status === 'Overdue' || x.status === 'Due Soon');
  return `<div class="card mb"><div class="card-pad"><div class="vhead">
      <div><span class="plate lg">${esc(v.plate)}</span><div class="vtitle">${esc(vehicleLabel(v))} ${v.color ? '<span class="muted">· ' + esc(v.color) + '</span>' : ''}</div><div class="muted mono small">VIN ${esc(v.vin || '—')}</div></div>
      <div class="grow"><dl class="kv"><dt>Owner</dt><dd>${custLink(c)} · ${esc(c.phone || '')}</dd><dt>Visits</dt><dd>${s.visits} · last ${fmtDate(s.last) || '—'}</dd><dt>Odometer</dt><dd>${fmtNum(s.odo)} km</dd>
      <dt>Balance owed</dt><dd class="${s.balance > 0 ? 'red' : ''}">${money(customerBalance(c.id))}</dd></dl></div>
      <div><button class="btn" onclick="go('#/vehicle/${v.id}')">Full history →</button></div></div>
    ${open.length ? `<div class="mt" style="background:var(--amberSoft);padding:10px 12px;border-radius:8px">⚠ Already has an open job: ${open.map(j => `<a onclick="go('#/job/${j.id}')">${esc(j.number)} (${esc(j.status)})</a>`).join(', ')}</div>` : ''}
    ${due.length ? `<div class="mt" style="background:var(--blueSoft);padding:10px 12px;border-radius:8px">💡 Due now: ${due.map(d => `<b>${esc(d.name)}</b> (${esc(d.status)})`).join(', ')} — offer these to the customer.</div>` : ''}
    <hr class="sep">${checkinJobFields(v)}
    <div class="row end mt"><button class="btn" onclick="checkinCreate('quote')">Create quotation</button><button class="btn primary lg" onclick="checkinCreate('job')">Open job card →</button></div></div></div>`;
}
function checkinNew(q) {
  const isVin = norm(q).length >= 11;
  return `<div class="card"><div class="card-head"><h3>🆕 New vehicle — not in the system yet</h3></div><div class="card-pad">
    <div class="grid g4">
      <div class="fieldset-title">Vehicle</div>
      <div class="field"><label>Number plate <span class="req">*</span></label><input id="nv_plate" class="plate-input" value="${esc(isVin ? '' : q.toUpperCase())}"></div>
      <div class="field"><label>Emirate</label><select id="nv_emirate">${S.settings.lists.emirate.map(e => `<option>${esc(e)}</option>`).join('')}</select></div>
      <div class="field span2"><label>VIN / chassis</label><input id="nv_vin" class="plate-input" value="${esc(isVin ? q.toUpperCase() : '')}"></div>
      <div class="field"><label>Make <span class="req">*</span></label><input id="nv_make" list="nv_makes"><datalist id="nv_makes">${MAKES.map(m => `<option value="${m}">`).join('')}</datalist></div>
      <div class="field"><label>Model <span class="req">*</span></label><input id="nv_model"></div>
      <div class="field"><label>Year</label><input id="nv_year" type="number"></div>
      <div class="field"><label>Colour</label><input id="nv_color"></div>
      <div class="fieldset-title">Owner</div>
      <div class="field"><label>Mobile <span class="req">*</span></label><input id="nc_phone" placeholder="050 123 4567" autocomplete="off"><div class="help" id="nc_match"></div></div>
      <div class="field span2"><label>Name <span class="req">*</span></label><input id="nc_name"></div>
      <div class="field"><label>Type</label><select id="nc_type">${S.settings.lists.customerType.map(e => `<option>${esc(e)}</option>`).join('')}</select></div>
      <div class="field span2"><label>Email</label><input id="nc_email" type="email"></div>
      <div class="field span2"><label>Or pick an existing customer</label><select id="nc_existing"><option value="">— new customer —</option>${[...S.customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${esc(c.name)} — ${esc(c.phone || '')}</option>`).join('')}</select></div>
      <div class="fieldset-title">This visit</div></div>
    ${checkinJobFields(null)}
    <div class="row end mt"><button class="btn" onclick="checkinCreate('vehicle')">Save vehicle only</button><button class="btn" onclick="checkinCreate('quote')">Save & create quotation</button><button class="btn primary lg" onclick="checkinCreate('job')">Save & open job card →</button></div>
  </div></div>`;
}
function wireCheckinNew() {
  const ph = $('#nc_phone'), sel = $('#nc_existing');
  ph.oninput = () => {
    const d = ph.value.replace(/\D/g, '');
    const c = d.length >= 7 && S.customers.find(x => String(x.phone || '').replace(/\D/g, '').endsWith(d.slice(-9)));
    $('#nc_match').innerHTML = c ? `Existing customer: <b>${esc(c.name)}</b> — <a onclick="$('#nc_existing').value='${c.id}';$('#nc_existing').onchange()">use this</a>` : '';
  };
  sel.onchange = () => {
    const c = get('customers', sel.value);
    ['nc_phone', 'nc_name', 'nc_email'].forEach(id => $('#' + id).disabled = !!c);
    if (c) { $('#nc_phone').value = c.phone || ''; $('#nc_name').value = c.name; $('#nc_email').value = c.email || ''; }
  };
}
async function checkinCreate(what) {
  try {
    let v = exactVehicle($('#ciQ').value);
    if (!v) {
      const g = id => ($('#' + id).value || '').trim();
      if (!g('nv_plate')) throw new Error('Number plate is required');
      if (!g('nv_make') || !g('nv_model')) throw new Error('Make and model are required');
      let c = get('customers', $('#nc_existing').value);
      if (!c) {
        if (!g('nc_phone') || !g('nc_name')) throw new Error('Owner name and mobile are required');
        c = await saveCustomer({ name: g('nc_name'), phone: g('nc_phone'), email: g('nc_email'), type: g('nc_type') });
        if (!c) return;
      }
      v = await saveVehicle({ customerId: c.id, plate: g('nv_plate').toUpperCase(), emirate: g('nv_emirate'), vin: g('nv_vin').toUpperCase(), make: g('nv_make'), model: g('nv_model'), year: g('nv_year'), color: g('nv_color'), odometer: num(g('ci_odo')) || '', status: 'Active' });
      if (!v) return;
    }
    if (what === 'vehicle') return go('#/vehicle/' + v.id);
    const odo = num($('#ci_odo').value);
    if (what === 'job' && !odo) { $('#ci_odo').focus(); throw new Error('Enter the odometer reading'); }
    if (odo && odo < currentOdo(v) && !(await confirmBox(`Odometer ${fmtNum(odo)} km is lower than the last recorded ${fmtNum(currentOdo(v))} km. Continue?`))) return;
    const base = { vehicleId: v.id, customerId: v.customerId, date: today(), odometer: odo || '', items: [], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate };
    if (what === 'job') {
      const job = await save('jobs', { ...base, number: await nextNo('job'), status: 'Booked', type: $('#ci_type').value, technicianId: $('#ci_tech').value, promised: $('#ci_prom').value, complaint: $('#ci_comp').value.trim() });
      toast(`Job card ${job.number} opened`, 'ok'); go('#/job/' + job.id);
    } else {
      const qt = await save('quotes', { ...base, number: await nextNo('quote'), status: 'Draft', validUntil: addDays(today(), num(S.settings.quoteValidDays) || 14), description: $('#ci_comp').value.trim() });
      toast(`Quotation ${qt.number} created`, 'ok'); go('#/quote/' + qt.id);
    }
  } catch (e) { toast(e.message, 'err'); }
}

/* ---------- Vehicles list ---------- */
function vehicleTable(list) {
  const lastVisit = {};
  for (const j of S.jobs) if (!lastVisit[j.vehicleId] || j.date > lastVisit[j.vehicleId]) lastVisit[j.vehicleId] = j.date;
  return table([
    { h: 'Plate', v: v => plateTag(v) }, { h: 'Vehicle', v: v => `<b>${esc(vehicleLabel(v))}</b>${v.color ? ` <span class="muted small">${esc(v.color)}</span>` : ''}` },
    { h: 'VIN', v: v => `<span class="mono small">${esc(v.vin || '')}</span>` }, { h: 'Owner', v: v => custLink(customerOf(v)) },
    { h: 'Odometer', cls: 'num', v: v => fmtNum(currentOdo(v)) }, { h: 'Reg. expiry', v: v => expiryChip(v.regExpiry) },
    { h: 'Last visit', v: v => fmtDate(lastVisit[v.id]) }, { h: 'Status', v: v => v.status && v.status !== 'Active' ? pill(v.status) : '' }],
    list, { click: v => `go('#/vehicle/${v.id}')`, empty: 'No vehicles found.' });
}
function expiryChip(iso) {
  if (!iso) return '<span class="faint">—</span>';
  const d = daysLeft(iso);
  return `<span class="${d < 0 ? 'red strong' : d <= 30 ? 'amber strong' : ''}">${fmtDate(iso)}</span>${d < 0 ? ' <span class="pill red">expired</span>' : d <= 30 ? ` <span class="pill amber">${d}d</span>` : ''}`;
}
PAGES.vehicles = () => {
  view().innerHTML = pageHead('Vehicles', `${S.vehicles.length} vehicles on file`, `<button class="btn primary" onclick="editVehicle()">＋ Add vehicle</button>`) +
    `<div class="filters">${liveSearch('vehicles', 'Search plate, VIN, make, model, owner…', 'drawVehicles')}</div><div class="card" id="vehList"></div>`;
  drawVehicles();
};
function drawVehicles() {
  const q = getFilter('vehicles', 'q').toLowerCase(), n = norm(q);
  const list = S.vehicles.filter(v => !q || (n && ((v.plateNorm || '').includes(n) || (v.vinNorm || '').includes(n))) || vehicleLabel(v).toLowerCase().includes(q) || ((customerOf(v) || {}).name || '').toLowerCase().includes(q))
    .sort((a, b) => (a.plate || '').localeCompare(b.plate || ''));
  $('#vehList').innerHTML = vehicleTable(list);
}

/* ---------- Vehicle profile = complete history ---------- */
PAGES.vehicle = id => {
  const v = get('vehicles', id);
  if (!v) { view().innerHTML = '<div class="empty">Vehicle not found.</div>'; return; }
  const c = customerOf(v) || {}, s = vehicleStats(v);
  const tab = getFilter('vehicle', 'tab', 'history');
  const sched = serviceSchedule(v);
  const dueCount = sched.filter(x => x.status === 'Overdue' || x.status === 'Due Soon').length;
  const pw = pendingWork(v), notDone = pw.quotes.length + pw.advisories.length;
  const tabs = [['history', `Visits & history${notDone ? ` (⚠ ${notDone} not done)` : ''}`], ['service', `Service schedule${dueCount ? ` (${dueCount})` : ''}`], ['parts', 'Parts & work log'], ['docs', 'Quotes · Jobs · Invoices'], ['activity', 'Activity log'], ['details', 'Details']];
  let body = '';
  if (tab === 'history') body = vehicleHistoryHTML(v);
  else if (tab === 'activity') body = vehicleActivityHTML(v);
  else if (tab === 'service') body = serviceScheduleHTML(v, sched);
  else if (tab === 'parts') body = workLogHTML(v);
  else if (tab === 'docs') body = vehicleDocsHTML(v);
  else body = vehicleDetailsHTML(v);

  view().innerHTML = `<div class="crumb"><a onclick="go('#/vehicles')">Vehicles</a> / ${esc(v.plate)}</div>
    <div class="card mb"><div class="card-pad"><div class="vhead">
      <div><span class="plate lg">${esc(v.plate)}</span> <span class="muted">${esc(v.emirate || '')}</span>
        <div class="vtitle">${esc(vehicleLabel(v))} ${v.color ? '<span class="muted" style="font-weight:500">· ' + esc(v.color) + '</span>' : ''} ${v.status && v.status !== 'Active' ? pill(v.status) : ''}</div>
        <div class="muted mono small">VIN ${esc(v.vin || '—')} ${v.fleetNo ? ' · Fleet ' + esc(v.fleetNo) : ''}</div></div>
      <div class="grow" style="min-width:260px"><dl class="kv">
        <dt>Owner</dt><dd>${custLink(c)} ${c.type && c.type !== 'Individual' ? pill(c.type) : ''}</dd>
        <dt>Phone</dt><dd>${esc(c.phone || '—')} ${c.phone ? `<a class="small" onclick="openMessageDialog({vehicle:get('vehicles','${v.id}')})">💬 message</a>` : ''}</dd>
        <dt>Registration</dt><dd>${expiryChip(v.regExpiry)}</dd><dt>Insurance</dt><dd>${expiryChip(v.insExpiry)} ${esc(v.insurer || '')}</dd></dl></div>
      <div class="row" style="align-self:flex-start"><button class="btn" onclick="printVehicleReport('${v.id}')">🖨 Full history report</button><button class="btn" onclick="editVehicle('${v.id}')">Edit</button><button class="btn" onclick="newDocForVehicle('quote','${v.id}')">＋ Quotation</button><button class="btn primary" onclick="newDocForVehicle('job','${v.id}')">＋ Job card</button></div>
    </div></div></div>
    <div class="grid g6 mb">
      <div class="kpi"><div class="lbl">Odometer</div><div class="val">${fmtNum(s.odo)}</div><div class="hint">km</div></div>
      <div class="kpi"><div class="lbl">Visits</div><div class="val">${s.visits}</div><div class="hint">since ${fmtDate(s.first) || '—'}</div></div>
      <div class="kpi"><div class="lbl">Last visit</div><div class="val" style="font-size:18px">${fmtDate(s.last) || '—'}</div><div class="hint">${s.last ? daysBetween(s.last, today()) + ' days ago' : ''}</div></div>
      <div class="kpi"><div class="lbl">Lifetime spend</div><div class="val" style="font-size:20px">${money(s.spent, false)}</div><div class="hint">${esc(S.settings.currency)} incl. VAT</div></div>
      <div class="kpi"><div class="lbl">Balance owed</div><div class="val ${s.balance > 0 ? 'red' : ''}" style="font-size:20px">${money(s.balance, false)}</div><div class="hint">on this vehicle</div></div>
      <div class="kpi link" onclick="setFilter('vehicle','tab','service')"><div class="lbl">Service items due</div><div class="val ${dueCount ? 'amber' : ''}">${dueCount}</div><div class="hint">overdue / due soon</div></div>
    </div>
    <div class="tabs">${tabs.map(([k, l]) => `<div class="tab ${tab === k ? 'active' : ''}" onclick="setFilter('vehicle','tab','${k}')">${l}</div>`).join('')}</div>
    ${body}`;
  if (tab === 'history') hydrateVisitPhotos(v.id);
};
async function newDocForVehicle(kind, vid) {
  const v = get('vehicles', vid);
  const base = { vehicleId: v.id, customerId: v.customerId, date: today(), odometer: '', items: [], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate };
  if (kind === 'job') { const j = await save('jobs', { ...base, number: await nextNo('job'), status: 'Booked', type: S.settings.lists.jobType[0], promised: addDays(today(), 1) }); go('#/job/' + j.id); }
  else { const q = await save('quotes', { ...base, number: await nextNo('quote'), status: 'Draft', validUntil: addDays(today(), num(S.settings.quoteValidDays) || 14) }); go('#/quote/' + q.id); }
}

/* Visit-by-visit history: each job card with its quote, invoice & payments nested inside */
function pendingWork(v) {
  const quotes = S.quotes.filter(q => q.vehicleId === v.id && !q.jobId && ['Draft', 'Sent', 'Declined', 'Expired', 'Approved'].includes(quoteState(q)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const advisories = [];
  for (const j of S.jobs.filter(j => j.vehicleId === v.id && j.status !== 'Cancelled'))
    (j.inspection || []).forEach((p, i) => { if ((p.result === 'Attention' || p.result === 'Replace') && !p.resolved) advisories.push({ j, p, i }); });
  advisories.sort((a, b) => (b.j.date || '').localeCompare(a.j.date || ''));
  return { quotes, advisories };
}
async function resolveAdvisory(jobId, i) {
  const j = get('jobs', jobId); j.inspection[i].resolved = today(); await save('jobs', j); toast('Marked as done', 'ok'); render();
}
function vehicleHistoryHTML(v) {
  const jobs = S.jobs.filter(j => j.vehicleId === v.id).sort((a, b) => (a.date + a.number).localeCompare(b.date + b.number));
  const usedQ = new Set(), usedI = new Set();
  const { quotes: pq, advisories } = pendingWork(v);

  const pending = (pq.length || advisories.length) ? `<div class="card mb" style="border-color:#fcd34d"><div class="card-head" style="background:var(--amberSoft)"><h3>⚠ Recommended but NOT done yet</h3><span class="small muted">Quoted or advised work the customer hasn't gone ahead with</span></div>
    ${pq.map(q => `<div class="alert-row"><div class="alert-ico" style="background:var(--violetSoft)">✎</div><div class="grow"><b>Quotation ${esc(q.number)}</b> ${pill(quoteState(q))} <span class="muted small">${fmtDate(q.date)} · ${money(calcDoc(q).total)}</span>
      <div class="small muted">${esc(q.description || '')}${(q.items || []).length ? ' — ' + esc(q.items.map(i => i.desc).join(', ')) : ''}</div></div><button class="btn sm" onclick="go('#/quote/${q.id}')">Open</button></div>`).join('')}
    ${advisories.map(a => `<div class="alert-row"><div class="alert-ico" style="background:${a.p.result === 'Replace' ? 'var(--redSoft)' : 'var(--amberSoft)'}">${a.p.result === 'Replace' ? '✖' : '!'}</div><div class="grow"><b>${esc(a.p.point)}</b> ${pill(a.p.result)} <span class="muted small">found on ${esc(a.j.number)} · ${fmtDate(a.j.date)} · ${fmtNum(a.j.odometer)} km</span>${a.p.note ? `<div class="small muted">${esc(a.p.note)}</div>` : ''}</div>
      <button class="btn sm ghost" onclick="resolveAdvisory('${a.j.id}',${a.i})">Mark done</button></div>`).join('')}</div>` : '';

  const visits = jobs.map((j, idx) => {
    const qs = S.quotes.filter(q => q.jobId === j.id || q.id === j.quoteId); qs.forEach(q => usedQ.add(q.id));
    const inv = jobInvoice(j); if (inv) usedI.add(inv.id);
    const s = inv ? invoiceState(inv) : null;
    const pays = inv ? S.payments.filter(p => p.invoiceId === inv.id) : [];
    const items = inv && !inv.void ? inv.items : j.items;
    const fl = inspectionFlags(j);
    return { date: j.date, html: `<div class="tl-item"><div class="tl-dot" style="background:var(--accent)">${idx + 1}</div><div class="tl-card">
      <div class="tl-top"><b style="font-size:15px">Visit ${idx + 1}</b> · <a onclick="go('#/job/${j.id}')"><b>${isMobile(j) ? 'Mobile job' : 'Job card'} ${esc(j.number)}</b></a> ${lineBadge(j)} ${isMobile(j) ? pill((j.mobile || {}).status || 'New') : pill(j.status)} <span class="muted">${esc(isMobile(j) ? (j.mobile || {}).area || (j.mobile || {}).zone || '' : j.type || '')}</span>
        ${j.odometer ? `<span class="pill">${fmtNum(j.odometer)} km</span>` : ''}<span class="tl-date">${fmtDate(j.date)}${j.completed ? ' → ' + fmtDate(j.completed) : ''}${j.technicianId ? ' · ' + esc(techName(j.technicianId)) : ''}</span></div>
      ${j.complaint ? `<div class="mt-s"><span class="muted">Customer request:</span> ${esc(j.complaint)}</div>` : ''}
      ${j.diagnosis ? `<div><span class="muted">Work done:</span> ${esc(j.diagnosis)}</div>` : ''}
      ${(items || []).length ? `<table class="tbl mt-s" style="font-size:12.5px"><tbody>${items.map(it => `<tr><td style="padding:4px 8px;width:24px">${it.type === 'labour' ? '⏱' : it.type === 'part' ? '⚙' : '•'}</td><td style="padding:4px 8px">${esc(it.desc)}${it.serviceItem ? ` <span class="pill blue">${esc(it.serviceItem)}</span>` : ''}</td><td class="num" style="padding:4px 8px">${fmtNum(it.qty)}${it.type === 'labour' ? ' h' : ''}</td><td class="num" style="padding:4px 8px">${money(lineTotal(it), false)}</td></tr>`).join('')}</tbody></table>` : '<div class="small faint mt-s">No parts or labour recorded.</div>'}
      <div class="vph" data-job="${j.id}"></div>
      ${fl.length ? `<div class="mt-s small"><span class="muted">Inspection advisories:</span> ${fl.map(p => pill(p.point + (p.resolved ? ' ✓' : ''), p.resolved ? 'green' : p.result === 'Replace' ? 'red' : 'amber')).join(' ')}</div>` : ''}
      <div class="row mt-s" style="gap:6px">
        ${qs.map(q => `<span class="pill violet" style="cursor:pointer" onclick="go('#/quote/${q.id}')">✎ Quote ${esc(q.number)} · ${money(calcDoc(q).total, false)} · ${esc(quoteState(q))}</span>`).join('')}
        ${inv ? `<span class="pill blue" style="cursor:pointer" onclick="go('#/invoice/${inv.id}')">🧾 Invoice ${esc(inv.number)} · ${money(s.total, false)}</span> ${pill(s.status)}` : `<span class="pill">Not invoiced · est. ${money(calcDoc(j).total, false)}</span>`}
        ${pays.map(p => `<span class="pill green">✓ ${money(p.amount, false)} ${esc(p.method || '')} ${fmtDate(p.date)}</span>`).join('')}
        ${s && s.balance > 0 ? `<span class="pill red">Balance ${money(s.balance, false)}</span>` : ''}</div>
    </div></div>` };
  });
  // quotes / invoices not tied to a visit
  const extra = [];
  for (const q of S.quotes.filter(q => q.vehicleId === v.id && !usedQ.has(q.id)))
    extra.push({ date: q.date, html: `<div class="tl-item"><div class="tl-dot" style="background:var(--violet)">✎</div><div class="tl-card" style="cursor:pointer" onclick="go('#/quote/${q.id}')"><div class="tl-top"><b>Quotation ${esc(q.number)}</b> ${pill(quoteState(q))} <span class="muted small">not turned into a job</span><span class="tl-date">${fmtDate(q.date)}</span></div>${q.description ? `<div class="small muted mt-s">${esc(q.description)}</div>` : ''}<div class="small mt-s">${esc((q.items || []).map(i => i.desc).join(', '))} · <b>${money(calcDoc(q).total)}</b></div></div></div>` });
  for (const i of S.invoices.filter(i => i.vehicleId === v.id && !usedI.has(i.id))) {
    const s = invoiceState(i);
    extra.push({ date: i.date, html: `<div class="tl-item"><div class="tl-dot" style="background:var(--blue)">🧾</div><div class="tl-card" style="cursor:pointer" onclick="go('#/invoice/${i.id}')"><div class="tl-top"><b>Invoice ${esc(i.number)}</b> ${pill(s.status)}<span class="tl-date">${fmtDate(i.date)}</span></div><div class="small mt-s">${esc((i.items || []).map(x => x.desc).join(', '))} · <b>${money(s.total)}</b></div></div></div>` });
  }
  const all = [...visits, ...extra].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return pending + (all.length ? `<div class="row mb"><span class="muted">${jobs.length} visit(s) — each visit is its own job card, with its quotation, invoice and payments. Newest first.</span></div><div class="timeline">${all.map(x => x.html).join('')}</div>`
    : '<div class="empty"><div class="big">🚗</div>No visits yet — create the first job card with “＋ Job card”.</div>');
}

function vehicleActivityHTML(v) {
  const ev = vehicleTimeline(v);
  if (!ev.length) return '<div class="empty">No history yet.</div>';
  const dot = (bg, ico) => `<div class="tl-dot" style="background:${bg}">${ico}</div>`;
  const items = ev.map(e => {
    const r = e.ref;
    if (e.type === 'job') {
      const t = jobTotals(r); const fl = inspectionFlags(r);
      return `<div class="tl-item">${dot('var(--accent)', '🔧')}<div class="tl-card" style="cursor:pointer" onclick="go('#/job/${r.id}')">
        <div class="tl-top"><b>Job card ${esc(r.number)}</b> ${pill(r.status)} <span class="muted">${esc(r.type || '')}</span> ${r.odometer ? `<span class="pill">${fmtNum(r.odometer)} km</span>` : ''} <span class="tl-date">${fmtDate(r.date)}${r.technicianId ? ' · ' + esc(techName(r.technicianId)) : ''}</span></div>
        ${r.complaint ? `<div class="mt-s"><span class="muted">Complaint:</span> ${esc(r.complaint)}</div>` : ''}
        ${r.diagnosis ? `<div><span class="muted">Work done:</span> ${esc(r.diagnosis)}</div>` : ''}
        ${(r.items || []).length ? `<ul class="tl-lines">${r.items.map(it => `<li>${it.type === 'labour' ? '⏱' : it.type === 'part' ? '⚙' : '•'} ${esc(it.desc)} ${num(it.qty) !== 1 ? '× ' + fmtNum(it.qty) : ''}${it.serviceItem ? ` <span class="pill blue">${esc(it.serviceItem)}</span>` : ''}</li>`).join('')}</ul>` : ''}
        ${fl.length ? `<div class="mt-s small">${fl.map(p => pill(p.point, p.result === 'Replace' ? 'red' : 'amber')).join(' ')}</div>` : ''}
        <div class="mt-s small"><b>${money(t.total)}</b> ${t.status !== 'Not invoiced' ? pill(t.status) : '<span class="faint">not invoiced</span>'}</div></div></div>`;
    }
    if (e.type === 'quote') return `<div class="tl-item">${dot('var(--violet)', '✎')}<div class="tl-card" style="cursor:pointer" onclick="go('#/quote/${r.id}')"><div class="tl-top"><b>Quotation ${esc(r.number)}</b> ${pill(quoteState(r))} <span class="tl-date">${fmtDate(r.date)}</span></div>${r.description ? `<div class="muted small mt-s">${esc(r.description)}</div>` : ''}<div class="small mt-s"><b>${money(calcDoc(r).total)}</b> · ${(r.items || []).length} items</div></div></div>`;
    if (e.type === 'invoice') { const s = invoiceState(r); return `<div class="tl-item">${dot('var(--blue)', '🧾')}<div class="tl-card" style="cursor:pointer" onclick="go('#/invoice/${r.id}')"><div class="tl-top"><b>Invoice ${esc(r.number)}</b> ${pill(s.status)} <span class="tl-date">${fmtDate(r.date)}</span></div><div class="small mt-s">Total <b>${money(s.total)}</b> · paid ${money(s.paid)}${s.balance > 0 ? ` · <span class="red">balance ${money(s.balance)}</span>` : ''}</div></div></div>`; }
    if (e.type === 'payment') { const inv = get('invoices', r.invoiceId); return `<div class="tl-item">${dot('var(--green)', '✓')}<div class="tl-card"><div class="tl-top"><b>Payment ${esc(r.number)}</b> <span class="green strong">${money(r.amount)}</span> <span class="muted">${esc(r.method || '')} → ${esc(inv ? inv.number : '')}</span><span class="tl-date">${fmtDate(r.date)}</span></div></div></div>`; }
    if (e.type === 'message') return `<div class="tl-item">${dot('#25d366', '💬')}<div class="tl-card"><div class="tl-top"><b>${esc(r.channel)}</b> <span class="muted">${esc(TEMPLATE_LABELS[r.type] || r.type || '')} ${r.number ? esc(r.number) : ''}</span><span class="tl-date">${fmtDate(r.date)} ${new Date(r.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div><div class="small muted mt-s" style="white-space:pre-wrap">${esc((r.text || '').slice(0, 220))}${(r.text || '').length > 220 ? '…' : ''}</div></div></div>`;
    if (e.type === 'owner') return `<div class="tl-item">${dot('var(--gray)', '👤')}<div class="tl-card"><div class="tl-top"><b>Ownership changed</b> <span class="muted">${esc((get('customers', r.from) || {}).name || '?')} → ${esc((get('customers', r.to) || {}).name || '?')}</span><span class="tl-date">${fmtDate(r.date)}</span></div></div></div>`;
    return `<div class="tl-item">${dot('var(--ink)', '★')}<div class="tl-card"><div class="tl-top"><b>Vehicle added to the system</b><span class="tl-date">${fmtDate(e.date)}</span></div></div></div>`;
  }).join('');
  return `<div class="row mb"><span class="muted">${ev.length} events — everything that has happened to this car with you, newest first.</span></div><div class="timeline">${items}</div>`;
}
function serviceScheduleHTML(v, sched) {
  const rows = sched.map(x => `<tr><td><b>${esc(x.name)}</b><div class="small faint">every ${x.km ? fmtNum(x.km) + ' km' : ''}${x.km && x.months ? ' / ' : ''}${x.months ? x.months + ' months' : ''}</div></td>
    <td>${x.lastDate ? fmtDate(x.lastDate) : '<span class="faint">—</span>'}</td><td class="num">${x.lastOdo != null ? fmtNum(x.lastOdo) : ''}</td>
    <td>${x.nextDate ? fmtDate(x.nextDate) : ''}</td><td class="num">${x.nextOdo != null ? fmtNum(x.nextOdo) : ''}</td>
    <td class="num">${x.kmLeft != null ? `<span class="${x.kmLeft <= 0 ? 'red strong' : ''}">${fmtNum(x.kmLeft)}</span>` : ''}</td><td class="num">${x.dLeft != null ? `<span class="${x.dLeft <= 0 ? 'red strong' : ''}">${x.dLeft}</span>` : ''}</td>
    <td>${pill(x.status)}</td><td><button class="btn sm ghost" onclick="setServiceOverride('${v.id}',${jsq(x.name)})">Set last done</button>
    ${x.status === 'Overdue' || x.status === 'Due Soon' ? `<button class="btn sm wa" onclick="sendServiceReminder('${v.id}',${jsq(x.name)})">Remind</button>` : ''}</td></tr>`).join('');
  return `<div class="card"><div class="card-head"><h3>Preventive maintenance</h3><span class="small muted">Updates itself when a job card containing that service item is completed. Current odometer: <b>${fmtNum(currentOdo(v))} km</b></span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Service item</th><th>Last done</th><th class="num">At km</th><th>Next due</th><th class="num">Due at km</th><th class="num">Km left</th><th class="num">Days left</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function setServiceOverride(vid, item) {
  const v = get('vehicles', vid); const cur = (v.serviceOverrides || {})[item] || {};
  openForm({
    title: `Last done: ${esc(item)}`, size: 'narrow', cols: 2,
    fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'odo', label: 'Odometer (km)', type: 'number' }], data: cur,
    onSave: async vals => { v.serviceOverrides = { ...(v.serviceOverrides || {}), [item]: vals }; await save('vehicles', v); render(); },
  });
}
function sendServiceReminder(vid, item) {
  const v = get('vehicles', vid), c = customerOf(v);
  openMessageDialog({ vehicle: v, customer: c, type: 'serviceDue', text: fillTemplate(S.settings.templates.serviceDue, { ...baseCtx(v, c), item }) });
}
function workLogHTML(v) {
  const rows = [];
  for (const j of vehicleJobs(v.id)) {
    if (j.status === 'Cancelled') continue;
    const inv = jobInvoice(j); const items = inv && !inv.void ? inv.items : j.items;
    for (const it of items || []) rows.push({ j, it });
  }
  return `<div class="card"><div class="card-head"><h3>Every part fitted and every job done on this car</h3><div class="actions"><input class="inp sm" placeholder="Filter e.g. battery, brake…" oninput="document.querySelectorAll('#wlog tbody tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none')"></div></div>
  <div id="wlog">${table([{ h: 'Date', v: r => fmtDate(r.j.date) }, { h: 'Km', cls: 'num', v: r => fmtNum(r.j.odometer) }, { h: 'Job', v: r => `<a onclick="go('#/job/${r.j.id}')">${esc(r.j.number)}</a>` },
    { h: 'Type', v: r => r.it.type === 'part' ? 'Part' : r.it.type === 'labour' ? 'Labour' : 'Other' }, { h: 'Description', v: r => `${esc(r.it.desc)}${r.it.partNo ? ` <span class="small faint">${esc(r.it.partNo)}</span>` : ''}` },
    { h: 'Qty', cls: 'num', v: r => fmtNum(r.it.qty) }, { h: 'Amount', cls: 'num', v: r => money(lineTotal(r.it), false) }, { h: 'Technician', v: r => esc(techName(r.it.technicianId || r.j.technicianId)) }],
    rows, { empty: 'No work recorded yet.' })}</div></div>`;
}
function vehicleDocsHTML(v) {
  const qs = S.quotes.filter(q => q.vehicleId === v.id), js = S.jobs.filter(j => j.vehicleId === v.id), is = S.invoices.filter(i => i.vehicleId === v.id);
  const by = (a, b) => (b.date || '').localeCompare(a.date || '');
  return `<div class="grid g3">
   <div class="card"><div class="card-head"><h3>Quotations (${qs.length})</h3></div>${table([{ h: 'No.', v: q => esc(q.number) }, { h: 'Date', v: q => fmtDate(q.date) }, { h: 'Total', cls: 'num', v: q => money(calcDoc(q).total, false) }, { h: '', v: q => pill(quoteState(q)) }], qs.sort(by), { click: q => `go('#/quote/${q.id}')` })}</div>
   <div class="card"><div class="card-head"><h3>Job cards (${js.length})</h3></div>${table([{ h: 'No.', v: j => esc(j.number) }, { h: 'Date', v: j => fmtDate(j.date) }, { h: 'Km', cls: 'num', v: j => fmtNum(j.odometer) }, { h: '', v: j => pill(j.status) }], js.sort(by), { click: j => `go('#/job/${j.id}')` })}</div>
   <div class="card"><div class="card-head"><h3>Invoices (${is.length})</h3></div>${table([{ h: 'No.', v: i => esc(i.number) }, { h: 'Date', v: i => fmtDate(i.date) }, { h: 'Total', cls: 'num', v: i => money(invoiceState(i).total, false) }, { h: '', v: i => pill(invoiceState(i).status) }], is.sort(by), { click: i => `go('#/invoice/${i.id}')` })}</div></div>`;
}
function vehicleDetailsHTML(v) {
  const f = vehicleFields(false).filter(x => !x.section && x.k !== 'notes');
  return `<div class="card card-pad"><dl class="kv" style="grid-template-columns:180px 1fr 180px 1fr">${f.map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.type === 'date' ? fmtDate(v[x.k]) : v[x.k] ?? '') || '<span class="faint">—</span>'}</dd>`).join('')}</dl>
    ${v.notes ? `<hr class="sep"><b>Notes</b><div style="white-space:pre-wrap">${esc(v.notes)}</div>` : ''}
    <hr class="sep"><div class="small muted">System ID ${esc(v.code || '')} · added ${fmtDate((v.createdAt || '').slice(0, 10))}</div></div>`;
}

/* ---------- Customers ---------- */
function customerTable(list) {
  return table([
    { h: 'Name', v: c => `<b>${esc(c.name)}</b> ${c.type && c.type !== 'Individual' ? pill(c.type) : ''}` }, { h: 'Mobile', v: c => esc(c.phone || '') },
    { h: 'Email', v: c => esc(c.email || '') }, { h: 'Vehicles', v: c => S.vehicles.filter(v => v.customerId === c.id).map(plateTag).join(' ') },
    { h: 'Billed', cls: 'num', v: c => money(S.invoices.filter(i => i.customerId === c.id && !i.void).reduce((a, i) => a + invoiceState(i).total, 0), false) },
    { h: 'Balance', cls: 'num', v: c => { const b = customerBalance(c.id); return b > 0 ? `<span class="red strong">${money(b, false)}</span>` : '0.00'; } }],
    list, { click: c => `go('#/customer/${c.id}')`, empty: 'No customers found.' });
}
PAGES.customers = () => {
  view().innerHTML = pageHead('Customers', `${S.customers.length} customers`, `<button class="btn primary" onclick="editCustomer()">＋ Add customer</button>`) +
    `<div class="filters">${liveSearch('customers', 'Search name, phone, email…', 'drawCustomers')}
     <div class="seg">${['All', 'Owing'].map(k => `<button class="${getFilter('customers', 'f', 'All') === k ? 'on' : ''}" onclick="setFilter('customers','f','${k}')">${k}</button>`).join('')}</div></div><div class="card" id="custList"></div>`;
  drawCustomers();
};
function drawCustomers() {
  const q = getFilter('customers', 'q').toLowerCase(), d = q.replace(/\D/g, '');
  let list = S.customers.filter(c => !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (d.length >= 3 && String(c.phone || '').replace(/\D/g, '').includes(d)));
  if (getFilter('customers', 'f') === 'Owing') list = list.filter(c => customerBalance(c.id) > 0);
  $('#custList').innerHTML = customerTable(list.sort((a, b) => a.name.localeCompare(b.name)));
}
PAGES.customer = id => {
  const c = get('customers', id);
  if (!c) { view().innerHTML = '<div class="empty">Customer not found.</div>'; return; }
  const vs = S.vehicles.filter(v => v.customerId === c.id);
  const invs = S.invoices.filter(i => i.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const bal = customerBalance(c.id);
  const billed = invs.filter(i => !i.void).reduce((a, i) => a + invoiceState(i).total, 0);
  view().innerHTML = `<div class="crumb"><a onclick="go('#/customers')">Customers</a> / ${esc(c.name)}</div>` +
    pageHead(esc(c.name), `${esc(c.type || '')} · ${esc(c.code || '')}`, `<button class="btn" onclick="editCustomer('${c.id}')">Edit</button>
      <button class="btn wa" onclick="openMessageDialog({customer:get('customers','${c.id}'),vehicle:S.vehicles.find(v=>v.customerId==='${c.id}')})">💬 Message</button>
      <button class="btn" onclick="printStatement('${c.id}')">🖨 Statement</button>
      ${bal > 0 ? `<button class="btn" onclick="sendStatement('${c.id}')">Send statement</button>` : ''}`) +
    `<div class="grid g3 mb">
      <div class="card card-pad"><dl class="kv"><dt>Mobile</dt><dd>${esc(c.phone || '—')}</dd><dt>WhatsApp</dt><dd>${esc(c.whatsapp || c.phone || '—')}</dd><dt>Email</dt><dd>${esc(c.email || '—')}</dd><dt>Address</dt><dd>${esc(c.address || '—')}</dd>${c.trn ? `<dt>TRN</dt><dd>${esc(c.trn)}</dd>` : ''}${c.contactPerson ? `<dt>Contact</dt><dd>${esc(c.contactPerson)}</dd>` : ''}</dl>${c.notes ? `<hr class="sep"><div class="small" style="white-space:pre-wrap">${esc(c.notes)}</div>` : ''}</div>
      <div class="kpi"><div class="lbl">Total billed</div><div class="val">${money(billed)}</div><div class="hint">${invs.length} invoices · ${S.jobs.filter(j => j.customerId === c.id).length} jobs</div></div>
      <div class="kpi"><div class="lbl">Balance owed</div><div class="val ${bal > 0 ? 'red' : 'green'}">${money(bal)}</div><div class="hint">${bal > 0 ? 'outstanding' : 'all settled'}</div></div></div>
    <div class="card mb"><div class="card-head"><h3>Vehicles (${vs.length})</h3><div class="actions"><button class="btn sm" onclick="editVehicle(null,{customerId:'${c.id}'})">＋ Add vehicle</button></div></div>${vehicleTable(vs)}</div>
    <div class="card"><div class="card-head"><h3>Invoices</h3></div>${table([{ h: 'No.', v: i => `<b>${esc(i.number)}</b>` }, { h: 'Date', v: i => fmtDate(i.date) }, { h: 'Vehicle', v: i => plateTag(vehicleOf(i)) },
      { h: 'Total', cls: 'num', v: i => money(invoiceState(i).total, false) }, { h: 'Paid', cls: 'num', v: i => money(invoiceState(i).paid, false) }, { h: 'Balance', cls: 'num', v: i => money(invoiceState(i).balance, false) }, { h: 'Status', v: i => pill(invoiceState(i).status) }],
      invs, { click: i => `go('#/invoice/${i.id}')`, empty: 'No invoices yet.' })}</div>`;
};
function sendStatement(cid) {
  const c = get('customers', cid);
  const open = S.invoices.filter(i => i.customerId === cid && !i.void && invoiceState(i).balance > 0);
  const lines = open.map(i => `• ${i.number} (${fmtDate(i.date)}, ${(vehicleOf(i) || {}).plate || ''}) — ${money(invoiceState(i).balance)}`).join('\n');
  const text = `Dear ${c.name},\n\nStatement of account from ${S.settings.garageName} as of ${fmtDate(today())}:\n\n${lines}\n\nTotal outstanding: ${money(customerBalance(cid))}\n\n${payInfoText(null, money(customerBalance(cid)))}\n\nThank you.\n${S.settings.phone}`;
  openMessageDialog({ customer: c, vehicle: S.vehicles.find(v => v.customerId === cid), type: 'payment', text, subject: 'Statement of account — ' + S.settings.garageName });
}
