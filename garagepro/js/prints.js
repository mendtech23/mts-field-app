/* GaragePro — print anything: current screen, vehicle history report, customer statement */
'use strict';

/* brand = full-bleed A4 document (mendtech. templates); otherwise a normal report with page margins */
function printHTML(html, brand = false) {
  document.body.classList.toggle('print-brand', !!brand);
  let ps = document.getElementById('pageStyle'); if (!ps) { ps = document.createElement('style'); ps.id = 'pageStyle'; document.head.appendChild(ps); }
  ps.textContent = brand ? '@page { size: A4; margin: 0; }' : '@page { size: A4; margin: 12mm; }';
  $('#printRoot').innerHTML = html;
  const imgs = [...$('#printRoot').querySelectorAll('img')].filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 60));
}
/* mendtech. letterhead: logo left, contact details right, gold/orange rule, then the report title */
function printHeader(title, meta = []) {
  const st = S.settings;
  return `<div class="lh"><img class="lh-logo" src="img/brand/logo.svg" alt="mendtech. auto · mobile">
      <div class="lh-contact">${esc(brandPhones())}<br>${esc(st.email || '')}<br>${esc(st.address || '')}${st.trn ? `<br>TRN: ${esc(st.trn)}` : ''}</div></div>
    <div class="bd-rule"><i></i><i></i></div>
    <div class="lh-title"><div class="dtitle">${esc(title)}</div>${meta.length ? `<div class="meta">${meta.map(([k, v]) => `<span>${esc(k)}</span> <b>${esc(v)}</b>`).join('<i>·</i>')}</div>` : ''}</div>`;
}
const printFooter = () => `<div class="lh-foot"><span>${esc(brandContact())}</span><span>${esc(brandFooterNote())}</span></div><div class="bd-bar"><i></i><i></i><i></i></div>`;

/* Print whatever screen is open — lists, reports, dashboards */
function printView() {
  const src = $('#view');
  const clone = src.cloneNode(true);
  // replace form controls with their current values
  const orig = src.querySelectorAll('input,select,textarea'), copy = clone.querySelectorAll('input,select,textarea');
  copy.forEach((el, i) => {
    const o = orig[i]; let val = '';
    if (o.type === 'checkbox') val = o.checked ? '☑' : '☐';
    else if (o.tagName === 'SELECT') val = o.selectedIndex >= 0 ? o.options[o.selectedIndex].text : '';
    else if (o.type === 'file' || o.type === 'search') val = '';
    else val = o.value;
    const span = document.createElement('span'); span.className = 'pv-val'; span.textContent = val;
    if (o.tagName === 'TEXTAREA') span.style.whiteSpace = 'pre-wrap';
    el.replaceWith(span);
  });
  clone.querySelectorAll('.btn,.icon-btn,.filters,.seg,.stepper .st:not(.on),.no-print,.rbtn:not(.on),label.btn').forEach(e => e.remove());
  const h1 = src.querySelector('h1');
  printHTML(`<div class="docv printview">${printHeader(h1 ? h1.textContent.trim().slice(0, 60) : 'Report', [['Printed', new Date().toLocaleString('en-GB')]])}<div style="margin-top:14px">${clone.innerHTML}</div>${printFooter()}</div>`);
}

/* Complete vehicle history report */
async function printVehicleReport(vid, withPhotos = true) {
  const v = get('vehicles', vid), c = customerOf(v) || {}, s = vehicleStats(v);
  const jobs = S.jobs.filter(j => j.vehicleId === v.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const photos = withPhotos ? await photosForVehicle(vid) : [];
  const pw = pendingWork(v);
  const spec = [['Make / model', vehicleLabel(v)], ['Colour', v.color], ['VIN', v.vin], ['Engine no.', v.engineNo], ['Fuel', v.fuel], ['Transmission', v.transmission], ['Engine size', v.engineSize], ['Drive', v.drive], ['Oil grade', v.oilGrade], ['Tyre size', v.tyreSize], ['Battery', v.battery], ['Registration expiry', fmtDate(v.regExpiry)], ['Insurance expiry', fmtDate(v.insExpiry)], ['Insurer', v.insurer]].filter(x => x[1]);
  const visits = jobs.map((j, idx) => {
    const inv = jobInvoice(j), st = inv ? invoiceState(inv) : null;
    const items = inv && !inv.void ? inv.items : j.items;
    const pays = inv ? S.payments.filter(p => p.invoiceId === inv.id) : [];
    const ph = photos.filter(p => p.jobId === j.id);
    const fl = inspectionFlags(j);
    return `<div class="visit">
      <div style="display:flex;justify-content:space-between;gap:10px"><b style="font-size:13.5px">Visit ${idx + 1} — Job ${esc(j.number)} (${esc(j.status)})</b><span>${fmtDate(j.date)} · ${fmtNum(j.odometer)} km · ${esc(techName(j.technicianId))}</span></div>
      ${j.complaint ? `<div style="margin-top:4px"><b>Request:</b> ${esc(j.complaint)}</div>` : ''}${j.diagnosis ? `<div><b>Work done:</b> ${esc(j.diagnosis)}</div>` : ''}
      ${(items || []).length ? `<table style="margin-top:6px"><thead><tr><th>Type</th><th>Description</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>${items.map(it => `<tr><td>${it.type === 'labour' ? 'Labour' : it.type === 'part' ? 'Part' : 'Other'}</td><td>${esc(it.desc)}${it.partNo ? ' <span style="color:#777">' + esc(it.partNo) + '</span>' : ''}</td><td class="n">${fmtNum(it.qty)}</td><td class="n">${money(lineTotal(it), false)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${fl.length ? `<div style="margin-top:5px"><b>Advisories:</b> ${fl.map(p => `${esc(p.point)} (${p.result}${p.resolved ? ', done' : ''}${p.note ? ': ' + esc(p.note) : ''})`).join('; ')}</div>` : ''}
      <div style="margin-top:5px">${inv ? `<b>Invoice ${esc(inv.number)}</b> ${fmtDate(inv.date)} — total ${money(st.total)}, paid ${money(st.paid)}${st.balance > 0 ? `, <b style="color:#b91c1c">balance ${money(st.balance)}</b>` : ' (paid in full)'}` : `<i>Not invoiced — estimated ${money(calcDoc(j).total)}</i>`}
        ${pays.length ? '<br>Payments: ' + pays.map(p => `${fmtDate(p.date)} ${money(p.amount)} ${esc(p.method || '')} (${esc(p.number)})`).join('; ') : ''}</div>
      ${ph.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${ph.map(p => `<div style="width:118px;font-size:9.5px;color:#555"><img src="${p.data}" style="width:118px;height:88px;object-fit:cover;border-radius:4px;display:block">${esc(p.stage)} ${esc(p.caption || '')}</div>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  const sched = serviceSchedule(v).filter(x => x.status !== 'No record');
  printHTML(`<div class="docv">${printHeader('VEHICLE HISTORY', [['Plate', v.plate], ['Report date', fmtDate(today())], ['Visits', s.visits]])}
    <div class="boxes"><div class="box"><div class="bt">Vehicle</div><b style="font-size:15px">${esc(v.plate)}</b> ${esc(v.emirate || '')}<br>${spec.map(([k, x]) => `${esc(k)}: <b>${esc(x)}</b>`).join('<br>')}</div>
      <div class="box"><div class="bt">Owner</div><b>${esc(c.name || '')}</b><br>${esc(c.phone || '')}<br>${esc(c.email || '')}<br><br>
        <div class="bt">Summary</div>Current odometer: <b>${fmtNum(s.odo)} km</b><br>First visit: ${fmtDate(s.first) || '—'} · Last visit: ${fmtDate(s.last) || '—'}<br>Lifetime spend: <b>${money(s.spent)}</b><br>Balance owed: <b>${money(s.balance)}</b></div></div>
    ${pw.quotes.length || pw.advisories.length ? `<div class="box" style="margin-bottom:10px;border-color:#f59e0b"><div class="bt">Recommended but not done</div>${pw.quotes.map(q => `Quotation ${esc(q.number)} (${fmtDate(q.date)}, ${quoteState(q)}) — ${esc(q.description || q.items.map(i => i.desc).join(', '))} — ${money(calcDoc(q).total)}`).join('<br>')}${pw.quotes.length && pw.advisories.length ? '<br>' : ''}${pw.advisories.map(a => `${esc(a.p.point)} — ${a.p.result}${a.p.note ? ' (' + esc(a.p.note) + ')' : ''}, found ${fmtDate(a.j.date)} on ${esc(a.j.number)}`).join('<br>')}</div>` : ''}
    ${sched.length ? `<h3 style="margin:12px 0 6px">Service schedule</h3><table><thead><tr><th>Item</th><th>Last done</th><th class="n">At km</th><th>Next due</th><th class="n">Due at km</th><th>Status</th></tr></thead><tbody>${sched.map(x => `<tr><td>${esc(x.name)}</td><td>${fmtDate(x.lastDate)}</td><td class="n">${fmtNum(x.lastOdo)}</td><td>${fmtDate(x.nextDate)}</td><td class="n">${x.nextOdo != null ? fmtNum(x.nextOdo) : ''}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3 style="margin:14px 0 6px">Visit history</h3>${visits || '<p>No visits recorded.</p>'}
  ${printFooter()}</div>`);
}

/* Customer statement of account with running balance */
function statementHTML(cid, from = '', to = today()) {
  const c = get('customers', cid);
  const invs = S.invoices.filter(i => i.customerId === cid && !i.void);
  const ids = new Set(invs.map(i => i.id));
  const rows = [
    ...invs.map(i => ({ date: i.date, ref: i.number, desc: `Invoice — ${(vehicleOf(i) || {}).plate || ''} ${vehicleLabel(vehicleOf(i))}`, dr: invoiceState(i).total, cr: 0 })),
    ...S.payments.filter(p => ids.has(p.invoiceId)).map(p => ({ date: p.date, ref: p.number, desc: `Payment ${p.method || ''} — ${(get('invoices', p.invoiceId) || {}).number || ''}`, dr: 0, cr: num(p.amount) })),
  ].sort((a, b) => (a.date || '').localeCompare(b.date || '') || b.dr - a.dr);
  let bal = 0, opening = 0;
  const shown = [];
  for (const r of rows) { if (r.date > to) continue; if (from && r.date < from) { opening += r.dr - r.cr; continue; } shown.push(r); }
  bal = opening;
  const aging = [0, 0, 0, 0];
  for (const i of invs) { const b = invoiceState(i).balance; if (b <= 0) continue; const d = daysBetween(i.date, to); aging[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += b; }
  return `<div class="docv">${printHeader('STATEMENT OF ACCOUNT', [['Customer', c.name], ['Period', `${from ? fmtDate(from) : 'Start'} – ${fmtDate(to)}`], ['Date', fmtDate(today())]])}
    <div class="boxes"><div class="box"><div class="bt">Customer</div><b>${esc(c.name)}</b><br>${esc(c.phone || '')}<br>${esc(c.email || '')}<br>${esc(c.address || '')}${c.trn ? '<br>TRN: ' + esc(c.trn) : ''}</div>
      <div class="box"><div class="bt">Amount due</div><div style="font-size:22px;font-weight:800">${money(customerBalance(cid))}</div></div></div>
    <table><thead><tr><th>Date</th><th>Ref</th><th>Description</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>
      ${from ? `<tr><td>${fmtDate(from)}</td><td></td><td><b>Opening balance</b></td><td></td><td></td><td class="n">${money(opening, false)}</td></tr>` : ''}
      ${shown.map(r => { bal += r.dr - r.cr; return `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.ref)}</td><td>${esc(r.desc)}</td><td class="n">${r.dr ? money(r.dr, false) : ''}</td><td class="n">${r.cr ? money(r.cr, false) : ''}</td><td class="n"><b>${money(bal, false)}</b></td></tr>`; }).join('')}
    </tbody></table>
    <table style="margin-top:14px"><thead><tr><th class="n">0–30 days</th><th class="n">31–60 days</th><th class="n">61–90 days</th><th class="n">90+ days</th><th class="n">Total due</th></tr></thead><tbody><tr>${aging.map(a => `<td class="n">${money(a, false)}</td>`).join('')}<td class="n"><b>${money(aging.reduce((x, y) => x + y, 0), false)}</b></td></tr></tbody></table>
    ${hasPaymentDetails(null) ? `<div class="foot">How to pay:\n${esc(payInfoText(null, ''))}</div>` : ''}${printFooter()}</div>`;
}
function printStatement(cid) { printHTML(statementHTML(cid)); }
