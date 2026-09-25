/* GaragePro — MendTech Mobile: requests, dispatch, crew screen, status flow, van stock */
'use strict';

Object.assign(PILL_COLORS, { New: 'blue', Assigned: 'violet', 'On the way': 'orange', Arrived: 'amber', Working: 'orange', Completed: 'green', 'Needs workshop': 'amber', Accepted: 'green', Urgent: 'red', 'After hours': 'violet' });
const MOB_TIME_KEY = { New: 'requested', Assigned: 'assigned', 'On the way': 'onway', Arrived: 'arrived', Working: 'working', Completed: 'completed', 'Needs workshop': 'needsWorkshop', Cancelled: 'cancelled' };
const MOB_NEXT = { New: 'Assigned', Assigned: 'On the way', 'On the way': 'Arrived', Arrived: 'Working', Working: 'Completed' };
const MOB_NEXT_LABEL = { New: '👷 Assign crew', Assigned: '🧭 On my way', 'On the way': '📍 I\'ve arrived', Arrived: '▶ Start work', Working: '🏁 Complete job' };
const lineBadge = d => lineOf(d) === 'mobile' ? '<span class="pill orange" title="MendTech Mobile">🚐 Mobile</span>' : '';

/* ---------- call-out fee lines ---------- */
function calloutLines(mob, dateISO, timeHHMM) {
  const m = S.settings.mob, out = [];
  const z = zoneOf(mob.zone);
  const line = (desc, fee, kind) => { if (num(fee) > 0) out.push({ type: 'other', desc, qty: 1, rate: num(fee), cost: 0, callout: kind }); };
  line(`Call-out fee — ${z ? z.name.split('(')[0].trim() : 'mobile service'}`, z && z.fee, 'zone');
  if (mob.urgency === 'urgent') line('Urgent / same-hour surcharge', m.urgentFee, 'urgent');
  if (isAfterHours(dateISO, mob.urgency === 'urgent' ? null : timeHHMM)) line('After-hours surcharge', m.afterHoursFee, 'after');
  if (isWeekendDay(dateISO)) line('Weekend surcharge', m.weekendFee, 'weekend');
  return out;
}
/* Free call-out once the job itself is above the threshold */
function applyCalloutRules(job) {
  const thr = num(S.settings.mob.freeCalloutAbove), z = zoneOf((job.mobile || {}).zone);
  const work = (job.items || []).filter(i => !i.callout).reduce((a, i) => a + lineTotal(i), 0);
  for (const it of job.items || []) if (it.callout === 'zone') {
    const waive = thr > 0 && work >= thr;
    it.rate = waive ? 0 : num(z && z.fee);
    it.desc = it.desc.replace(/ \(waived\)$/, '') + (waive ? ' (waived)' : '');
  }
}

/* ---------- message helpers ---------- */
function mobileCtx(j, extra = {}) {
  const v = vehicleOf(j), c = customerOf(j), m = j.mobile || {};
  const inv = jobInvoice(j), s = inv && !inv.void ? invoiceState(inv) : null;
  return {
    ...baseCtx(v, c), brand: brandFor(j), number: j.number, item: m.problem || j.complaint || '',
    tech: crewOf(j).join(' & ') || 'our technician', eta: m.eta || 'shortly', location: locationText(m) || '—',
    when: m.urgency === 'urgent' ? 'As soon as possible' : `${fmtDate(m.prefDate)} ${m.prefTime || ''}`.trim(),
    amount: money(s ? s.total : calcDoc(j).total), balance: money(s ? s.balance : calcDoc(j).total),
    payInfo: s ? (s.balance > 0 ? payInfoText(inv, money(s.balance)) : '') : payInfoText(null, money(calcDoc(j).total)),
    address: S.settings.address, ...extra,
  };
}
function sendMobileMsg(j, tpl, extra) {
  openMessageDialog({ vehicle: vehicleOf(j), customer: customerOf(j), type: tpl, text: fillTemplate(S.settings.templates[tpl], mobileCtx(j, extra)) });
}

/* ---------- new / edit mobile request ---------- */
function crewOptions(trades) {
  return S.technicians.filter(t => t.active !== false && (!trades || !t.trade || trades.includes(t.trade) || true)).map(t => `<option value="${t.id}">${esc(t.name)}${t.trade ? ' — ' + esc(t.trade) : ''}</option>`).join('');
}
function newMobileJob(preset = {}) {
  const m = S.settings.mob, p = preset;
  const zones = m.zones.map(z => `<option ${z.name === p.zone ? 'selected' : ''}>${esc(z.name)}</option>`).join('');
  const svc = [...m.services, ...S.settings.lists.jobType].filter((v, i, a) => a.indexOf(v) === i);
  const modal = openModal({
    title: '🚐 New mobile request', size: 'xwide',
    body: `<div class="grid g4">
      <div class="fieldset-title">Car and customer</div>
      <div class="field"><label>Number plate or VIN</label><input id="mr_plate" class="plate-input" value="${esc(p.plate || '')}" autocomplete="off"><div class="help" id="mr_match"></div></div>
      <div class="field"><label>Make</label><input id="mr_make" list="mr_makes" value="${esc(p.make || '')}"><datalist id="mr_makes">${MAKES.map(x => `<option value="${x}">`).join('')}</datalist></div>
      <div class="field"><label>Model</label><input id="mr_model" value="${esc(p.model || '')}"></div>
      <div class="field"><label>Year</label><input id="mr_year" type="number" value="${esc(p.year || '')}"></div>
      <div class="field"><label>Customer mobile <span class="req">*</span></label><input id="mr_phone" value="${esc(p.phone || '')}"><div class="help" id="mr_cmatch"></div></div>
      <div class="field span2"><label>Customer name <span class="req">*</span></label><input id="mr_name" value="${esc(p.name || '')}"></div>
      <div class="field"><label>Source</label><select id="mr_source">${['Phone call', 'WhatsApp', 'Online booking', 'Walk-in / referral', 'Fleet contract'].map(x => `<option ${x === p.source ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="fieldset-title">Location</div>
      <div class="field span2"><label>Zone <span class="req">*</span></label><select id="mr_zone">${zones}</select></div>
      <div class="field span2"><label>Area / community</label><input id="mr_area" value="${esc(p.area || '')}" placeholder="e.g. JLT Cluster D, Al Nahda 2"></div>
      <div class="field span2"><label>Address / landmark</label><input id="mr_address" value="${esc(p.address || '')}" placeholder="Building, parking level, bay number"></div>
      <div class="field span2"><label>Google Maps link or pin (optional)</label><input id="mr_map" value="${esc(p.mapLink || '')}" placeholder="Paste the location the customer shared on WhatsApp"></div>
      <div class="fieldset-title">The job</div>
      <div class="field span2"><label>Problem / service</label><input id="mr_problem" list="mr_svc" value="${esc(p.problem || '')}"><datalist id="mr_svc">${svc.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field span2"><label>When</label><div class="seg" id="mr_urg"><button type="button" data-v="urgent" class="${p.urgency === 'scheduled' ? '' : 'on'}">Urgent — ASAP</button><button type="button" data-v="scheduled" class="${p.urgency === 'scheduled' ? 'on' : ''}">Scheduled</button></div></div>
      <div class="field"><label>Date</label><input id="mr_date" type="date" value="${esc(p.prefDate || today())}"></div>
      <div class="field"><label>Time</label><input id="mr_time" type="time" value="${esc(p.prefTime || '')}"></div>
      <div class="field span2"><label>Notes</label><input id="mr_notes" value="${esc(p.notes || '')}" placeholder="Anything the crew should know"></div>
      <div class="fieldset-title">Crew (optional — can assign later)</div>
      <div class="field"><label>Technician</label><select id="mr_tech"><option value="">— later —</option>${crewOptions()}</select></div>
      <div class="field"><label>Driver</label><select id="mr_driver"><option value="">— none / same person —</option>${crewOptions()}</select></div>
      <div class="field"><label>Van</label><select id="mr_van">${m.vans.map(v => `<option value="${v.id}">${esc(v.name)}${v.plate ? ' · ' + esc(v.plate) : ''}</option>`).join('')}</select></div>
      <div class="field"><label>&nbsp;</label><div class="small muted" id="mr_fees"></div></div>
    </div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>🚐 Create mobile job</button>`,
  });
  const $m = s => modal.el.querySelector(s);
  let urgency = p.urgency === 'scheduled' ? 'scheduled' : 'urgent';
  $m('#mr_urg').querySelectorAll('button').forEach(b => b.onclick = () => { urgency = b.dataset.v; $m('#mr_urg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); showFees(); });
  const matchVehicle = () => {
    const v = exactVehicle($m('#mr_plate').value);
    if (v) {
      const c = customerOf(v) || {};
      $m('#mr_match').innerHTML = `On file: <b>${esc(vehicleLabel(v))}</b> — ${esc(c.name || '')}`;
      if (!$m('#mr_make').value) $m('#mr_make').value = v.make || '';
      if (!$m('#mr_model').value) $m('#mr_model').value = v.model || '';
      if (!$m('#mr_year').value) $m('#mr_year').value = v.year || '';
      if (!$m('#mr_phone').value) $m('#mr_phone').value = c.phone || '';
      if (!$m('#mr_name').value) $m('#mr_name').value = c.name || '';
    } else $m('#mr_match').textContent = $m('#mr_plate').value ? 'New car — it will be added' : '';
  };
  const matchCustomer = () => {
    const d = $m('#mr_phone').value.replace(/\D/g, '');
    const c = d.length >= 7 && S.customers.find(x => String(x.phone || '').replace(/\D/g, '').endsWith(d.slice(-9)));
    $m('#mr_cmatch').innerHTML = c ? `Existing customer: <b>${esc(c.name)}</b>` : '';
    if (c && !$m('#mr_name').value) $m('#mr_name').value = c.name;
  };
  const showFees = () => {
    const lines = calloutLines({ zone: $m('#mr_zone').value, urgency }, $m('#mr_date').value, $m('#mr_time').value);
    const ah = isAfterHours($m('#mr_date').value, urgency === 'urgent' ? null : $m('#mr_time').value);
    $m('#mr_fees').innerHTML = (lines.length ? lines.map(l => `${esc(l.desc)}: <b>${money(l.rate)}</b>`).join('<br>') : 'No call-out fees set yet (Settings → Mobile)') + (ah ? `<br>${pill('After hours')}` : '');
  };
  $m('#mr_plate').oninput = matchVehicle; $m('#mr_phone').oninput = matchCustomer;
  ['#mr_zone', '#mr_date', '#mr_time'].forEach(s => $m(s).onchange = showFees);
  matchVehicle(); matchCustomer(); showFees();
  $m('[data-c]').onclick = modal.close;
  $m('[data-ok]').onclick = async () => {
    try {
      const g = s => ($m(s).value || '').trim();
      if (!g('#mr_phone') || !g('#mr_name')) throw new Error('Customer name and mobile are required');
      let v = exactVehicle(g('#mr_plate')), c = v ? customerOf(v) : null;
      if (!c) {
        const d = g('#mr_phone').replace(/\D/g, '');
        c = S.customers.find(x => d.length >= 7 && String(x.phone || '').replace(/\D/g, '').endsWith(d.slice(-9)));
        if (!c) { c = await saveCustomer({ name: g('#mr_name'), phone: g('#mr_phone'), type: 'Individual' }); if (!c) return; }
      }
      if (!v) {
        const plate = g('#mr_plate').toUpperCase() || ('TEMP-' + Date.now().toString(36).slice(-5).toUpperCase());
        v = await saveVehicle({ customerId: c.id, plate, make: g('#mr_make') || 'Unknown', model: g('#mr_model') || '—', year: g('#mr_year'), status: 'Active' });
        if (!v) return;
      }
      const mob = { status: g('#mr_tech') || g('#mr_driver') ? 'Assigned' : 'New', zone: g('#mr_zone'), area: g('#mr_area'), address: g('#mr_address'), mapLink: g('#mr_map'),
        problem: g('#mr_problem'), urgency, prefDate: g('#mr_date'), prefTime: g('#mr_time'), source: g('#mr_source'), driverId: g('#mr_driver'), vanId: g('#mr_van'),
        requestId: p.requestId || '', times: { requested: p.requestedAt || new Date().toISOString() } };
      if (mob.status === 'Assigned') mob.times.assigned = new Date().toISOString();
      mob.afterHours = isAfterHours(mob.prefDate, urgency === 'urgent' ? null : mob.prefTime);
      const job = await save('jobs', {
        line: 'mobile', number: await nextNo('mjob'), date: mob.prefDate || today(), vehicleId: v.id, customerId: c.id, odometer: '', status: 'Booked',
        type: 'Mobile service', technicianId: g('#mr_tech'), promised: mob.prefDate, complaint: [mob.problem, g('#mr_notes')].filter(Boolean).join(' — '),
        items: calloutLines(mob, mob.prefDate, mob.prefTime), discount: 0, discountType: 'pct', vatRate: S.settings.vatRate, mobile: mob,
      });
      if (p.requestId) { const r = get('requests', p.requestId); if (r) { r.status = 'Accepted'; r.jobId = job.id; await save('requests', r); markRequestHandled(r); } }
      modal.close(); toast(`Mobile job ${job.number} created`, 'ok');
      go('#/job/' + job.id);
      setTimeout(async () => { if (await confirmBox('Send the customer a "request received" WhatsApp?', 'Send message')) sendMobileMsg(job, 'mobileReceived'); }, 150);
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---------- status flow ---------- */
function askEta() {
  return new Promise(resolve => {
    const mod = openModal({
      title: '🧭 On my way — estimated arrival', size: 'narrow',
      body: `<div class="row">${[10, 15, 20, 30, 45, 60].map(n => `<button class="btn" data-n="${n}">${n} min</button>`).join('')}</div>
        <div class="field mt"><label>Or type it</label><input id="eta_t" placeholder="e.g. 11:30 or 25 min"></div>`,
      foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>Continue</button>`,
    });
    const at = mins => { const d = new Date(Date.now() + mins * 60000); return `about ${mins} min (${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})`; };
    mod.el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { mod.close(); resolve(at(+b.dataset.n)); });
    mod.el.querySelector('[data-c]').onclick = () => { mod.close(); resolve(null); };
    mod.el.querySelector('[data-close]').onclick = () => { mod.close(); resolve(null); };
    mod.el.querySelector('[data-ok]').onclick = () => { const v = mod.el.querySelector('#eta_t').value.trim(); mod.close(); resolve(v ? (/^\d+$/.test(v) ? at(+v) : v) : 'shortly'); };
  });
}
function captureGeo(job) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    job.mobile.arrivedGeo = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), acc: Math.round(pos.coords.accuracy) };
    if (!job.mobile.lat) { job.mobile.lat = job.mobile.arrivedGeo.lat; job.mobile.lng = job.mobile.arrivedGeo.lng; }
    await save('jobs', job);
  }, () => { }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
async function setMobileStatus(jobId, status) {
  if (typeof edFlush === 'function') await edFlush();
  const j = get('jobs', jobId); j.mobile = j.mobile || {}; const m = j.mobile; m.times = m.times || {};
  if (status === 'Assigned' && !j.technicianId && !m.driverId) return assignCrew(jobId, true);
  if (status === 'Needs workshop') return needsWorkshop(jobId);
  if (status === 'Cancelled' && !(await confirmBox(`Cancel mobile job ${j.number}?`, 'Cancel job', true))) return;
  if (status === 'On the way') { const eta = await askEta(); if (eta === null) return; m.eta = eta; }
  m.status = status; m.times[MOB_TIME_KEY[status]] = new Date().toISOString();
  j.status = MOBILE_TO_JOB[status] || j.status;
  if (status === 'Completed') { j.completed = today(); applyCalloutRules(j); }
  await save('jobs', j);
  if (status === 'Arrived') captureGeo(j);
  render();
  if (status === 'On the way') sendMobileMsg(j, 'mobileOnWay');
  else if (status === 'Arrived') { if (await confirmBox('Let the customer know you have arrived?', 'Send WhatsApp')) sendMobileMsg(j, 'mobileArrived'); }
  else if (status === 'Completed') {
    if (!j.signatures || !j.signatures.collection) toast('Tip: ask the customer to sign on the job card', '');
    if (!jobInvoice(j) && Auth.canPage('invoice') && await confirmBox('Job complete. Create the invoice and send the customer the total with your payment link?', 'Create invoice')) {
      const inv = await makeInvoiceFromJob(j);
      go('#/invoice/' + inv.id);
      setTimeout(() => sendMobileMsg(j, 'mobileCompleted'), 250);
    } else if (jobInvoice(j)) sendMobileMsg(j, 'mobileCompleted');
  }
}
function assignCrew(jobId, thenAssign) {
  const j = get('jobs', jobId), m = j.mobile || {};
  const techs = S.technicians.filter(t => t.active !== false).map(t => [t.id, `${t.name}${t.trade ? ' — ' + t.trade : ''}`]);
  openForm({
    title: `👷 Crew for ${esc(j.number)}`, size: 'narrow', cols: 1,
    fields: [{ k: 'technicianId', label: 'Technician (does the work)', type: 'select', options: techs },
      { k: 'driverId', label: 'Driver (optional)', type: 'select', options: techs },
      { k: 'vanId', label: 'Van', type: 'select', options: S.settings.mob.vans.map(v => [v.id, v.name + (v.plate ? ' · ' + v.plate : '')]), blank: false }],
    data: { technicianId: j.technicianId, driverId: m.driverId, vanId: m.vanId || (S.settings.mob.vans[0] || {}).id },
    saveLabel: 'Assign',
    onSave: async vals => {
      if (!vals.technicianId && !vals.driverId) throw new Error('Choose at least one person');
      j.technicianId = vals.technicianId; m.driverId = vals.driverId; m.vanId = vals.vanId; j.mobile = m;
      if (!m.status || m.status === 'New') { m.status = 'Assigned'; m.times = m.times || {}; m.times.assigned = new Date().toISOString(); }
      await save('jobs', j); toast('Crew assigned', 'ok'); render();
    },
  });
}
function needsWorkshop(jobId) {
  const j = get('jobs', jobId);
  openForm({
    title: `🏬 Needs workshop — ${esc(j.number)}`, size: 'narrow', cols: 2,
    fields: [{ k: 'date', label: 'Workshop date', type: 'date', req: true, def: addDays(today(), 1) }, { k: 'time', label: 'Time', type: 'time', req: true, def: '09:00' },
      { k: 'service', label: 'Service', type: 'select', options: S.settings.lists.jobType, def: 'Mechanical Repair', blank: false },
      { k: 'recovery', label: 'Recovery / towing needed', type: 'checkbox' },
      { k: 'notes', label: 'What was found (goes on the booking)', type: 'textarea', span: 'all', def: [j.complaint, j.diagnosis].filter(Boolean).join('\n') }],
    saveLabel: 'Book into workshop',
    onSave: async vals => {
      const b = await save('bookings', { date: vals.date, time: vals.time, vehicleId: j.vehicleId, customerId: j.customerId, plate: (vehicleOf(j) || {}).plate, service: vals.service, duration: 2, status: 'Confirmed',
        notes: `From mobile job ${j.number}${vals.recovery ? ' — RECOVERY NEEDED' : ''}: ${vals.notes || ''}`, fromJobId: j.id });
      const m = j.mobile = j.mobile || {}; m.times = m.times || {};
      m.status = 'Needs workshop'; m.times.needsWorkshop = new Date().toISOString(); m.bookingId = b.id;
      const charged = (j.items || []).some(i => lineTotal(i) > 0);
      j.status = charged ? 'Delivered' : 'Cancelled'; if (charged) j.completed = today();
      await save('jobs', j); render();
      setTimeout(() => sendMobileMsg(j, 'needsWorkshop', { date: fmtDate(vals.date), time: vals.time }), 150);
    },
  });
}
async function recalcCallout(jobId) {
  const j = get('jobs', jobId), m = j.mobile || {};
  j.items = (j.items || []).filter(i => !i.callout).concat(calloutLines(m, m.prefDate || j.date, m.prefTime));
  applyCalloutRules(j); await save('jobs', j); toast('Call-out fees updated', 'ok'); render();
}
function editMobileDetails(jobId) {
  const j = get('jobs', jobId), m = j.mobile || {};
  openForm({
    title: `📍 Location & details — ${esc(j.number)}`, size: 'wide', cols: 2,
    fields: [{ k: 'zone', label: 'Zone', type: 'select', options: S.settings.mob.zones.map(z => z.name), blank: false }, { k: 'area', label: 'Area / community' },
      { k: 'address', label: 'Address / landmark', span: 'all' }, { k: 'mapLink', label: 'Google Maps link', span: 'all' },
      { k: 'problem', label: 'Problem / service', span: 'all' }, { k: 'urgency', label: 'When', type: 'select', options: [['urgent', 'Urgent — ASAP'], ['scheduled', 'Scheduled']], blank: false },
      { k: 'prefDate', label: 'Date', type: 'date' }, { k: 'prefTime', label: 'Time', type: 'time' }],
    data: m,
    onSave: async vals => { Object.assign(m, vals); m.afterHours = isAfterHours(m.prefDate, m.urgency === 'urgent' ? null : m.prefTime); j.mobile = m; await save('jobs', j); render(); },
  });
}

/* ---------- job page panel ---------- */
function mobilePanelHTML(j) {
  const m = j.mobile || {}, t = m.times || {}, st = m.status || 'New';
  const idx = MOBILE_STATUSES.indexOf(st);
  const map = mapsLink(m), c = customerOf(j) || {};
  const steps = MOBILE_STATUSES.slice(0, 6).map((s, i) => `<div class="st ${s === st ? 'on' : i < idx && idx < 6 ? 'done' : ''}" onclick="setMobileStatus('${j.id}',${jsq(s)})">${esc(s)}</div>`).join('');
  const timeRows = MOBILE_STATUSES.map(s => t[MOB_TIME_KEY[s]] ? `<dt>${esc(s)}</dt><dd>${new Date(t[MOB_TIME_KEY[s]]).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>` : '').join('');
  const next = MOB_NEXT[st];
  return `<div class="card mb" style="border-color:var(--accent)"><div class="card-head" style="background:var(--accentSoft)"><h3>🚐 ${esc(S.settings.brandMobile || 'MendTech Mobile')} — ${pill(st)}</h3>
      <div class="actions">${m.urgency === 'urgent' ? pill('Urgent') : ''}${m.afterHours ? pill('After hours') : ''}</div></div>
    <div class="card-pad">
      <div class="stepper mb">${steps}</div>
      ${next ? `<div class="row mb"><button class="btn primary lg" onclick="setMobileStatus('${j.id}',${jsq(next)})">${MOB_NEXT_LABEL[st]}</button>
        ${map ? `<a class="btn lg" href="${esc(map)}" target="_blank" rel="noopener">🧭 Navigate</a>` : ''}
        ${c.phone && (!isRestricted() || Auth.role().customerDetail === 'contact') ? `<a class="btn lg" href="tel:+${waNumber(c.phone)}">📞 Call</a>` : ''}
        <button class="btn lg" onclick="sendMobileMsg(get('jobs','${j.id}'),'mobileOnWay')">💬 Message</button></div>` : ''}
      <div class="grid g2">
        <dl class="kv"><dt>Problem</dt><dd>${esc(m.problem || '—')}</dd><dt>When</dt><dd>${m.urgency === 'urgent' ? 'ASAP (urgent)' : esc(`${fmtDate(m.prefDate)} ${m.prefTime || ''}`)}</dd>
          <dt>Location</dt><dd>${esc(locationText(m) || '—')}${map ? ` · <a href="${esc(map)}" target="_blank" rel="noopener">map</a>` : ''}</dd><dt>Zone</dt><dd>${esc(m.zone || '—')}</dd>
          <dt>Crew</dt><dd>${esc(crewOf(j).join(' + ') || '—')} · ${esc((S.settings.mob.vans.find(v => v.id === m.vanId) || S.settings.mob.vans[0] || {}).name || '')} <a onclick="assignCrew('${j.id}')">change</a></dd>
          <dt>Source</dt><dd>${esc(m.source || '—')}</dd></dl>
        <dl class="kv">${timeRows}<dt>Response</dt><dd><b>${fmtMins(responseMinutes(j))}</b></dd>
          ${m.arrivedGeo ? `<dt>Arrival GPS</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${m.arrivedGeo.lat},${m.arrivedGeo.lng}" target="_blank" rel="noopener">${m.arrivedGeo.lat}, ${m.arrivedGeo.lng}</a> (±${m.arrivedGeo.acc} m)</dd>` : ''}</dl>
      </div>
      <div class="row mt"><button class="btn sm" onclick="editMobileDetails('${j.id}')">📍 Edit location & details</button><button class="btn sm" onclick="recalcCallout('${j.id}')">🔄 Recalculate call-out</button>
        ${MOBILE_OPEN.includes(st) ? `<button class="btn sm" onclick="setMobileStatus('${j.id}','Needs workshop')">🏬 Needs workshop</button><button class="btn sm danger" onclick="setMobileStatus('${j.id}','Cancelled')">Cancel</button>` : ''}
        ${m.bookingId ? `<a class="btn sm" onclick="go('#/bookings')">Workshop booking made</a>` : ''}</div>
    </div></div>`;
}

/* ---------- Dispatch board ---------- */
PAGES.dispatch = () => {
  const mob = S.jobs.filter(isMobile);
  const open = mob.filter(j => MOBILE_OPEN.includes((j.mobile || {}).status || 'New'));
  const doneToday = mob.filter(j => ['Completed', 'Needs workshop'].includes((j.mobile || {}).status) && (((j.mobile.times || {}).completed || (j.mobile.times || {}).needsWorkshop || '').slice(0, 10) === today()));
  const resp = mob.map(responseMinutes).filter(x => x != null);
  const avg = resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null;
  const newReq = S.requests.filter(r => r.status === 'New').length;
  const col = (title, statuses, list) => {
    const items = list.filter(j => statuses.includes((j.mobile || {}).status || 'New')).sort((a, b) => ((b.mobile || {}).urgency === 'urgent') - ((a.mobile || {}).urgency === 'urgent') || ((a.mobile.times || {}).requested || '').localeCompare((b.mobile.times || {}).requested || ''));
    return `<div class="dcol"><div class="dcol-h">${title} <span class="faint">${items.length}</span></div>${items.map(dispatchCard).join('') || '<div class="faint small center" style="padding:14px">—</div>'}</div>`;
  };
  view().innerHTML = pageHead(`🚐 ${esc(S.settings.brandMobile || 'MendTech Mobile')} — dispatch`, `${S.settings.mob.allDay ? 'Open 24/7' : `Hours ${esc(S.settings.mob.hoursStart)}–${esc(S.settings.mob.hoursEnd)} · after that: urgent calls`}`,
    `${newReq ? `<button class="btn" onclick="go('#/requests')">📥 Online requests <span class="pill red">${newReq}</span></button>` : `<button class="btn" onclick="go('#/requests')">📥 Online requests</button>`}
     <button class="btn" onclick="go('#/myjobs')">📱 Crew view</button><button class="btn primary" onclick="newMobileJob()">＋ New mobile request</button>`) +
    `<div class="grid g4 mb">
      <div class="kpi"><div class="lbl">Open mobile jobs</div><div class="val">${open.length}</div><div class="hint">${open.filter(j => j.mobile.urgency === 'urgent').length} urgent</div></div>
      <div class="kpi"><div class="lbl">Completed today</div><div class="val">${doneToday.length}</div><div class="hint">${money(doneToday.reduce((a, j) => a + jobTotals(j).total, 0))}</div></div>
      <div class="kpi"><div class="lbl">Avg. response</div><div class="val">${fmtMins(avg)}</div><div class="hint">request → arrival, all jobs</div></div>
      <div class="kpi link" onclick="go('#/requests')"><div class="lbl">Online requests waiting</div><div class="val ${newReq ? 'red' : ''}">${newReq}</div><div class="hint">accept or decline</div></div></div>
    <div class="dboard">${col('New', ['New'], open)}${col('Assigned', ['Assigned'], open)}${col('On the way', ['On the way'], open)}${col('On site', ['Arrived', 'Working'], open)}${col('Done today', ['Completed', 'Needs workshop'], doneToday)}</div>
    <div class="card mt"><div class="card-head"><h3>All mobile jobs</h3></div>${table([
      { h: 'Job', v: j => `<b>${esc(j.number)}</b>` }, { h: 'Date', v: j => fmtDate(j.date) }, { h: 'Vehicle', v: j => plateTag(vehicleOf(j)) }, { h: 'Customer', v: j => esc((customerOf(j) || {}).name) },
      { h: 'Zone', v: j => `<span class="small">${esc(((j.mobile || {}).zone || '').split('(')[0])}</span>` }, { h: 'Crew', v: j => esc(crewOf(j).join(', ')) },
      { h: 'Status', v: j => pill((j.mobile || {}).status || 'New') }, { h: 'Response', cls: 'num', v: j => fmtMins(responseMinutes(j)) }, { h: 'Total', cls: 'num', v: j => money(jobTotals(j).total, false) }],
      [...mob].sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number)).slice(0, 60), { click: j => `go('#/job/${j.id}')`, empty: 'No mobile jobs yet — click “New mobile request”.', emptyIcon: '🚐' })}</div>`;
};
/* Dashboard card */
function mobileTodayHTML() {
  const open = S.jobs.filter(j => isMobile(j) && MOBILE_OPEN.includes((j.mobile || {}).status || 'New'));
  const reqs = S.requests.filter(r => (r.status || 'New') === 'New');
  if (!open.length && !reqs.length) return '';
  return `<div class="card mb"><div class="card-head"><h3>🚐 ${esc(S.settings.brandMobile || 'MendTech Mobile')} — live</h3><div class="actions">
      ${reqs.length ? `<button class="btn sm primary" onclick="go('#/requests')">📥 ${reqs.length} online request${reqs.length > 1 ? 's' : ''}</button>` : ''}<button class="btn sm" onclick="go('#/dispatch')">Dispatch board</button></div></div>
    ${open.slice(0, 6).map(j => { const m = j.mobile || {}; return `<div class="alert-row" style="cursor:pointer" onclick="go('#/job/${j.id}')"><div class="alert-ico" style="background:var(--accentSoft)">🚐</div>
      <div class="grow"><b>${esc(j.number)} · ${esc(m.problem || 'Mobile service')}</b> ${m.urgency === 'urgent' ? pill('Urgent') : ''}<div class="small muted">${plateTag(vehicleOf(j))} ${esc((customerOf(j) || {}).name || '')} · ${esc(m.area || (m.zone || '').split('(')[0])} · ${esc(crewOf(j).join(' + ') || 'not assigned')}</div></div>${pill(m.status || 'New')}</div>`; }).join('')}</div>`;
}
function dispatchCard(j) {
  const m = j.mobile || {}, v = vehicleOf(j) || {}, c = customerOf(j) || {}, t = m.times || {};
  const since = t.requested ? minutesBetween(t.requested, new Date().toISOString()) : null;
  const next = MOB_NEXT[m.status || 'New'];
  return `<div class="dcard ${m.urgency === 'urgent' ? 'urgent' : ''}" onclick="go('#/job/${j.id}')">
    <div class="row" style="justify-content:space-between"><b>${esc(j.number)}</b>${m.urgency === 'urgent' ? pill('Urgent') : `<span class="small muted">${esc(fmtDate(m.prefDate))} ${esc(m.prefTime || '')}</span>`}</div>
    <div class="mt-s"><b>${esc(m.problem || j.complaint || 'Mobile service')}</b></div>
    <div class="small">${plateTag(v)} ${esc(vehicleLabel(v))}</div>
    <div class="small muted">${esc(c.name || '')} · ${esc(m.area || (m.zone || '').split('(')[0])}</div>
    <div class="small muted">${crewOf(j).length ? '👷 ' + esc(crewOf(j).join(' + ')) : 'Not assigned'}${m.status === 'On the way' && m.eta ? ' · ETA ' + esc(m.eta) : ''}</div>
    ${MOBILE_OPEN.includes(m.status || 'New') && ['New', 'Assigned', 'On the way'].includes(m.status || 'New') && m.urgency === 'urgent' && since != null ? `<div class="small ${since > 60 ? 'red strong' : since > 30 ? 'amber strong' : 'faint'}">⏰ ${fmtMins(since)} since call</div>` : ''}
    ${next ? `<button class="btn sm mt-s" onclick="event.stopPropagation();setMobileStatus('${j.id}',${jsq(next)})">${MOB_NEXT_LABEL[m.status || 'New']}</button>` : ''}
  </div>`;
}

/* ---------- Crew phone screen ---------- */
function myTechId() { return Auth.user ? Auth.user.techId || (S.technicians.find(t => t.name.toLowerCase() === Auth.user.name.toLowerCase()) || {}).id : ''; }
PAGES.myjobs = () => {
  const me = myTechId(), crew = isRestricted(), pick = crew ? (me || '-') : getFilter('myjobs', 'who', me || 'all');
  const mine = j => pick === 'all' || j.technicianId === pick || (j.mobile || {}).driverId === pick;
  const shop = S.jobs.filter(j => !isMobile(j) && OPEN_JOB.includes(j.status) && pick !== 'all' && j.technicianId === pick && Auth.role().customerDetail !== 'contact');
  const open = S.jobs.filter(j => isMobile(j) && MOBILE_OPEN.includes((j.mobile || {}).status || 'New') && mine(j))
    .sort((a, b) => ((b.mobile || {}).urgency === 'urgent') - ((a.mobile || {}).urgency === 'urgent') || ((a.mobile.prefDate || '') + (a.mobile.prefTime || '')).localeCompare((b.mobile.prefDate || '') + (b.mobile.prefTime || '')));
  const done = S.jobs.filter(j => isMobile(j) && mine(j) && ['Completed', 'Needs workshop'].includes((j.mobile || {}).status) && ((j.mobile.times || {}).completed || (j.mobile.times || {}).needsWorkshop || '').slice(0, 10) === today());
  const who = S.technicians.filter(t => t.active !== false);
  view().innerHTML = `<div class="page-head"><div><h1>📱 My jobs</h1><div class="sub">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${open.length} to do · ${done.length} done</div></div>
      ${crew ? '' : `<div class="actions"><select class="inp" onchange="setFilter('myjobs','who',this.value)"><option value="all">Everyone</option>${who.map(t => `<option value="${t.id}" ${pick === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>`}</div>
    ${crew && !me ? `<div class="card card-pad mb amber">Your login is not linked to a Technicians entry yet — ask the Owner to link it (Settings → Staff &amp; security).</div>` : ''}
    ${shop.length ? `<h3 class="mb" style="font-size:15px">🔧 Workshop jobs</h3>${shop.map(j => { const v = vehicleOf(j) || {}; return `<div class="card card-pad mb row" onclick="go('#/job/${j.id}')" style="cursor:pointer">${plateTag(v)} <div class="grow"><b>${esc(j.number)}</b> · ${esc(vehicleLabel(v))}<div class="small muted">${esc((j.complaint || '').slice(0, 80))}</div></div>${pill(j.status)}</div>`; }).join('')}<h3 class="mb mt" style="font-size:15px">🚐 Mobile jobs</h3>` : ''}
    ${open.length ? open.map(crewCard).join('') : `<div class="card card-pad"><div class="empty"><div class="big">🎉</div>No open jobs${pick === 'all' ? '' : ' for you'} right now.</div></div>`}
    ${done.length ? `<h3 class="mt mb" style="font-size:15px">Done today</h3>${done.map(j => `<div class="card card-pad mb row" onclick="go('#/job/${j.id}')" style="cursor:pointer"><b>${esc(j.number)}</b> ${plateTag(vehicleOf(j))} <span class="grow muted small">${esc((j.mobile || {}).problem || '')}</span>${pill(j.mobile.status)} ${pill(jobTotals(j).status)}</div>`).join('')}` : ''}`;
};
function crewCard(j) {
  const m = j.mobile || {}, v = vehicleOf(j) || {}, c = customerOf(j) || {}, map = mapsLink(m), st = m.status || 'New', next = MOB_NEXT[st];
  const inv = jobInvoice(j);
  return `<div class="card mb crew-card ${m.urgency === 'urgent' ? 'urgent' : ''}"><div class="card-pad">
    <div class="row" style="justify-content:space-between"><div><b style="font-size:17px">${esc(m.problem || 'Mobile service')}</b><div class="small muted">${esc(j.number)} · ${m.urgency === 'urgent' ? 'ASAP' : esc(`${fmtDate(m.prefDate)} ${m.prefTime || ''}`)}</div></div><div>${pill(st)} ${m.urgency === 'urgent' ? pill('Urgent') : ''}</div></div>
    <div class="mt-s">${plateTag(v)} <b>${esc(vehicleLabel(v))}</b></div>
    <div class="mt-s">${esc(c.name || '')}${!isRestricted() || Auth.role().customerDetail === 'contact' ? ` · <a href="tel:+${waNumber(c.phone)}">${esc(c.phone || '')}</a>` : ''}</div>
    <div class="muted">${esc(locationText(m) || m.zone || '')}</div>
    ${m.eta && st === 'On the way' ? `<div class="small">ETA ${esc(m.eta)}</div>` : ''}
    <div class="crew-btns">
      ${next ? `<button class="btn primary lg" onclick="setMobileStatus('${j.id}',${jsq(next)})">${MOB_NEXT_LABEL[st]}</button>` : ''}
      ${map ? `<a class="btn lg" href="${esc(map)}" target="_blank" rel="noopener">🧭 Navigate</a>` : ''}
      ${c.phone && (!isRestricted() || Auth.role().customerDetail === 'contact') ? `<a class="btn lg" href="tel:+${waNumber(c.phone)}">📞 Call</a>` : ''}
      <button class="btn lg" onclick="go('#/job/${j.id}')">🔧 Job card</button>
      ${inv && !isRestricted() && invoiceState(inv).balance > 0 && payLinkFor(inv) ? `<button class="btn lg" onclick="showPayQR(get('invoices','${inv.id}'))">▦ Pay QR</button>` : ''}
    </div></div></div>`;
}

/* ---------- Van stock ---------- */
PAGES.van = () => {
  const vans = S.settings.mob.vans;
  const vid = getFilter('van', 'id', (vans[0] || {}).id);
  const van = vans.find(v => v.id === vid) || vans[0];
  if (!van) { view().innerHTML = pageHead('Van stock') + '<div class="empty">Add a van in Settings → Mobile.</div>'; return; }
  const usedToday = {};
  for (const j of S.jobs) if (isMobile(j) && jobLocation(j) === van.id && j.status !== 'Cancelled' && ((j.mobile.times || {}).completed || j.date || '').slice(0, 10) === today()) for (const it of j.items || []) if (it.type === 'part') usedToday[it.partId] = (usedToday[it.partId] || 0) + num(it.qty);
  const rows = stockTable().map(r => ({ ...r, van: r.loc[van.id] || 0, ws: r.loc[WORKSHOP] || 0, min: num((r.p.vanMin || {})[van.id]), used: usedToday[r.p.id] || 0 }))
    .filter(r => r.van || r.min || r.used || getFilter('van', 'all'));
  rows.forEach(r => r.refill = Math.max(0, r.min - r.van));
  const refill = rows.filter(r => r.refill > 0);
  view().innerHTML = pageHead(`🚐 Van stock — ${esc(van.name)}${van.plate ? ' · ' + esc(van.plate) : ''}`, 'Parts carried on the van. Mobile jobs use van stock; “Load van” moves parts from the workshop.',
    `${vans.length > 1 ? `<select class="inp" onchange="setFilter('van','id',this.value)">${vans.map(v => `<option value="${v.id}" ${v.id === van.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : ''}
     <button class="btn" onclick="vanTransfer('${van.id}','return')">↩ Return to workshop</button><button class="btn" onclick="vanCount('${van.id}')">📋 Count van stock</button><button class="btn primary" onclick="vanTransfer('${van.id}','load')">🔄 Load van</button>`) +
    `<div class="grid g4 mb"><div class="kpi"><div class="lbl">Parts on van</div><div class="val">${rows.filter(r => r.van > 0).length}</div></div>
      ${isRestricted() ? '' : `<div class="kpi"><div class="lbl">Van stock value</div><div class="val">${money(rows.reduce((a, r) => a + r.van * num(r.p.cost), 0), false)}</div></div>`}
      <div class="kpi"><div class="lbl">Used today</div><div class="val">${Object.values(usedToday).reduce((a, b) => a + b, 0)}</div></div>
      <div class="kpi link" onclick="vanTransfer('${van.id}','load',true)"><div class="lbl">To refill tonight</div><div class="val ${refill.length ? 'amber' : ''}">${refill.length}</div><div class="hint">below the van minimum</div></div></div>
    <div class="filters"><label class="small row"><input type="checkbox" ${getFilter('van', 'all') ? 'checked' : ''} onchange="setFilter('van','all',this.checked)"> show all parts (to set van minimums)</label></div>
    <div class="card">${table([{ h: 'Part', v: r => `<b>${esc(r.p.name)}</b><div class="small faint">${esc(r.p.partNumber || '')}</div>` },
      { h: 'On van', cls: 'num', v: r => `<b class="${r.van <= 0 ? 'red' : r.van < r.min ? 'amber' : ''}">${fmtNum(r.van)}</b>` }, { h: 'Van minimum', cls: 'num', v: r => `<input class="inp sm right" style="width:70px" type="number" value="${r.min || ''}" onclick="event.stopPropagation()" onchange="setVanMin('${r.p.id}','${van.id}',this.value)">` },
      { h: 'Used today', cls: 'num', v: r => r.used ? fmtNum(r.used) : '' }, { h: 'To refill', cls: 'num', v: r => r.refill ? `<b class="amber">${fmtNum(r.refill)}</b>` : '' }, { h: 'In workshop', cls: 'num', v: r => fmtNum(r.ws) }],
      rows.sort((a, b) => b.refill - a.refill || a.p.name.localeCompare(b.p.name)), { empty: 'Nothing on the van yet. Tick “show all parts” to set minimums, then “Load van”.', emptyIcon: '🚐' })}</div>`;
};
async function setVanMin(partId, vanId, val) { const p = get('parts', partId); p.vanMin = { ...(p.vanMin || {}), [vanId]: num(val) }; await save('parts', p); toast('Van minimum saved'); }
function vanTransfer(vanId, dir, refillOnly) {
  const van = S.settings.mob.vans.find(v => v.id === vanId);
  const rows = stockTable().map(r => ({ r, van: r.loc[vanId] || 0, ws: r.loc[WORKSHOP] || 0, min: num((r.p.vanMin || {})[vanId]) }))
    .filter(x => dir === 'load' ? (refillOnly ? x.min > x.van : x.ws > 0 || x.min > x.van) : x.van > 0);
  const m = openModal({
    title: dir === 'load' ? `🔄 Load ${esc(van.name)} from workshop` : `↩ Return from ${esc(van.name)} to workshop`, size: 'wide',
    body: rows.length ? `<p class="muted" style="margin-top:0">${dir === 'load' ? 'Quantities are pre-filled to bring the van up to its minimum.' : 'Enter what goes back to the workshop shelf.'}</p>
      <table class="tbl"><thead><tr><th>Part</th><th class="num">${dir === 'load' ? 'Workshop' : 'On van'}</th><th class="num">On van</th><th class="num">Move</th></tr></thead><tbody>
      ${rows.map((x, i) => `<tr><td>${esc(x.r.p.name)}</td><td class="num">${fmtNum(dir === 'load' ? x.ws : x.van)}</td><td class="num">${fmtNum(x.van)}</td><td class="num"><input class="inp sm right" style="width:80px" type="number" min="0" data-i="${i}" value="${dir === 'load' ? Math.max(0, Math.min(x.min - x.van, x.ws)) || '' : ''}"></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing to move.</div>',
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>Move stock</button>`,
  });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    let n = 0;
    for (const inp of m.el.querySelectorAll('input[data-i]')) {
      const q = num(inp.value); if (q <= 0) continue;
      const x = rows[+inp.dataset.i], tid = uid(), from = dir === 'load' ? WORKSHOP : vanId, to = dir === 'load' ? vanId : WORKSHOP;
      const reason = dir === 'load' ? `Loaded onto ${van.name}` : `Returned from ${van.name}`;
      await save('stockAdjustments', { partId: x.r.p.id, qty: -q, location: from, transferId: tid, reason, date: today() });
      await save('stockAdjustments', { partId: x.r.p.id, qty: q, location: to, transferId: tid, reason, date: today() });
      n++;
    }
    m.close(); toast(n ? `${n} part(s) moved` : 'Nothing moved', n ? 'ok' : ''); render();
  };
}
function vanCount(vanId) {
  const van = S.settings.mob.vans.find(v => v.id === vanId);
  const rows = stockTable().filter(r => (r.loc[vanId] || 0) !== 0 || num((r.p.vanMin || {})[vanId]) > 0);
  const m = openModal({
    title: `📋 Count ${esc(van.name)}`, size: 'wide',
    body: rows.length ? `<p class="muted" style="margin-top:0">Type what is physically on the van. Differences are recorded as adjustments.</p><table class="tbl"><thead><tr><th>Part</th><th class="num">System</th><th class="num">Counted</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${esc(r.p.name)}</td><td class="num">${fmtNum(r.loc[vanId] || 0)}</td><td class="num"><input class="inp sm right" style="width:80px" type="number" data-i="${i}" placeholder="${fmtNum(r.loc[vanId] || 0)}"></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing on this van.</div>',
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-ok>Save count</button>`,
  });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    let n = 0;
    for (const inp of m.el.querySelectorAll('input[data-i]')) {
      if (inp.value === '') continue;
      const r = rows[+inp.dataset.i], diff = r2(num(inp.value) - (r.loc[vanId] || 0));
      if (diff) { await save('stockAdjustments', { partId: r.p.id, qty: diff, location: vanId, reason: `Van count (${van.name})`, date: today() }); n++; }
    }
    m.close(); toast(n ? `${n} difference(s) recorded` : 'Count matches — no changes', 'ok'); render();
  };
}
