/* mendtech. — follow-ups, review requests and campaigns (v3.3)
   Messages are prepared by the app and sent by staff with one tap on WhatsApp (free). */
'use strict';

/* ---------- extra reminder categories (added to the Reminders page) ---------- */
function followUpReminders(add) {
  const off = S.settings.offers, stages = [...(off.followUpDays || [7, 30, 90])].map(num).filter(Boolean).sort((a, b) => a - b);
  for (const v of S.vehicles) {
    if (v.status && v.status !== 'Active') continue;
    const c = customerOf(v); if (!c || c.noMarketing) continue;
    const pw = pendingWork(v);
    const found = [...pw.advisories.map(a => ({ date: a.j.date, text: `${a.p.point}${a.p.note ? ' (' + a.p.note + ')' : ''}` })),
      ...pw.quotes.filter(q => ['Declined', 'Expired'].includes(quoteState(q))).map(q => ({ date: q.date, text: q.description || (q.items || []).map(i => i.desc).join(', ') }))];
    if (!found.length) continue;
    const first = found.map(f => f.date).sort()[0], d = daysBetween(first, today());
    const stage = stages.filter(s => d >= s).pop(); if (!stage || d > stages[stages.length - 1] + 30) continue;
    const lm = lastMessage(v.id, 'followUp');
    if (lm && lm.date.slice(0, 10) >= addDays(first, stage)) continue;   // this stage already sent
    add({ cat: 'Recommended work', ico: '🔁', bg: 'var(--amberSoft)', sort: 15, vehicle: v, customer: c, tpl: 'followUp', date: first,
      item: found.slice(0, 6).map(f => '• ' + f.text).join('\n'), title: `${v.plate}: ${found.length} recommended item${found.length > 1 ? 's' : ''} not done yet`,
      sub: `${c.name} · found ${fmtDate(first)} · ${stage}-day follow-up` });
  }
  const months = num(off.reviewEveryMonths) || 6, after = num(off.reviewAfterDays) || 1;
  for (const j of S.jobs) {
    if (j.status !== 'Delivered' && (j.mobile || {}).status !== 'Completed') continue;
    const done = (j.completed || j.date || '').slice(0, 10), d = daysBetween(done, today());
    if (d < after || d > 14) continue;
    const c = customerOf(j), v = vehicleOf(j); if (!c) continue;
    const asked = S.messages.filter(m => m.customerId === c.id && m.type === 'review').map(m => m.date).sort().pop();
    if (asked && daysBetween(asked.slice(0, 10), today()) < months * 30) continue;
    add({ cat: 'Review request', ico: '⭐', bg: 'var(--greenSoft)', sort: 18, vehicle: v, customer: c, tpl: 'review', title: `Ask ${c.name} for a Google review`,
      sub: `${j.number} · ${v ? v.plate : ''} · completed ${fmtDate(done)}${off.googleReviewLink ? '' : ' · ⚠ add your Google review link in Settings'}` });
  }
}

/* ---------- campaigns ---------- */
const CAMPAIGN_PRESETS = [
  { k: 'ac', name: 'AC check before summer', aud: 'ac', text: 'Dear {customer},\n\nSummer is coming. Is your {vehicle} ({plate}) AC cooling properly? Book an AC check with {brand} — we test the cooling, gas pressure and cabin filter.\n\nReply YES and we will book you in, or we can come to you.\n{garagePhone}' },
  { k: 'battery', name: 'Summer battery check', aud: 'all', text: 'Dear {customer},\n\nUAE heat is hard on car batteries. Get a free battery test for your {vehicle} ({plate}) with any service at {brand}, or call us if it struggles to start — we come to you.\n\n{garagePhone}' },
  { k: 'health', name: 'Free 20-point health check', aud: 'lapsed', text: 'Dear {customer},\n\nIt has been a while since we saw your {vehicle} ({plate}). Book any service and get a FREE 20-point health check — brakes, tyres, fluids, battery, AC and more.\n\nReply to book.\n{garagePhone}' },
  { k: 'ev', name: 'EV / hybrid check', aud: 'ev', text: 'Dear {customer},\n\nWe now offer a 20-point EV / hybrid check for your {vehicle} ({plate}): battery health, charging, cooling and brakes.\n\nReply to book.\n{garagePhone}' },
  { k: 'custom', name: 'Custom message', aud: 'all', text: 'Dear {customer},\n\n\n\n{garagePhone}' },
];
const AUDIENCES = {
  all: ['All customers', () => true],
  lapsed: ['Not seen in 6+ months', v => { const s = vehicleStats(v); return !s.last || daysBetween(s.last, today()) >= 180; }],
  ac: ['AC not serviced in 12 months', v => { const x = serviceSchedule(v).find(i => /AC/i.test(i.name)); return !x || x.status !== 'OK'; }],
  ev: ['Electric & hybrid cars', v => isEV(v)],
  make: ['Car make…', (v, arg) => (v.make || '').toLowerCase().includes(String(arg || '').toLowerCase())],
};
function campaignTargets(aud, arg) {
  const [, fn] = AUDIENCES[aud] || AUDIENCES.all, seen = new Set(), out = [];
  for (const v of S.vehicles) {
    if (v.status && v.status !== 'Active') continue;
    const c = customerOf(v); if (!c || c.noMarketing || !(c.whatsapp || c.phone) || seen.has(c.id)) continue;
    if (!fn(v, arg)) continue;
    seen.add(c.id); out.push({ customerId: c.id, vehicleId: v.id });
  }
  return out;
}
PAGES.followups = id => id ? campaignPage(id) : campaignsList();
function campaignsList() {
  const list = [...S.campaigns].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  view().innerHTML = pageHead('Campaigns', 'Send an offer to a group of customers — one tap per customer on WhatsApp. Customers marked "no marketing messages" are always left out.', `<button class="btn primary" onclick="newCampaign()">＋ New campaign</button>`) +
    `<div class="card">${table([{ h: 'Campaign', v: c => `<b>${esc(c.name)}</b><div class="small muted">${esc(c.audienceLabel || '')}</div>` }, { h: 'Created', v: c => fmtDate((c.createdAt || '').slice(0, 10)) },
      { h: 'Customers', cls: 'num', v: c => c.targets.length }, { h: 'Sent', cls: 'num', v: c => Object.keys(c.sent || {}).length }, { h: 'Booked after', cls: 'num', v: c => campaignConversions(c) }],
      list, { click: c => `go('#/followups/${c.id}')`, empty: 'No campaigns yet — try "AC check before summer".', emptyIcon: '📣' })}</div>`;
}
function campaignConversions(c) {
  return Object.entries(c.sent || {}).filter(([cid, at]) => S.jobs.some(j => j.customerId === cid && (j.createdAt || j.date) >= at)).length;
}
function newCampaign() {
  const m = openModal({
    title: 'New campaign', size: 'wide',
    body: `<div class="grid g2"><div class="field"><label>Offer</label><select id="cp_p">${CAMPAIGN_PRESETS.map(p => `<option value="${p.k}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Who</label><select id="cp_a">${Object.entries(AUDIENCES).map(([k, [l]]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field" id="cp_mk" hidden><label>Make contains</label><input id="cp_arg" placeholder="e.g. Toyota"></div>
      <div class="field spanall"><label>Campaign name</label><input id="cp_n"></div>
      <div class="field spanall"><label>Message — {customer} {vehicle} {plate} are filled in for each person</label><textarea id="cp_t" style="min-height:170px"></textarea></div>
      <div class="spanall small muted" id="cp_count"></div></div>`,
    foot: `<button class="btn" data-close2>Cancel</button><button class="btn primary" data-ok>Create</button>`,
  });
  const $m = s => m.el.querySelector(s);
  const count = () => { $m('#cp_mk').hidden = $m('#cp_a').value !== 'make'; $m('#cp_count').textContent = `${campaignTargets($m('#cp_a').value, $m('#cp_arg').value).length} customers match (one message per customer).`; };
  const preset = () => { const p = CAMPAIGN_PRESETS.find(x => x.k === $m('#cp_p').value); $m('#cp_n').value = p.name; $m('#cp_t').value = p.text; $m('#cp_a').value = p.aud; count(); };
  $m('#cp_p').onchange = preset; $m('#cp_a').onchange = count; $m('#cp_arg').oninput = count; preset();
  $m('[data-close2]').onclick = m.close;
  $m('[data-ok]').onclick = async () => {
    const aud = $m('#cp_a').value, arg = $m('#cp_arg').value.trim(), targets = campaignTargets(aud, arg);
    if (!targets.length) return toast('No customers match', 'err');
    const c = await save('campaigns', { name: $m('#cp_n').value.trim() || 'Campaign', text: $m('#cp_t').value, audience: aud, audienceArg: arg,
      audienceLabel: AUDIENCES[aud][0] + (aud === 'make' ? ' ' + arg : ''), targets, sent: {} });
    m.close(); go('#/followups/' + c.id);
  };
}
function campaignText(cp, t) { const v = get('vehicles', t.vehicleId), c = get('customers', t.customerId); return fillTemplate(cp.text, { ...baseCtx(v, c), brand: S.settings.garageName }); }
function campaignPage(id) {
  const cp = get('campaigns', id); if (!cp) return go('#/followups');
  const sent = cp.sent || {}, n = Object.keys(sent).length;
  view().innerHTML = pageHead(`📣 ${esc(cp.name)}`, `${esc(cp.audienceLabel || '')} · ${cp.targets.length} customers · ${n} sent · ${campaignConversions(cp)} booked after`,
    `<button class="btn" onclick="go('#/followups')">All campaigns</button><button class="btn danger" onclick="deleteCampaign('${cp.id}')">Delete</button>`) +
    `<div class="card mb"><div class="card-pad"><div class="small muted mb">Message</div><pre class="mono" style="white-space:pre-wrap;margin:0" data-noicon>${esc(cp.text)}</pre></div></div>
    <div class="card">${cp.targets.map((t, i) => { const c = get('customers', t.customerId) || {}, v = get('vehicles', t.vehicleId) || {}; return `<div class="alert-row">
      <div class="grow"><b>${esc(c.name || '')}</b> <span class="small muted">${esc(c.whatsapp || c.phone || '')}</span><div class="small">${plateTag(v)} ${esc(vehicleLabel(v))}</div></div>
      ${sent[t.customerId] ? `<span class="small green">✓ sent ${fmtDate(sent[t.customerId].slice(0, 10))}</span>` : ''}
      <button class="btn sm ${sent[t.customerId] ? '' : 'wa'}" onclick="sendCampaign('${cp.id}', ${i})">${sent[t.customerId] ? 'Send again' : 'WhatsApp'}</button></div>`; }).join('')}</div>`;
}
async function sendCampaign(id, i) {
  const cp = get('campaigns', id), t = cp.targets[i], c = get('customers', t.customerId) || {};
  const text = campaignText(cp, t);
  window.open(waLink(c.whatsapp || c.phone, text), '_blank');
  cp.sent = { ...(cp.sent || {}), [t.customerId]: new Date().toISOString() };
  await save('campaigns', cp);
  await logMessage({ vehicleId: t.vehicleId, customerId: t.customerId, channel: 'WhatsApp', type: 'campaign', text });
  render();
}
async function deleteCampaign(id) { if (!(await confirmBox('Delete this campaign? Messages already sent are not affected.', 'Delete', true))) return; await remove('campaigns', id); go('#/followups'); }
