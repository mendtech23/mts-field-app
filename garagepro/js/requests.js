/* GaragePro — online booking requests inbox + booking page settings */
'use strict';

const REQUESTS_SQL = `-- GaragePro online booking inbox (run once in Supabase → SQL Editor)
create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  garage     uuid not null,
  created_at timestamptz not null default now(),
  status     text not null default 'new',
  data       jsonb not null
);
alter table public.requests enable row level security;
drop policy if exists "public can send" on public.requests;
create policy "public can send" on public.requests for insert to anon, authenticated
  with check (status = 'new' and pg_column_size(data) < 600000);
drop policy if exists "garage reads" on public.requests;
create policy "garage reads" on public.requests for select to authenticated using (garage = auth.uid());
drop policy if exists "garage updates" on public.requests;
create policy "garage updates" on public.requests for update to authenticated using (garage = auth.uid());
drop policy if exists "garage deletes" on public.requests;
create policy "garage deletes" on public.requests for delete to authenticated using (garage = auth.uid());`;

/* ---------- alert sound ---------- */
function playAlert() {
  if (!S.settings.mob.alertSound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [880, 1175, 1568][i]; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
    });
  } catch (e) { }
}
function announceRequests(n) {
  if (!n) return;
  playAlert(); toast(`📥 ${n} new online request${n > 1 ? 's' : ''}`, 'ok'); renderNav();
  const [name] = currentRoute(); if (['requests', 'dispatch', 'dashboard'].includes(name || 'dashboard')) render();
}

/* ---------- receiving requests ---------- */
// Preview / same-browser: the booking page writes straight into the local database and pings us.
const reqChannel = 'BroadcastChannel' in window ? new BroadcastChannel('garagepro-requests') : null;
if (reqChannel) reqChannel.onmessage = async () => {
  const before = new Set(S.requests.map(r => r.id));
  S.requests = await DB.all('requests');
  announceRequests(S.requests.filter(r => !before.has(r.id)).length);
};
// Preview fallback (e.g. opened from a folder, where tabs can't message each other): check the local inbox every 10 s
if (IS_PREVIEW) setInterval(async () => {
  if (!DB.db) return;
  const all = await DB.all('requests'); const known = new Set(S.requests.map(r => r.id));
  const fresh = all.filter(r => !known.has(r.id));
  if (fresh.length) { S.requests.push(...fresh); announceRequests(fresh.length); }
}, 10000);
// Live: pull new rows from the Supabase inbox (called by cloud sync)
async function pullOnlineRequests() {
  if (!Sync.client || !Sync.user) return 0;
  const { data, error } = await Sync.client.from('requests').select('id,created_at,status,data').eq('status', 'new').order('created_at', { ascending: true }).limit(100);
  if (error) { if (!/relation .* does not exist|schema cache/i.test(error.message)) console.warn('requests', error.message); return 0; }
  let n = 0;
  for (const row of data || []) {
    if (get('requests', row.id)) continue;
    await save('requests', { ...(row.data || {}), id: row.id, status: 'New', receivedAt: row.created_at, remote: true });
    n++;
  }
  if (n) announceRequests(n);
  return n;
}
async function markRequestHandled(r) {
  if (!r.remote || !Sync.client || !Sync.user) return;
  try { await Sync.client.from('requests').update({ status: 'handled' }).eq('id', r.id); } catch (e) { }
}

/* ---------- inbox page ---------- */
PAGES.requests = () => {
  const f = getFilter('requests', 'f', 'New');
  const list = S.requests.filter(r => f === 'All' || (r.status || 'New') === f).sort((a, b) => (b.receivedAt || b.createdAt || '').localeCompare(a.receivedAt || a.createdAt || ''));
  view().innerHTML = pageHead('📥 Online requests', `From your booking page${bookingLink() ? ` — <a href="${esc(bookingLink())}" target="_blank" rel="noopener">${esc(bookingLink())}</a>` : ''}`,
    `<button class="btn" onclick="setFilter('settings','tab','mobile');go('#/settings')">Booking page & QR</button>`) +
    `<div class="filters"><div class="seg">${['New', 'Accepted', 'Declined', 'All'].map(k => `<button class="${f === k ? 'on' : ''}" onclick="setFilter('requests','f','${k}')">${k}${k === 'New' ? ` (${S.requests.filter(r => (r.status || 'New') === 'New').length})` : ''}</button>`).join('')}</div></div>
    ${list.length ? list.map(requestCard).join('') : `<div class="card card-pad"><div class="empty"><div class="big">📥</div>No ${f === 'All' ? '' : f.toLowerCase() + ' '}requests. Share your booking page link or QR code to receive bookings online.</div></div>`}`;
};
function requestCard(r) {
  const mobile = r.serviceType === 'mobile';
  const v = r.plate ? exactVehicle(r.plate) : null;
  const d = String(r.phone || '').replace(/\D/g, '');
  const c = d.length >= 7 && S.customers.find(x => String(x.phone || '').replace(/\D/g, '').endsWith(d.slice(-9)));
  const map = r.lat ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}` : r.mapLink || '';
  return `<div class="card mb"><div class="card-pad">
    <div class="row" style="justify-content:space-between"><div class="row">${mobile ? '<span class="pill orange">🚐 We come to you</span>' : '<span class="pill blue">🔧 Workshop visit</span>'} ${r.urgency === 'urgent' ? pill('Urgent') : ''} ${pill(r.status || 'New')}</div>
      <span class="small muted">received ${new Date(r.receivedAt || r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
    <div class="grid g2 mt-s"><dl class="kv"><dt>Customer</dt><dd><b>${esc(r.name || '')}</b> · <a href="tel:+${waNumber(r.phone)}">${esc(r.phone || '')}</a>${c ? ` <span class="pill green">existing: ${esc(c.name)}</span>` : ''}</dd>
      <dt>Car</dt><dd>${r.plate ? `<span class="plate">${esc(r.plate)}</span> ` : ''}${esc([r.make, r.model, r.year].filter(Boolean).join(' '))}${v ? ' <span class="pill green">on file</span>' : ''}</dd>
      <dt>Needs</dt><dd><b>${esc(r.service || '')}</b>${r.notes ? `<div class="small muted">${esc(r.notes)}</div>` : ''}</dd></dl>
      <dl class="kv"><dt>When</dt><dd>${r.urgency === 'urgent' ? '<b class="red">As soon as possible</b>' : esc(`${fmtDate(r.date)} · ${r.timeWindow || r.time || ''}`)}</dd>
      ${mobile ? `<dt>Location</dt><dd>${esc([r.address, r.area, r.emirate].filter(Boolean).join(', ') || '—')}${map ? ` · <a href="${esc(map)}" target="_blank" rel="noopener">📍 map</a>` : ''}</dd>` : ''}
      ${r.photo ? `<dt>Photo</dt><dd><img src="${r.photo}" class="thumb" style="width:120px;height:90px" onclick="viewReqPhoto('${r.id}')"></dd>` : ''}</dl></div>
    ${(r.status || 'New') === 'New' ? `<div class="row mt"><button class="btn primary" onclick="acceptRequest('${r.id}')">✔ Accept${mobile ? ' → mobile job' : ' → workshop booking'}</button>
      <button class="btn wa" onclick="window.open(waLink(${jsq(r.phone)}, ${jsq(`Hello ${r.name || ''}, thank you for your request to ${mobile ? S.settings.brandMobile : S.settings.garageName}. `)}),'_blank')">WhatsApp</button>
      <button class="btn danger" onclick="declineRequest('${r.id}')">Decline</button></div>`
      : r.jobId ? `<div class="mt-s"><a onclick="go('#/job/${r.jobId}')">Open job →</a></div>` : r.bookingId ? `<div class="mt-s"><a onclick="go('#/bookings')">View booking →</a></div>` : ''}
  </div></div>`;
}
function viewReqPhoto(id) { const r = get('requests', id); openModal({ title: 'Photo from customer', size: 'wide', body: `<img src="${r.photo}" style="width:100%;border-radius:8px">` }); }
async function acceptRequest(id) {
  const r = get('requests', id);
  if (r.serviceType === 'mobile') {
    const zone = (S.settings.mob.zones.find(z => r.zone && z.name === r.zone) || S.settings.mob.zones.find(z => z.emirate === r.emirate) || {}).name;
    return newMobileJob({ plate: r.plate, make: r.make, model: r.model, year: r.year, phone: r.phone, name: r.name, source: 'Online booking', zone, area: r.area, address: r.address,
      mapLink: r.lat ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}` : (r.mapLink || ''), problem: r.service, urgency: r.urgency === 'urgent' ? 'urgent' : 'scheduled',
      prefDate: r.date || today(), prefTime: r.time || (r.timeWindow || '').slice(0, 5), notes: r.notes, requestId: r.id, requestedAt: r.receivedAt || r.createdAt });
  }
  // workshop visit → booking
  const v = r.plate ? exactVehicle(r.plate) : null;
  const b = await save('bookings', { date: r.date || today(), time: r.time || (r.timeWindow || '09:00').slice(0, 5), plate: r.plate || '', vehicleId: v ? v.id : '', customerId: v ? v.customerId : '',
    name: r.name, phone: r.phone, service: r.service, duration: 1, status: 'Confirmed', notes: [r.make, r.model, r.year].filter(Boolean).join(' ') + (r.notes ? ' — ' + r.notes : '') + ' (online booking)' });
  r.status = 'Accepted'; r.bookingId = b.id; await save('requests', r); markRequestHandled(r);
  toast('Booking created', 'ok'); render();
  setTimeout(() => sendBookingMsg(b.id, 'booking'), 150);
}
async function declineRequest(id) {
  const r = get('requests', id);
  if (!(await confirmBox(`Decline the request from ${r.name || 'this customer'}?`, 'Decline', true))) return;
  r.status = 'Declined'; await save('requests', r); markRequestHandled(r); render();
  openMessageDialog({ customer: { name: r.name, phone: r.phone }, type: 'requestDeclined', text: fillTemplate(S.settings.templates.requestDeclined, { ...baseCtx(null, { name: r.name }), brand: r.serviceType === 'mobile' ? S.settings.brandMobile : S.settings.garageName }) });
}

/* ---------- Reports: MendTech Auto vs MendTech Mobile ---------- */
const VAN_COST_CATS = ['Fuel', 'Salik / tolls', 'Parking', 'Van maintenance'];
function lineReportHTML(y) {
  const m = v => money(v, false);
  const invs = S.invoices.filter(i => !i.void && (i.date || '').startsWith(y));
  const L = { auto: { net: 0, cost: 0, n: 0 }, mobile: { net: 0, cost: 0, n: 0 } };
  for (const i of invs) { const t = calcDoc(i), k = lineOf(i); L[k].net += t.net; L[k].cost += t.cost; L[k].n++; }
  const mjobs = S.jobs.filter(j => isMobile(j) && (j.date || '').startsWith(y) && j.status !== 'Cancelled');
  const resp = mjobs.map(responseMinutes).filter(x => x != null);
  const avg = resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null;
  const within60 = resp.length ? Math.round(resp.filter(x => x <= 60).length / resp.length * 100) : null;
  const byZone = {};
  for (const j of mjobs) { const z = ((j.mobile || {}).zone || 'Unknown').split('(')[0].trim(); byZone[z] = byZone[z] || { n: 0, v: 0 }; byZone[z].n++; byZone[z].v += jobTotals(j).net; }
  const reqs = S.requests.filter(r => (r.receivedAt || r.createdAt || '').startsWith(y));
  const vanCost = S.expenses.filter(e => (e.date || '').startsWith(y) && (e.vanId || VAN_COST_CATS.includes(e.category))).reduce((a, e) => a + num(e.amount) - num(e.vat), 0);
  const mgp = L.mobile.net - L.mobile.cost;
  const col = (k, label) => `<div class="kpi"><div class="lbl">${label}</div><div class="val">${m(L[k].net)}</div><div class="hint">GP ${m(L[k].net - L[k].cost)} · ${L[k].n} invoices · avg ${m(L[k].n ? L[k].net / L[k].n : 0)}</div></div>`;
  return `<div class="card mb"><div class="card-head"><h3>🔧 MendTech Auto vs 🚐 ${esc(S.settings.brandMobile || 'MendTech Mobile')} — ${y}</h3></div><div class="card-pad">
    <div class="grid g4">${col('auto', 'Workshop revenue')}${col('mobile', 'Mobile revenue')}
      <div class="kpi"><div class="lbl">Mobile response time</div><div class="val">${fmtMins(avg)}</div><div class="hint">${within60 != null ? within60 + '% within 1 hour' : 'no data yet'}</div></div>
      <div class="kpi"><div class="lbl">Van contribution</div><div class="val ${mgp - vanCost < 0 ? 'red' : 'green'}">${m(mgp - vanCost)}</div><div class="hint">mobile GP ${m(mgp)} − van costs ${m(vanCost)}</div></div></div>
    <div class="grid g2 mt">
      <div>${table([{ h: 'Zone', v: ([z]) => esc(z) }, { h: 'Jobs', cls: 'num', v: ([, x]) => x.n }, { h: 'Revenue', cls: 'num', v: ([, x]) => m(x.v) }], Object.entries(byZone).sort((a, b) => b[1].n - a[1].n), { empty: 'No mobile jobs yet' })}</div>
      <div><dl class="kv"><dt>Online requests</dt><dd>${reqs.length}</dd><dt>Accepted</dt><dd>${reqs.filter(r => r.status === 'Accepted').length}</dd><dt>Declined</dt><dd>${reqs.filter(r => r.status === 'Declined').length}</dd>
        <dt>Conversion</dt><dd>${reqs.length ? Math.round(reqs.filter(r => r.status === 'Accepted').length / reqs.length * 100) + '%' : '—'}</dd><dt>Mobile jobs</dt><dd>${mjobs.length} · urgent ${mjobs.filter(j => (j.mobile || {}).urgency === 'urgent').length} · after hours ${mjobs.filter(j => (j.mobile || {}).afterHours).length}</dd>
        <dt>Needs workshop</dt><dd>${mjobs.filter(j => (j.mobile || {}).status === 'Needs workshop').length} handed over</dd></dl></div></div></div></div>`;
}

/* ---------- Settings → Mobile & booking ---------- */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function mobileSettingsHTML() {
  const st = S.settings, m = st.mob, link = bookingLink();
  const live = !!(CFG.supabaseUrl && CFG.garageId);
  return `<div class="grid g2">
    <div class="card card-pad"><h3>🚐 MendTech Mobile</h3><div class="grid g2 mt-s">
      <div class="field spanall"><label>Mobile brand name (on mobile documents & messages)</label><input id="mb_brand" value="${esc(st.brandMobile || '')}"></div>
      <div class="field"><label>Working hours from</label><input id="mb_hs" type="time" value="${esc(m.hoursStart)}"></div>
      <div class="field"><label>to</label><input id="mb_he" type="time" value="${esc(m.hoursEnd)}"></div>
      <div class="field spanall"><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="mb_24" ${m.allDay ? 'checked' : ''}> Open 24/7 (no after-hours flag or surcharge)</label></div>
      <div class="field spanall"><label>Weekend surcharge days</label><div class="row">${DAY_NAMES.map((d, i) => `<label class="small row" style="gap:4px"><input type="checkbox" class="mb_wd" value="${i}" ${(m.weekendDays || []).includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></div>
      <div class="fieldset-title">Surcharges (${esc(st.currency)}) — leave blank if not charged</div>
      <div class="field"><label>Urgent / ASAP</label><input id="mb_uf" type="number" value="${esc(m.urgentFee)}"></div>
      <div class="field"><label>After hours</label><input id="mb_af" type="number" value="${esc(m.afterHoursFee)}"></div>
      <div class="field"><label>Weekend</label><input id="mb_wf" type="number" value="${esc(m.weekendFee)}"></div>
      <div class="field"><label>Free call-out when job is over</label><input id="mb_free" type="number" value="${esc(m.freeCalloutAbove)}"></div>
      <div class="field spanall"><label>Zones & call-out fees — one per line: <code>Zone name | Emirate | Fee</code></label><textarea id="mb_zones" class="mono" style="min-height:150px">${esc(m.zones.map(z => `${z.name} | ${z.emirate} | ${z.fee}`).join('\n'))}</textarea></div>
      <div class="field spanall"><label>Vans — one per line: <code>Name | Plate</code></label><textarea id="mb_vans" class="mono" style="min-height:60px">${esc(m.vans.map(v => `${v.name} | ${v.plate || ''}`).join('\n'))}</textarea></div>
      <div class="field"><label>Mobile services (booking page)</label><textarea id="mb_svc" style="min-height:170px">${esc(m.services.join('\n'))}</textarea></div>
      <div class="field"><label>Workshop services (booking page)</label><textarea id="mb_wsvc" style="min-height:170px">${esc(m.workshopServices.join('\n'))}</textarea></div>
      <div class="field spanall"><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="mb_snd" ${m.alertSound ? 'checked' : ''}> Play a sound when an online request arrives</label></div>
    </div><div class="row end mt"><button class="btn primary" onclick="saveMobileSettings()">Save</button></div></div>
    <div>
      <div class="card card-pad mb"><h3>🌐 Customer booking page</h3>
        ${link ? `<div class="row mt-s"><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid var(--line)">${qrSVG(link, 120)}</div><div class="grow small"><a href="${esc(link)}" target="_blank" rel="noopener" style="word-break:break-all">${esc(link)}</a><div class="muted mt-s">Share on WhatsApp Business, Instagram, Google Maps and your van.</div></div></div>`
      : `<p class="muted">The booking page is <b>book.html</b> in the app folder. After publishing it is at <b>your-site.netlify.app/book.html</b>.</p>`}
        <div class="row mt"><button class="btn" onclick="printBookingPoster()">🖨 Print QR poster</button>${link ? `<button class="btn" onclick="navigator.clipboard.writeText(bookingLink()).then(()=>toast('Link copied'))">📋 Copy link</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Open booking page</a>` : ''}</div>
        <hr class="sep"><div class="small"><b>Status:</b> ${IS_PREVIEW ? '🧪 Preview — requests from the booking page on this computer arrive here instantly.' : live ? '✅ Connected — requests arrive through your cloud inbox.' : '⚠ Not connected yet — follow the 3 steps below.'}</div></div>
      <div class="card card-pad"><h3>🔗 Connect the booking page (once, when going live)</h3>
        <ol style="line-height:1.8;padding-left:18px;margin:6px 0">
          <li>Supabase → <b>SQL Editor</b> → paste this script → <b>Run</b>. <button class="btn sm" onclick="navigator.clipboard.writeText(REQUESTS_SQL).then(()=>toast('SQL copied'))">📋 Copy SQL</button></li>
          <li>With cloud sync signed in, click <button class="btn sm" onclick="downloadBookingConfig()">⬇ Download config.js</button> and put the file into the app's <b>js</b> folder (replace the old one).</li>
          <li>Drag the app folder onto Netlify again. Done — requests appear here with a sound.</li></ol>
        <pre class="mono small" data-noicon style="background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;max-height:160px;overflow:auto;white-space:pre-wrap">${esc(REQUESTS_SQL)}</pre></div>
    </div></div>`;
}
async function saveMobileSettings() {
  const st = S.settings, m = st.mob, v = id => $(id).value.trim();
  st.brandMobile = v('#mb_brand') || 'MendTech Mobile';
  m.hoursStart = v('#mb_hs') || '08:00'; m.hoursEnd = v('#mb_he') || '20:00'; m.allDay = $('#mb_24').checked; m.alertSound = $('#mb_snd').checked;
  m.weekendDays = [...document.querySelectorAll('.mb_wd:checked')].map(x => +x.value);
  m.urgentFee = v('#mb_uf'); m.afterHoursFee = v('#mb_af'); m.weekendFee = v('#mb_wf'); m.freeCalloutAbove = v('#mb_free');
  m.zones = v('#mb_zones').split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0]).map(([name, emirate, fee]) => ({ name, emirate: emirate || 'Dubai', fee: fee || '' }));
  const old = m.vans;
  m.vans = v('#mb_vans').split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0]).map(([name, plate], i) => ({ id: (old.find(o => o.name === name) || old[i] || {}).id || 'van' + (i + 1) + Date.now().toString(36).slice(-3), name, plate: plate || '' }));
  if (!m.vans.length) m.vans = old;
  m.services = v('#mb_svc').split('\n').map(s => s.trim()).filter(Boolean);
  m.workshopServices = v('#mb_wsvc').split('\n').map(s => s.trim()).filter(Boolean);
  await saveSettings(); toast('Mobile settings saved', 'ok'); render();
}

/* ---------- booking page link, QR poster, config download ---------- */
function bookingLink() { return location.protocol.startsWith('http') ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'book.html' : ''; }
function printBookingPoster() {
  const link = bookingLink() || 'https://mendtechauto.netlify.app/book.html';
  const st = S.settings;
  printHTML(`<div class="docv" style="text-align:center;padding:60px 40px">
    ${st.logo ? `<img src="${st.logo}" style="max-height:110px;max-width:260px">` : ''}
    <div style="font-size:34px;font-weight:800;margin-top:14px">${esc(st.brandMobile || 'MendTech Mobile')}</div>
    <div style="font-size:18px;color:#555;margin-top:4px">Car trouble? We come to you — Dubai & Sharjah</div>
    <div style="display:inline-block;margin:34px auto 20px;padding:16px;border:3px solid #f97316;border-radius:18px">${qrSVG(link, 300)}</div>
    <div style="font-size:24px;font-weight:700">Scan to book a service</div>
    <div style="font-size:15px;color:#444;margin-top:8px">Battery · Tyres · Jump start · Minor service at your location · AC · Diagnostics</div>
    <div style="font-size:15px;color:#444;margin-top:20px">${esc(st.garageName)} · ${esc(contactLine())}</div>
    <div style="font-size:12px;color:#888;margin-top:6px;word-break:break-all">${esc(link)}</div></div>`);
}
function downloadBookingConfig() {
  if (!Sync.cfg.url || !Sync.cfg.key || !Sync.user) return toast('Connect cloud sync first (Settings → Cloud & devices), then try again', 'err');
  const st = S.settings, m = st.mob;
  const cfg = { mode: 'live', dbName: 'garagepro', supabaseUrl: Sync.cfg.url, supabaseKey: Sync.cfg.key, garageId: Sync.user.id,
    brand: { name: st.garageName, mobile: st.brandMobile, phone: contactLine(), logo: st.logo, whatsapp: waGarage(), address: st.address,
      services: m.services, workshopServices: m.workshopServices, zones: m.zones.map(z => ({ name: z.name, emirate: z.emirate })), hoursStart: m.hoursStart, hoursEnd: m.hoursEnd, allDay: m.allDay } };
  const txt = `/* GaragePro build settings — generated ${new Date().toLocaleString('en-GB')}. Put this file in the js folder, replacing the old one. */\nwindow.GP_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
  downloadBlob(new Blob([txt], { type: 'text/javascript' }), 'config.js');
  toast('config.js downloaded — see the steps below', 'ok');
}
