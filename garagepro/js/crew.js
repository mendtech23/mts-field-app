/* mendtech. — restricted screens for Technicians and Drivers (v3.3)
   Technician: own jobs only, customer NAME only, findings / check-in / inspection / photos — no parts, labour or prices.
   Driver: own mobile jobs only, customer name + phone + location, status steps — no prices.
   Level 2 enforces the same rules in the cloud: these devices only ever receive their own jobs. */
'use strict';

const isRestricted = () => !!(Auth.active && Auth.user && Auth.role().restricted);
function isMyJob(j) {
  const me = myTechId();
  return !!(me && j && (j.technicianId === me || (j.mobile || {}).driverId === me));
}
/* what a restricted role may see of the customer */
function crewCustomer(j) {
  const c = customerOf(j) || {}, r = Auth.role();
  return r.customerDetail === 'contact' ? { name: c.name || '', phone: c.phone || '' } : { name: c.name || '', phone: '' };
}
const WORKSHOP_CREW_STEPS = ['Booked', 'In Progress', 'Awaiting Parts', 'Ready'];

function crewJobPage(j) {
  if (!isMyJob(j)) { view().innerHTML = `<div class="card card-pad"><div class="empty"><div class="big">🔒</div>This job is not assigned to you.</div></div>`; return; }
  ED.kind = 'job'; ED.doc = j;
  const v = vehicleOf(j) || {}, cc = crewCustomer(j), mob = isMobile(j), m = j.mobile || {};
  const map = mob ? mapsLink(m) : '';
  const status = mob
    ? `<div class="stepper mb">${MOBILE_STATUSES.slice(0, 6).map((s, i) => { const idx = MOBILE_STATUSES.indexOf(m.status || 'New'); return `<div class="st ${s === (m.status || 'New') ? 'on' : i < idx && idx < 6 ? 'done' : ''}" onclick="setMobileStatus('${j.id}',${jsq(s)})">${esc(s)}</div>`; }).join('')}</div>
       <div class="crew-btns">${MOB_NEXT[m.status || 'New'] ? `<button class="btn primary lg" onclick="setMobileStatus('${j.id}',${jsq(MOB_NEXT[m.status || 'New'])})">${MOB_NEXT_LABEL[m.status || 'New']}</button>` : ''}
         ${map ? `<a class="btn lg" href="${esc(map)}" target="_blank" rel="noopener">🧭 Navigate</a>` : ''}${cc.phone ? `<a class="btn lg" href="tel:+${waNumber(cc.phone)}">📞 Call</a>` : ''}</div>`
    : `<div class="stepper mb">${WORKSHOP_CREW_STEPS.map(s => `<div class="st ${s === j.status ? 'on' : ''}" onclick="crewStatus(${jsq(s)})">${esc(s)}</div>`).join('')}</div>`;
  view().innerHTML = `<div class="page-head"><div><div class="crumb"><a onclick="go('#/myjobs')">My jobs</a></div><h1>${esc(j.number)} ${mob ? '🚐' : '🔧'}</h1>
      <div class="sub">${plateTag(v)} ${esc(vehicleLabel(v))}${v.color ? ' · ' + esc(v.color) : ''}</div></div></div>
    <div class="card mb"><div class="card-pad">${status}</div></div>
    <div class="grid g2 mb">
      <div class="card"><div class="card-head"><h3>Customer &amp; car</h3></div><div class="card-pad"><dl class="kv" style="grid-template-columns:110px 1fr">
        <dt>Customer</dt><dd><b>${esc(cc.name || '—')}</b></dd>${cc.phone ? `<dt>Phone</dt><dd><a href="tel:+${waNumber(cc.phone)}">${esc(cc.phone)}</a></dd>` : ''}
        ${mob ? `<dt>Location</dt><dd>${esc(locationText(m) || m.zone || '—')}</dd>` : ''}
        <dt>Plate</dt><dd>${esc(v.plate || '')} ${esc(v.emirate || '')}</dd><dt>VIN</dt><dd class="mono">${esc(v.vin || '—')}</dd>
        <dt>Odometer in</dt><dd><input class="inp sm" type="number" value="${esc(j.odometer || '')}" onchange="edSet('odometer', this.value)" style="width:130px"> km</dd>
        <dt>Fuel in</dt><dd>${selectHTML('fuelIn', ['', 'E', '¼', '½', '¾', 'F'], j.fuelIn)}</dd></dl></div></div>
      <div class="card"><div class="card-head"><h3>Work requested</h3></div><div class="card-pad" style="white-space:pre-wrap">${esc(j.complaint || m.problem || '—')}</div></div></div>
    <div class="card mb"><div class="card-head"><h3>🛠 Findings &amp; notes</h3><span class="small muted">the advisor turns these into parts, labour and a quote</span></div>
      <div class="card-pad"><textarea class="inp" style="min-height:110px" placeholder="What you found, what needs doing, parts needed…" oninput="edSet('diagnosis', this.value)">${esc(j.diagnosis || '')}</textarea></div></div>
    <div id="ckBox">${checkinCardHTML(j)}</div>
    ${ppiCardHTML(j)}${jobPhotosCardHTML(j)}
    <div class="card mb"><div class="card-head"><h3>🔍 Inspection</h3><div class="actions" id="inspActions">${inspActionsHTML(j)}</div></div><div class="card-pad" id="inspBox">${inspectionHTML(j)}</div></div>
    ${signaturesCardHTML(j)}`;
  drawJobPhotos(j.id);
}
async function crewStatus(s) {
  const j = ED.doc; if (!j || j.status === s) return;
  j.status = s; if (s === 'Ready' && !j.completed) j.completed = today();
  await save('jobs', j); toast(`${j.number}: ${s}`, 'ok'); render();
}
