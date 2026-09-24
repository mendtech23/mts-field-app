/* GaragePro — bookings, service packages, e-signatures, amount in words */
'use strict';

/* =================== BOOKINGS / APPOINTMENTS =================== */
const BOOKING_STATUSES = ['Booked', 'Confirmed', 'Arrived', 'No-show', 'Cancelled'];
Object.assign(PILL_COLORS, { Confirmed: 'green', Arrived: 'violet', 'No-show': 'red' });

function bookingParty(b) {
  const v = get('vehicles', b.vehicleId), c = get('customers', b.customerId) || (v && customerOf(v));
  return { v, c: c || { name: b.name, phone: b.phone } };
}
function bookingFields() {
  return [
    { k: 'date', label: 'Date', type: 'date', req: true, def: today() }, { k: 'time', label: 'Time', type: 'time', req: true, def: '09:00' },
    { k: 'plate', label: 'Number plate', type: 'plate', help: 'Existing cars are linked automatically' }, { k: 'service', label: 'Service', type: 'select', options: S.settings.lists.jobType, def: S.settings.lists.jobType[0] },
    { k: 'name', label: 'Customer name (new customers)' }, { k: 'phone', label: 'Mobile (new customers)', type: 'tel' },
    { k: 'duration', label: 'Expected duration (hours)', type: 'number', def: 1 }, { k: 'status', label: 'Status', type: 'select', options: BOOKING_STATUSES, def: 'Booked', blank: false },
    { k: 'notes', label: 'Notes / customer request', type: 'textarea', span: 'all' }];
}
function editBooking(id, preset = {}) {
  const b = get('bookings', id);
  const data = b ? { ...b, plate: b.plate || (get('vehicles', b.vehicleId) || {}).plate } : preset;
  openForm({
    title: b ? 'Edit booking' : 'New booking', fields: bookingFields(), data,
    onSave: async vals => {
      const o = b || {};
      Object.assign(o, vals);
      const v = vals.plate ? exactVehicle(vals.plate) : null;
      o.vehicleId = v ? v.id : ''; o.customerId = v ? v.customerId : '';
      if (!v && !vals.name) throw new Error('Enter the customer name (or a plate that is already in the system)');
      await save('bookings', o);
      render();
      if (!b && await confirmBox('Booking saved. Send a WhatsApp confirmation to the customer?', 'Send confirmation')) sendBookingMsg(o.id, 'booking');
    },
    onDelete: b ? async () => { if (!(await confirmBox('Delete this booking?', 'Delete', true))) return false; await remove('bookings', b.id); render(); return true; } : null,
  });
}
function sendBookingMsg(id, tpl) {
  const b = get('bookings', id), { v, c } = bookingParty(b);
  const ctx = { ...baseCtx(v, c), plate: v ? v.plate : (b.plate || ''), date: fmtDate(b.date), time: b.time, item: b.service, address: S.settings.address };
  openMessageDialog({ vehicle: v, customer: c, type: tpl, text: fillTemplate(S.settings.templates[tpl], ctx) });
}
async function bookingStatus(id, s) { const b = get('bookings', id); b.status = s; await save('bookings', b); render(); }
async function bookingCheckIn(id) {
  const b = get('bookings', id);
  const v = get('vehicles', b.vehicleId) || (b.plate ? exactVehicle(b.plate) : null);
  b.status = 'Arrived'; await save('bookings', b);
  if (!v) return go('#/checkin/' + encodeURIComponent(b.plate || ''));
  const j = await save('jobs', { number: await nextNo('job'), date: today(), vehicleId: v.id, customerId: v.customerId, odometer: '', items: [], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate, status: 'Booked', type: b.service, complaint: b.notes || b.service, promised: today(), bookingId: b.id });
  b.jobId = j.id; await save('bookings', b);
  toast(`Job card ${j.number} opened`, 'ok'); go('#/job/' + j.id);
}
function bookingRowHTML(b) {
  const { v, c } = bookingParty(b);
  return `<div class="alert-row"><div class="alert-ico" style="background:var(--blueSoft);font-weight:800;font-size:12px;width:54px">${esc(b.time || '')}</div>
    <div class="grow"><b>${v ? plateTag(v) + ' ' + esc(vehicleLabel(v)) : esc(b.plate || 'New vehicle')}</b> · ${esc(c.name || '')} <span class="small muted">${esc(c.phone || '')}</span>
      <div class="small muted">${esc(b.service || '')}${b.notes ? ' — ' + esc(b.notes) : ''}${b.duration ? ` · ${fmtNum(b.duration)} h` : ''}</div></div>
    ${pill(b.status || 'Booked')}
    ${b.jobId ? `<button class="btn sm" onclick="go('#/job/${b.jobId}')">Job</button>` : ['Booked', 'Confirmed'].includes(b.status || 'Booked') ? `<button class="btn sm primary" onclick="bookingCheckIn('${b.id}')">Check in</button>` : ''}
    <button class="btn sm wa" onclick="sendBookingMsg('${b.id}','booking')">WhatsApp</button><button class="btn sm ghost" onclick="editBooking('${b.id}')">Edit</button></div>`;
}
PAGES.bookings = () => {
  const day = getFilter('bookings', 'day', today());
  const start = addDays(day, -((new Date(day + 'T00:00:00').getDay() + 6) % 7));   // Monday
  const week = [...Array(7)].map((_, i) => addDays(start, i));
  const list = S.bookings.filter(b => b.date === day).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const hours = list.filter(b => !['Cancelled', 'No-show'].includes(b.status)).reduce((a, b) => a + num(b.duration || 1), 0);
  view().innerHTML = pageHead('Bookings & appointments', 'Plan the workshop, confirm by WhatsApp, and check cars in with one click.', `<button class="btn primary" onclick="editBooking(null,{date:'${day}'})">＋ New booking</button>`) +
    `<div class="row mb"><button class="btn" onclick="setFilter('bookings','day','${addDays(day, -7)}')">‹ Week</button>
      ${week.map(d => { const n = S.bookings.filter(b => b.date === d && b.status !== 'Cancelled').length; return `<button class="btn ${d === day ? 'dark' : ''}" style="flex-direction:column;gap:0;min-width:76px" onclick="setFilter('bookings','day','${d}')"><span class="small">${new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}${d === today() ? ' •' : ''}</span><b>${new Date(d + 'T00:00:00').getDate()}</b><span class="small ${n ? '' : 'faint'}">${n} booked</span></button>`; }).join('')}
      <button class="btn" onclick="setFilter('bookings','day','${addDays(day, 7)}')">Week ›</button><button class="btn ghost" onclick="setFilter('bookings','day','${today()}')">Today</button>
      <input type="date" class="inp" style="width:auto" value="${day}" onchange="setFilter('bookings','day',this.value)"></div>
    <div class="card"><div class="card-head"><h3>${new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><span class="small muted">${list.length} booking(s) · ${fmtNum(hours)} workshop hours</span></div>
      ${list.length ? list.map(bookingRowHTML).join('') : '<div class="empty"><div class="big">📅</div>No bookings on this day.</div>'}</div>`;
};
function todaysBookingsHTML() {
  const list = S.bookings.filter(b => b.date === today() && !['Cancelled'].includes(b.status)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  if (!list.length) return '';
  return `<div class="card mb"><div class="card-head"><h3>📅 Today's bookings (${list.length})</h3><div class="actions"><button class="btn sm" onclick="go('#/bookings')">Calendar</button></div></div>${list.map(bookingRowHTML).join('')}</div>`;
}

/* =================== SERVICE PACKAGES =================== */
KINDS.package = { coll: 'packages', label: 'Service Package', list: '#/packages' };
PAGES.packages = () => {
  view().innerHTML = pageHead('Service packages', 'Ready-made bundles (e.g. Minor service, Major service, AC service) — add them to a quote or job in one click. Prices always use today\'s part and labour rates.',
    `<button class="btn primary" onclick="newPackage()">＋ New package</button>`) +
    `<div class="card">${table([{ h: 'Package', v: p => `<b>${esc(p.name)}</b><div class="small muted">${esc(p.description || '')}</div>` },
      { h: 'Contents', v: p => `<span class="small">${esc((p.items || []).map(i => i.desc).join(', '))}</span>` },
      { h: 'Price incl. VAT', cls: 'num', v: p => `<b>${money(calcDoc({ ...p, items: refreshPackageItems(p.items) }).total, false)}</b>` }],
      S.packages, { click: p => `go('#/package/${p.id}')`, empty: 'No packages yet. Create “Minor service” with oil, filter and labour to speed up quoting.' })}</div>`;
};
async function newPackage() {
  const p = await save('packages', { name: 'New package', description: '', items: [], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate, number: '' });
  go('#/package/' + p.id);
}
PAGES.package = id => {
  const p = get('packages', id); if (!p) { view().innerHTML = '<div class="empty">Package not found.</div>'; return; }
  ED.kind = 'package'; ED.doc = p;
  view().innerHTML = docShell({
    kind: 'package', title: 'Service package', status: '',
    actions: `<button class="btn danger" onclick="deletePackage()">Delete</button><button class="btn primary" onclick="edFlush().then(()=>go('#/packages'))">✔ Done</button>`,
    header: `<div class="grid g2">${field('Package name', inpText('name', p.name, 'e.g. Minor service — sedan'))}${field('Description (shown when picking)', inpText('description', p.description))}</div>`,
    main: '', side: '',
  });
};
async function deletePackage() { if (!(await confirmBox('Delete this package?', 'Delete', true))) return; clearTimeout(ED.timer); ED.timer = null; await remove('packages', ED.doc.id); ED.doc = null; go('#/packages'); }
function refreshPackageItems(items) {
  return structuredClone(items || []).map(it => {
    const p = it.partId && get('parts', it.partId), l = it.labourId && get('labour', it.labourId);
    if (p) { it.rate = num(p.price); it.cost = num(p.cost); it.partNo = p.partNumber || ''; }
    if (l) it.rate = num(l.rate || S.settings.labourRate);
    return it;
  });
}
function edAddPackage() {
  pickFrom({
    title: 'Add service package', items: () => S.packages,
    filter: (p, q) => [p.name, p.description].join(' ').toLowerCase().includes(q),
    row: p => `<div class="row"><div class="grow"><b>${esc(p.name)}</b> <span class="small muted">${esc(p.description || '')}</span><div class="small faint">${esc((p.items || []).map(i => i.desc).join(', '))}</div></div><b>${money(calcDoc({ ...p, items: refreshPackageItems(p.items) }).subtotal)}</b></div>`,
    onPick: p => { for (const it of refreshPackageItems(p.items)) { if (it.type === 'labour') it.technicianId = ED.doc.technicianId || ''; ED.doc.items.push(it); } edChanged(); drawItems(); toast(`${p.name} added`, 'ok'); },
    addNew: { label: 'Create package', fn: () => newPackage() },
  });
}

/* =================== E-SIGNATURES =================== */
function signaturePad(title, onSave, defName = '') {
  const m = openModal({
    title, size: 'wide',
    body: `<p class="muted" style="margin-top:0">Ask the customer to sign in the box with a finger, stylus or mouse.</p>
      <canvas id="sigPad" width="820" height="240" style="width:100%;height:240px;border:2px dashed var(--line2);border-radius:10px;background:#fff;touch-action:none;cursor:crosshair"></canvas>
      <div class="grid g2 mt-s"><div class="field"><label>Name of person signing</label><input id="sigName" value="${esc(defName)}"></div></div>`,
    foot: `<button class="btn left" data-clear>Clear</button><button class="btn" data-close2>Cancel</button><button class="btn primary" data-ok>Save signature</button>`
  });
  const cv = m.el.querySelector('#sigPad'), ctx = cv.getContext('2d');
  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a';
  let drawing = false, dirty = false;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.onpointerdown = e => { drawing = true; dirty = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  cv.onpointermove = e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
  m.el.querySelector('[data-clear]').onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; };
  m.el.querySelector('[data-close2]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = () => {
    if (!dirty) return toast('Please sign first', 'err');
    onSave({ data: cv.toDataURL('image/png'), name: m.el.querySelector('#sigName').value.trim(), at: new Date().toISOString() });
    m.close();
  };
}
const SIG_SLOTS = { checkin: 'Work authorised (check-in)', collection: 'Vehicle collected (delivery)' };
function signaturesCardHTML(j) {
  const sg = j.signatures || {}, c = customerOf(j) || {};
  return `<div class="card mb"><div class="card-head"><h3>✍ Customer signatures</h3></div><div class="card-pad">
    ${Object.entries(SIG_SLOTS).map(([k, label]) => `<div class="mb"><div class="small strong muted">${label}</div>
      ${sg[k] ? `<img src="${sg[k].data}" style="width:100%;max-height:80px;object-fit:contain;border:1px solid var(--line);border-radius:6px;background:#fff">
        <div class="small muted">${esc(sg[k].name || '')} · ${new Date(sg[k].at).toLocaleString('en-GB')} <a onclick="clearSignature('${k}')">remove</a></div>`
      : `<button class="btn sm" onclick="signJob('${k}',${jsq(c.name || '')})">✍ Sign now</button>`}</div>`).join('')}</div></div>`;
}
function signJob(slot, name) {
  signaturePad(SIG_SLOTS[slot], async sig => {
    ED.doc.signatures = { ...(ED.doc.signatures || {}), [slot]: sig };
    if (slot === 'collection' && ED.doc.status === 'Ready') ED.doc.status = 'Delivered';
    await save('jobs', ED.doc); toast('Signature saved', 'ok'); render();
  }, name);
}
async function clearSignature(slot) {
  if (!(await confirmBox('Remove this signature?', 'Remove', true))) return;
  delete ED.doc.signatures[slot]; await save('jobs', ED.doc); render();
}

/* =================== AMOUNT IN WORDS =================== */
function numberWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const h = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 < 20 ? a[x % 100] : t[Math.floor(x % 100 / 10)] + (x % 10 ? '-' + a[x % 10] : ''));
  if (n === 0) return 'Zero';
  let out = '', i = 0; const units = ['', ' Thousand', ' Million', ' Billion'];
  while (n > 0) { const chunk = n % 1000; if (chunk) out = h(chunk) + units[i] + (out ? ' ' + out : ''); n = Math.floor(n / 1000); i++; }
  return out.trim();
}
function amountInWords(v) {
  const cur = S.settings.currency || 'AED';
  const names = { AED: ['UAE Dirhams', 'Fils'], SAR: ['Saudi Riyals', 'Halalas'], OMR: ['Omani Rials', 'Baisa'], QAR: ['Qatari Riyals', 'Dirhams'], KWD: ['Kuwaiti Dinars', 'Fils'], BHD: ['Bahraini Dinars', 'Fils'], USD: ['US Dollars', 'Cents'], INR: ['Rupees', 'Paise'] };
  const [major, minor] = names[cur] || [cur, 'cents'];
  const whole = Math.floor(r2(v)), cents = Math.round((r2(v) - whole) * 100);
  return `${major} ${numberWords(whole)}${cents ? ` and ${numberWords(cents)} ${minor}` : ''} Only`;
}
