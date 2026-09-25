/* mendtech. — KPI dashboard (v3.3): revenue per technician, average job value, repeat-customer rate,
   quote conversion, comebacks, mobile response time, follow-up results, 12-month trend. Owner & Manager only. */
'use strict';

const KPI_PERIODS = [['m0', 'This month'], ['m1', 'Last month'], ['q', 'Last 3 months'], ['y', 'Last 12 months']];
function kpiRange(p) {
  const t = today(), mk = t.slice(0, 7) + '-01';
  if (p === 'm1') { const s = addMonths(mk, -1); return [s, addDays(mk, -1)]; }
  if (p === 'q') return [addMonths(mk, -2), t];
  if (p === 'y') return [addMonths(mk, -11), t];
  return [mk, t];
}
function kpiData(from, to) {
  const inR = d => d && d >= from && d <= to;
  const invs = S.invoices.filter(i => !i.void && inR(i.date));
  const net = r2(invs.reduce((a, i) => a + calcDoc(i).net, 0)), cost = r2(invs.reduce((a, i) => a + calcDoc(i).cost, 0));
  // revenue per technician: labour lines by the line's technician (or the job's)
  const tech = {};
  for (const i of invs) {
    const j = i.jobId && get('jobs', i.jobId);
    const share = calcDoc(i).subtotal ? calcDoc(i).net / calcDoc(i).subtotal : 1;   // spread invoice discount
    for (const it of i.items || []) {
      if (it.type !== 'labour') continue;
      const id = it.technicianId || (j && j.technicianId) || '';
      const t = tech[id] = tech[id] || { hours: 0, labour: 0, jobs: new Set() };
      t.hours += num(it.qty); t.labour += lineTotal(it) * share; if (j) t.jobs.add(j.id);
    }
  }
  const techRows = Object.entries(tech).map(([id, t]) => ({ name: techName(id) || 'Not assigned', hours: r2(t.hours), labour: r2(t.labour), jobs: t.jobs.size, perHour: t.hours ? r2(t.labour / t.hours) : 0 }))
    .sort((a, b) => b.labour - a.labour);
  // customers: repeat = invoiced in the period AND had an invoice before it
  const custIds = [...new Set(invs.map(i => i.customerId))];
  const repeat = custIds.filter(cid => S.invoices.some(i => !i.void && i.customerId === cid && i.date < from)).length;
  // quotes → jobs
  const qs = S.quotes.filter(q => inR(q.date)), won = qs.filter(q => ['Approved', 'Converted'].includes(q.status)).length;
  // comebacks: a job on the same car within 30 days of a delivered job, or typed Warranty / Comeback
  const jobs = S.jobs.filter(j => j.status !== 'Cancelled' && inR(j.date));
  const comeback = jobs.filter(j => /comeback|warranty/i.test(j.type || '') || S.jobs.some(p => p.id !== j.id && p.vehicleId === j.vehicleId && p.status === 'Delivered' && p.date < j.date && daysBetween(p.completed || p.date, j.date) <= 30 && !isMobile(p))).length;
  // mobile response time
  const resp = S.jobs.filter(j => isMobile(j) && inR(j.date)).map(responseMinutes).filter(x => x != null);
  // follow-ups & campaigns: messages sent in the period that led to a job within 30 days
  const fmsgs = S.messages.filter(m => ['followUp', 'campaign', 'review'].includes(m.type) && inR((m.date || '').slice(0, 10)));
  const fwon = fmsgs.filter(m => m.type !== 'review' && S.jobs.some(j => j.customerId === m.customerId && (j.createdAt || j.date) > m.date && daysBetween(m.date.slice(0, 10), (j.createdAt || j.date).slice(0, 10)) <= 30)).length;
  const byType = {};
  for (const j of jobs) { const k = isMobile(j) ? 'Mobile service' : j.type || 'Other'; const t = jobTotals(j); byType[k] = byType[k] || { n: 0, v: 0 }; byType[k].n++; byType[k].v += t.net || 0; }
  return {
    net, gp: r2(net - cost), gpPct: net ? Math.round((net - cost) / net * 100) : 0, invoices: invs.length, avg: invs.length ? r2(net / invs.length) : 0,
    techRows, customers: custIds.length, repeat, repeatPct: custIds.length ? Math.round(repeat / custIds.length * 100) : 0,
    quotes: qs.length, won, convPct: qs.length ? Math.round(won / qs.length * 100) : 0, jobs: jobs.length, comeback, comebackPct: jobs.length ? Math.round(comeback / jobs.length * 100) : 0,
    respAvg: resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null, resp60: resp.length ? Math.round(resp.filter(x => x <= 60).length / resp.length * 100) : null,
    fsent: fmsgs.filter(m => m.type !== 'review').length, fwon, reviews: fmsgs.filter(m => m.type === 'review').length,
    byType: Object.entries(byType).sort((a, b) => b[1].v - a[1].v),
  };
}
PAGES.kpi = () => {
  if (!Auth.can('finance')) return go('#/dashboard');
  const p = getFilter('kpi', 'p', 'm0'), [from, to] = kpiRange(p), k = kpiData(from, to), m = x => money(x, false);
  const tile = (lbl, val, hint, cls = '') => `<div class="kpi"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  view().innerHTML = pageHead('📈 KPI dashboard', `${fmtDate(from)} – ${fmtDate(to)} · amounts ex VAT`) +
    `<div class="filters"><div class="seg">${KPI_PERIODS.map(([key, l]) => `<button class="${p === key ? 'on' : ''}" onclick="setFilter('kpi','p','${key}')">${l}</button>`).join('')}</div></div>
    <div class="grid g4 mb">${tile('Revenue', m(k.net), `${k.invoices} invoices · gross profit ${m(k.gp)} (${k.gpPct}%)`)}${tile('Average job value', m(k.avg), 'net per invoice')}
      ${tile('Repeat customers', k.repeatPct + '%', `${k.repeat} of ${k.customers} customers had been before`)}${tile('Quote conversion', k.convPct + '%', `${k.won} of ${k.quotes} quotations approved`)}</div>
    <div class="grid g4 mb">${tile('Comebacks', k.comebackPct + '%', `${k.comeback} of ${k.jobs} jobs — lower is better`, k.comebackPct > 5 ? 'red' : '')}
      ${tile('Mobile response', k.respAvg == null ? '—' : fmtMins(k.respAvg), k.resp60 == null ? 'no mobile jobs' : `${k.resp60}% reached within 1 hour`)}
      ${tile('Follow-ups &amp; campaigns', k.fsent ? Math.round(k.fwon / k.fsent * 100) + '%' : '—', `${k.fwon} of ${k.fsent} messages led to a booking`)}${tile('Review requests sent', k.reviews, 'Google reviews asked for')}</div>
    <div class="card mb"><div class="card-head"><h3>Revenue per technician</h3></div>${table([{ h: 'Technician', v: r => `<b>${esc(r.name)}</b>` }, { h: 'Jobs', cls: 'num', v: r => r.jobs },
      { h: 'Hours sold', cls: 'num', v: r => fmtNum(r.hours) }, { h: 'Labour revenue', cls: 'num', v: r => m(r.labour) }, { h: 'Per hour', cls: 'num', v: r => m(r.perHour) }], k.techRows, { empty: 'No labour sold in this period.' })}</div>
    <div class="grid g2">${kpiTrendHTML()}
      <div class="card"><div class="card-head"><h3>Jobs by type</h3></div>${table([{ h: 'Type', v: ([t]) => esc(t) }, { h: 'Jobs', cls: 'num', v: ([, x]) => x.n }, { h: 'Revenue', cls: 'num', v: ([, x]) => m(x.v) }], k.byType, { empty: 'No jobs in this period.' })}</div></div>`;
  kpiTrendHover();
};
/* 12-month revenue + average job value: one series, bars, hover tooltip, table view underneath */
function kpiTrendHTML() {
  const mk = today().slice(0, 7) + '-01', rows = [];
  for (let i = 11; i >= 0; i--) { const s = addMonths(mk, -i), e = addDays(addMonths(s, 1), -1); const invs = S.invoices.filter(x => !x.void && x.date >= s && x.date <= e); const net = r2(invs.reduce((a, x) => a + calcDoc(x).net, 0)); rows.push({ s, net, avg: invs.length ? r2(net / invs.length) : 0, n: invs.length }); }
  const max = Math.max(1, ...rows.map(r => r.net)), W = 560, H = 200, pad = 26, bw = (W - 8) / 12;
  const bars = rows.map((r, i) => { const h = r.net / max * (H - pad - 10), x = 4 + i * bw + 3, y = H - pad - h;
    return `<g class="kb" data-i="${i}"><rect x="${x - 3}" y="0" width="${bw}" height="${H - pad}" fill="transparent"/>${r.net ? `<path d="M${x} ${H - pad}V${y + 4}q0-4 4-4h${bw - 14}q4 0 4 4V${H - pad}Z" fill="var(--kpiBar)"/>` : ''}
      <text x="${x + (bw - 6) / 2}" y="${H - 8}" text-anchor="middle" fill="var(--ink3)" font-size="10">${new Date(r.s + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}</text></g>`; }).join('');
  KPI_TREND = rows;
  return `<div class="card"><div class="card-head"><h3>Revenue — last 12 months</h3><span class="small muted">peak ${money(max, false)}</span></div><div class="card-pad" style="position:relative">
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly revenue, last 12 months"><line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" stroke="var(--line)"/>${bars}</svg>
    <div id="kpiTip" class="kpi-tip" hidden></div>
    <details class="mt-s"><summary class="small muted">Show as table</summary>${table([{ h: 'Month', v: r => new Date(r.s + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }, { h: 'Invoices', cls: 'num', v: r => r.n }, { h: 'Revenue', cls: 'num', v: r => money(r.net, false) }, { h: 'Avg job', cls: 'num', v: r => money(r.avg, false) }], [...rows].reverse())}</details></div></div>`;
}
let KPI_TREND = [];
function kpiTrendHover() {
  const tip = document.getElementById('kpiTip'); if (!tip) return;
  document.querySelectorAll('.kb').forEach(g => {
    g.onmouseenter = e => { const r = KPI_TREND[+g.dataset.i]; tip.hidden = false; tip.innerHTML = `<b>${new Date(r.s + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><br>${money(r.net)} · ${r.n} invoices<br>avg job ${money(r.avg)}`;
      const box = g.closest('.card-pad').getBoundingClientRect(), b = g.getBoundingClientRect(); tip.style.left = Math.min(box.width - 170, Math.max(0, b.left - box.left - 40)) + 'px'; tip.style.top = '6px'; g.classList.add('on'); };
    g.onmouseleave = () => { tip.hidden = true; g.classList.remove('on'); };
  });
}
