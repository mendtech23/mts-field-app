/* mendtech. — checklists (v3.3): full inspection, free 20-point health check, EV / hybrid check,
   pre-purchase inspection (PPI) with a branded report. Findings turn into a quotation in one tap. */
'use strict';

const CHECK_TEMPLATES = {
  health20: {
    label: '20-point health check', title: 'HEALTH CHECK REPORT', points: [
      ['Fluids', 'Engine oil level & condition'], ['Fluids', 'Coolant level'], ['Fluids', 'Brake fluid'], ['Fluids', 'Power steering fluid'], ['Fluids', 'Washer fluid'],
      ['Engine bay', 'Battery health test'], ['Engine bay', 'Drive belts'], ['Engine bay', 'Air filter'], ['Engine bay', 'Leaks (engine / under the car)'],
      ['Comfort', 'Cabin / AC filter'], ['Comfort', 'AC outlet temperature'],
      ['Brakes', 'Front brake pads'], ['Brakes', 'Rear brake pads'],
      ['Tyres', 'Tyre tread (all four)'], ['Tyres', 'Tyre pressures'],
      ['Lights & safety', 'Headlights & indicators'], ['Lights & safety', 'Brake & reverse lights'], ['Lights & safety', 'Wipers'], ['Lights & safety', 'Warning lights on dash'],
      ['Suspension', 'Shock absorbers (bounce test)'],
    ],
  },
  ev: {
    label: 'EV / hybrid check', title: 'EV CHECK REPORT', points: [
      ['High-voltage system', 'HV battery state of health (SoH)'], ['High-voltage system', 'Charge level & estimated range'], ['High-voltage system', 'HV cables & connectors (visual)'],
      ['High-voltage system', 'Insulation / isolation warning check'], ['High-voltage system', 'HV battery casing & underbody protection'],
      ['Charging', 'Charging port & cable'], ['Charging', 'On-board charger / charge test'],
      ['Cooling', 'Battery coolant level'], ['Cooling', 'Motor / inverter coolant'], ['Cooling', 'Heat pump / AC performance'],
      ['12V & electronics', '12V auxiliary battery'], ['12V & electronics', 'Warning lights & fault codes'], ['12V & electronics', 'Software version / updates'],
      ['Brakes', 'Regenerative braking operation'], ['Brakes', 'Brake pads & discs (corrosion from low use)'], ['Brakes', 'Brake fluid'],
      ['Tyres & suspension', 'Tyre tread & wear (heavier car)'], ['Tyres & suspension', 'Tyre pressures'], ['Tyres & suspension', 'Suspension & bushes'],
      ['Comfort', 'Cabin / AC filter'],
    ],
  },
  ppi: {
    label: 'Pre-purchase inspection', title: 'PRE-PURCHASE INSPECTION', points: [
      ['Documents & history', 'Mulkiya matches VIN / chassis'], ['Documents & history', 'Service history'], ['Documents & history', 'Accident / insurance history'], ['Documents & history', 'Odometer reading plausible'],
      ['Body & paint', 'Panel gaps & alignment'], ['Body & paint', 'Signs of accident repair'], ['Body & paint', 'Rust / corrosion'], ['Body & paint', 'Glass & lights'],
      ['Engine', 'Cold start'], ['Engine', 'Engine noises'], ['Engine', 'Oil leaks'], ['Engine', 'Exhaust smoke'], ['Engine', 'Coolant condition & leaks'], ['Engine', 'Belts & hoses'], ['Engine', 'Engine mounts'],
      ['Transmission', 'Shift quality'], ['Transmission', 'Fluid condition'], ['Transmission', 'Clutch / 4WD operation'],
      ['Electrical', 'OBD fault-code scan'], ['Electrical', 'Battery & charging'], ['Electrical', 'All lights'], ['Electrical', 'Windows, mirrors & locks'], ['Electrical', 'Infotainment & cameras'], ['Electrical', 'AC cooling'],
      ['Suspension & steering', 'Shock absorbers'], ['Suspension & steering', 'Bushes & ball joints'], ['Suspension & steering', 'Steering play'],
      ['Brakes', 'Pads & discs'], ['Brakes', 'Handbrake'], ['Brakes', 'ABS operation'],
      ['Tyres', 'Tread depth'], ['Tyres', 'Tyre age (DOT)'], ['Tyres', 'Spare tyre & tools'],
      ['Interior', 'Seats & trims'], ['Interior', 'Airbag light'], ['Interior', 'Seat belts'], ['Interior', 'Flood signs / damp odour'],
      ['Road test', 'Acceleration'], ['Road test', 'Braking in a straight line'], ['Road test', 'Noises & vibrations'], ['Road test', 'Steering pull'], ['Road test', 'Cruise control'],
    ],
  },
};
const PPI_PANELS = ['Bonnet', 'Roof', 'Front left fender', 'Front right fender', 'Front left door', 'Front right door', 'Rear left door', 'Rear right door', 'Rear left quarter', 'Rear right quarter', 'Boot / tailgate', 'Front bumper', 'Rear bumper'];
const PPI_VERDICTS = [['good', 'Recommended', '#15803d'], ['repairs', 'Recommended with repairs', '#b45309'], ['no', 'Not recommended', '#b91c1c']];
const PAINT_MAX = 200;   // microns above this usually means the panel was repainted / filled
const isEV = v => v && /electric|hybrid|ev/i.test(v.fuel || '');
const checkTitle = j => (CHECK_TEMPLATES[j.inspectionType] || { title: 'INSPECTION REPORT' }).title;
const checkLabel = j => (CHECK_TEMPLATES[j.inspectionType] || { label: `${S.settings.inspectionTemplate.length}-point inspection` }).label;

/* ---------- start: pick the checklist ---------- */
function startInspection() {
  const j = ED.doc, v = vehicleOf(j), st = S.settings;
  const opts = [['full', `Full ${st.inspectionTemplate.length}-point inspection`, 'Complete workshop inspection'],
    ['health20', CHECK_TEMPLATES.health20.label, healthFeeText()],
    ['ev', CHECK_TEMPLATES.ev.label, isEV(v) ? 'Suggested — this car is ' + esc(v.fuel) : 'For electric and hybrid cars'],
    ['ppi', CHECK_TEMPLATES.ppi.label, `For buyers of a used car · ${money(st.offers.ppiPrice)}`]];
  const m = openModal({
    title: 'Which check?', size: 'narrow',
    body: `<div class="grid" style="gap:8px">${opts.map(([k, l, d]) => `<button class="btn lg check-pick ${k === 'ev' && isEV(v) ? 'primary' : ''}" data-k="${k}" style="justify-content:flex-start;text-align:left"><span><b>${esc(l)}</b><br><span class="small" style="opacity:.8">${d}</span></span></button>`).join('')}</div>`,
  });
  m.el.querySelectorAll('.check-pick').forEach(b => b.onclick = () => { m.close(); beginCheck(b.dataset.k); });
}
function healthFeeText() {
  const fee = num(S.settings.offers.healthCheckFee);
  return `Free with any paid service${fee ? ` · otherwise ${money(fee)}` : ''}`;
}
async function beginCheck(kind) {
  const j = ED.doc;
  const pts = kind === 'full' ? S.settings.inspectionTemplate : CHECK_TEMPLATES[kind].points;
  j.inspection = pts.map(([cat, point]) => ({ cat, point, result: '', note: '' }));
  j.inspectionType = kind === 'full' ? '' : kind;
  if (kind === 'health20' && !(j.items || []).some(it => it.hc)) (j.items = j.items || []).push({ type: 'labour', desc: '20-point health check', qty: 1, rate: num(S.settings.offers.healthCheckFee), cost: 0, hc: true });
  if (kind === 'ppi') {
    j.ppi = j.ppi || { panels: {}, verdict: '', buyer: (customerOf(j) || {}).name || '', seller: '', askingPrice: '', obd: '', roadTest: '', summary: '' };
    if (!(j.items || []).some(it => it.ppi)) (j.items = j.items || []).push({ type: 'labour', desc: 'Pre-purchase inspection', qty: 1, rate: num(S.settings.offers.ppiPrice), cost: 0, ppi: true });
    if (!j.type || j.type === S.settings.lists.jobType[0]) j.type = 'Pre-Purchase Inspection';
  }
  edChanged(); await edFlush(); render();
}
/* The health check is free when the job has any other paid work — applied when the invoice is made */
function applyHealthCheckRule(items) {
  const hc = (items || []).find(it => it.hc); if (!hc) return items;
  const paid = items.some(it => !it.hc && lineTotal(it) > 0);
  hc.rate = paid ? 0 : num(S.settings.offers.healthCheckFee);
  hc.desc = paid ? '20-point health check — FREE with your service' : '20-point health check';
  return items;
}

/* ---------- PPI extras on the job card ---------- */
function ppiCardHTML(j) {
  if (j.inspectionType !== 'ppi') return '';
  const p = j.ppi || {}, panels = p.panels || {};
  return `<div class="card mb"><div class="card-head"><h3>🔎 Pre-purchase inspection</h3><div class="actions"><button class="btn sm" onclick="previewCheckReport()">🖨 Report</button></div></div><div class="card-pad">
    <div class="grid g4 mb">
      <div class="field"><label>Buyer (prepared for)</label><input value="${esc(p.buyer || '')}" onchange="ppiSet('buyer', this.value)"></div>
      <div class="field"><label>Seller / dealer</label><input value="${esc(p.seller || '')}" onchange="ppiSet('seller', this.value)"></div>
      <div class="field"><label>Asking price (AED)</label><input type="number" value="${esc(p.askingPrice || '')}" onchange="ppiSet('askingPrice', this.value)"></div>
      <div class="field"><label>Verdict</label><select onchange="ppiSet('verdict', this.value)"><option value="">—</option>${PPI_VERDICTS.map(([k, l]) => `<option value="${k}" ${p.verdict === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="fieldset-title" style="margin-bottom:6px">Paint thickness (microns) — over ${PAINT_MAX} usually means repainted or filler</div>
    <div class="grid g4 mb">${PPI_PANELS.map(pn => { const val = panels[pn]; return `<div class="field"><label>${esc(pn)}</label><input type="number" value="${esc(val || '')}" style="${num(val) > PAINT_MAX ? 'border-color:var(--red);color:var(--red)' : ''}" onchange="ppiPanel(${jsq(pn)}, this.value)"></div>`; }).join('')}</div>
    <div class="grid g2">
      <div class="field"><label>OBD fault codes</label><textarea onchange="ppiSet('obd', this.value)" placeholder="e.g. P0420 catalyst efficiency — or 'No codes'">${esc(p.obd || '')}</textarea></div>
      <div class="field"><label>Road test</label><textarea onchange="ppiSet('roadTest', this.value)">${esc(p.roadTest || '')}</textarea></div>
      <div class="field spanall"><label>Summary for the buyer</label><textarea onchange="ppiSet('summary', this.value)" placeholder="Overall condition, what needs doing, estimated cost of repairs">${esc(p.summary || '')}</textarea></div></div>
  </div></div>`;
}
function ppiSet(k, v) { const j = ED.doc; j.ppi = j.ppi || { panels: {} }; j.ppi[k] = v; edChanged(); }
function ppiPanel(pn, v) { const j = ED.doc; j.ppi = j.ppi || { panels: {} }; j.ppi.panels = j.ppi.panels || {}; if (v === '') delete j.ppi.panels[pn]; else j.ppi.panels[pn] = num(v); edChanged(); edFlush().then(render); }

/* ---------- branded inspection report (print + PDF) ---------- */
const RES_COLOR = { OK: '#15803d', Attention: '#b45309', Replace: '#b91c1c', NA: '#9aa3b5' };
function checkReportHTML(j) {
  const { v, c } = docParties(j), ins = j.inspection || [], ppi = j.inspectionType === 'ppi' ? (j.ppi || {}) : null;
  const cnt = r => ins.filter(p => p.result === r).length;
  const verdict = ppi && PPI_VERDICTS.find(x => x[0] === ppi.verdict);
  const cats = [...new Set(ins.map(p => p.cat))];
  const block = cat => `<table class="bd-items sm bd-check"><thead><tr><th class="c-d">${esc(cat)}</th><th style="width:96px">Result</th><th style="width:250px">Reading / note</th></tr></thead><tbody>
    ${ins.filter(p => p.cat === cat).map(p => `<tr><td class="c-d">${esc(p.point)}</td><td><b style="color:${RES_COLOR[p.result] || '#9aa3b5'}">${p.result === 'NA' ? 'N/A' : esc(p.result || '—')}</b></td><td>${esc(p.note || '')}</td></tr>`).join('')}</tbody></table>`;
  const panels = ppi ? PPI_PANELS.filter(pn => (ppi.panels || {})[pn] != null) : [];
  return bdDoc(`${bdHead(checkTitle(j), [['Report no.', j.number], ['Date', fmtDate(j.completed || j.date)], ['Inspected by', techName(j.technicianId)]])}
    <div class="bd-two"><div><div class="bd-sec">${ppi ? 'Prepared for' : 'Customer'}</div>${bdField('Name', ppi ? ppi.buyer || c.name : c.name)}${ppi ? bdField('Seller', ppi.seller) + bdField('Asking price', ppi.askingPrice ? money(ppi.askingPrice) : '') : bdField('Mobile', c.phone)}</div>
      <div><div class="bd-sec">Vehicle</div>${bdVehicleFields(v, j)}</div></div>
    <div class="bd-sum">${verdict ? `<div class="bd-verdict" style="border-color:${verdict[2]};color:${verdict[2]}">${esc(verdict[1].toUpperCase())}</div>` : ''}
      <div><b style="color:${RES_COLOR.OK}">${cnt('OK')}</b> OK</div><div><b style="color:${RES_COLOR.Attention}">${cnt('Attention')}</b> need attention</div><div><b style="color:${RES_COLOR.Replace}">${cnt('Replace')}</b> need replacing</div><div class="muted">${ins.length} points checked</div></div>
    ${ppi && ppi.summary ? `<div class="bd-sec" style="margin-top:12px">Summary</div><p class="bd-p" style="white-space:pre-wrap">${esc(ppi.summary)}</p>` : ''}
    ${cats.map(block).join('')}
    ${panels.length ? `<div class="bd-sec" style="margin-top:14px">Paint thickness (microns)</div><div class="bd-paint">${panels.map(pn => { const x = num(ppi.panels[pn]); return `<div class="${x > PAINT_MAX ? 'hi' : ''}"><span>${esc(pn)}</span><b>${fmtNum(x)}</b></div>`; }).join('')}</div><p class="bd-legend">Over ${PAINT_MAX} µm usually means the panel was repainted or filled.</p>` : ''}
    ${ppi && ppi.obd ? `<div class="bd-sec" style="margin-top:12px">OBD fault codes</div><p class="bd-p" style="white-space:pre-wrap">${esc(ppi.obd)}</p>` : ''}
    ${ppi && ppi.roadTest ? `<div class="bd-sec" style="margin-top:12px">Road test</div><p class="bd-p" style="white-space:pre-wrap">${esc(ppi.roadTest)}</p>` : ''}
    <div class="bd-grow"></div>
    ${ppi ? `<p class="bd-decl">This report describes the condition of the vehicle on the date shown, based on a visual and road-test inspection without dismantling. It is not a guarantee of future condition or a warranty.</p>` : ''}
    ${bdFoot([{ label: `Inspected by · ${BRAND_TXT}` }, { label: ppi ? 'Buyer · signature & date' : 'Customer · signature & date' }])}`);
}
function previewCheckReport() {
  const j = ED.doc; if (!j || !(j.inspection || []).length) return toast('Start a check first', 'err');
  edFlush().then(() => {
    const m = openModal({ title: `${checkTitle(j)} ${esc(j.number)}`, size: 'xwide', body: `<div class="bd-stage">${checkReportHTML(j)}</div>`,
      foot: `<button class="btn" data-print>🖨 Print</button><button class="btn" data-pdf>⬇ Download PDF</button><button class="btn wa" data-wa>WhatsApp customer</button>` });
    fitDocs(m.el);
    m.el.querySelector('[data-print]').onclick = () => printHTML(checkReportHTML(j), true);
    m.el.querySelector('[data-pdf]').onclick = async () => { const f = await checkReportPDF(j); if (f) downloadBlob(f, f.name); };
    m.el.querySelector('[data-wa]').onclick = async () => { const f = await checkReportPDF(j); if (f) downloadBlob(f, f.name); m.close(); sendInspection(); };
  });
}
async function checkReportPDF(j) {
  try { await ensurePdfLibs(); } catch (e) { toast('PDF engine could not load', 'err'); return null; }
  const B = brandPDF(), { pdf, K } = B, { v, c } = docParties(j), ins = j.inspection || [], ppi = j.inspectionType === 'ppi' ? (j.ppi || {}) : null;
  let y = B.header(checkTitle(j), [['Report no.', j.number], ['Date', fmtDate(j.completed || j.date)], ['Inspected by', techName(j.technicianId)]], { titlePx: checkTitle(j).length > 18 ? 22 : 26 });
  const colW = (K.R - K.M - 22 * PX) / 2, x2 = K.M + colW + 22 * PX;
  B.sec(ppi ? 'Prepared for' : 'Customer', K.M, y + 2.4); B.sec('Vehicle', x2, y + 2.4);
  const fy = y + 2.4 + 7 * PX + 24 * PX - 1.2;
  const left = ppi ? [['Name', ppi.buyer || c.name], ['Seller', ppi.seller], ['Asking price', ppi.askingPrice ? money(ppi.askingPrice) : '']] : [['Name', c.name], ['Mobile', c.phone]];
  const right = [['Make/Model', [v.make, v.model].filter(Boolean).join(' ')], ['Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · ')], ['VIN', v.vin], ['Year', v.year], ['Odometer', j.odometer ? fmtNum(j.odometer) + ' km' : '']];
  left.forEach(([k, val], i) => B.field(k, val, K.M, fy + i * 24 * PX, colW)); right.forEach(([k, val], i) => B.field(k, val, x2, fy + i * 24 * PX, colW));
  y = fy + 4 * 24 * PX + 6;
  const cnt = r => ins.filter(p => p.result === r).length, verdict = ppi && PPI_VERDICTS.find(x => x[0] === ppi.verdict);
  let sx = K.M;
  if (verdict) { B.draw(verdict[2], 0.6); B.font('head', 12, verdict[2], 0.3); const w = pdf.getTextWidth(verdict[1].toUpperCase()) + 0.3 * verdict[1].length + 8; pdf.roundedRect(sx, y - 5, w, 8, 1, 1, 'S'); B.txt(verdict[1].toUpperCase(), sx + 4, y + 0.6); pdf.setCharSpace(0); sx += w + 6; }
  [[cnt('OK'), 'OK', RES_COLOR.OK], [cnt('Attention'), 'need attention', RES_COLOR.Attention], [cnt('Replace'), 'need replacing', RES_COLOR.Replace]].forEach(([n, l, col]) => {
    B.font('bold', 12, col); B.txt(String(n), sx, y + 0.6); sx += pdf.getTextWidth(String(n)) + 1.5; B.font('reg', 10, BRAND.ink); B.txt(l, sx, y + 0.6); sx += pdf.getTextWidth(l) + 7; });
  y += 6;
  if (ppi && ppi.summary) { B.sec('Summary', K.M, y + 3); y = pdfLines(B, ppi.summary, K.M, y + 8, K.R - K.M) + 1; }
  const cats = [...new Set(ins.map(p => p.cat))];
  for (const cat of cats) {
    pdf.autoTable({
      startY: y + 3, theme: 'plain', margin: { left: K.M, right: K.W - K.R, top: 18, bottom: 34 },
      head: [[cat.toUpperCase(), 'RESULT', 'READING / NOTE']], body: ins.filter(p => p.cat === cat).map(p => [p.point, p.result === 'NA' ? 'N/A' : (p.result || '-'), p.note || '']),
      styles: { font: B.face.reg[0], fontSize: 7.6, textColor: RGB(BRAND.navy), cellPadding: 1.6, minCellHeight: 6, valign: 'middle' },
      headStyles: { font: B.face.semi[0], fillColor: RGB(BRAND.navy), textColor: 255, fontSize: 7 },
      columnStyles: { 1: { cellWidth: 26, font: B.face.bold[0] }, 2: { cellWidth: 66 } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.textColor = RGB(RES_COLOR[d.cell.raw === 'N/A' ? 'NA' : d.cell.raw] || BRAND.steel); if (d.section === 'head') d.cell.styles.textColor = 255; },
      didDrawCell: d => { if (d.section === 'body') B.hline(d.cell.x, d.cell.x + d.cell.width, d.cell.y + d.cell.height, BRAND.line); },
      willDrawPage: d => { if (d.pageNumber > 1) { B.watermark(); B.bar(); } },
    });
    y = pdf.lastAutoTable.finalY + 2;
  }
  const panels = ppi ? PPI_PANELS.filter(pn => (ppi.panels || {})[pn] != null) : [];
  const need = (panels.length ? 30 : 0) + (ppi && ppi.obd ? 14 : 0) + (ppi && ppi.roadTest ? 14 : 0);
  if (need && y + need > B.signTop() - 16) { B.newPage(); y = 18; }
  if (panels.length) {
    B.sec('Paint thickness (microns)', K.M, y + 5); y += 8;
    const cw = (K.R - K.M) / 4;
    panels.forEach((pn, i) => { const x = K.M + (i % 4) * cw, yy = y + Math.floor(i / 4) * 6.5, val = num(ppi.panels[pn]);
      B.font('reg', 9, BRAND.ink); B.txt(pn, x, yy + 3.5); B.font('bold', 9.5, val > PAINT_MAX ? '#b91c1c' : BRAND.navy); B.txt(fmtNum(val), x + cw - 4, yy + 3.5, { align: 'right' }); });
    y += Math.ceil(panels.length / 4) * 6.5 + 1; B.font('reg', 8.5, BRAND.mute); B.txt(`Over ${PAINT_MAX} microns usually means the panel was repainted or filled.`, K.M, y + 2); y += 4;
  }
  if (ppi && ppi.obd) { B.sec('OBD fault codes', K.M, y + 5); y = pdfLines(B, ppi.obd, K.M, y + 10, K.R - K.M); }
  if (ppi && ppi.roadTest) { B.sec('Road test', K.M, y + 5); y = pdfLines(B, ppi.roadTest, K.M, y + 10, K.R - K.M); }
  if (ppi) { B.font('reg', 8.5, BRAND.ink); pdf.splitTextToSize('This report describes the condition of the vehicle on the date shown, based on a visual and road-test inspection without dismantling. It is not a guarantee of future condition or a warranty.', K.R - K.M).forEach((l, i) => B.txt(l, K.M, B.signTop() - 12 + i * 3.6)); }
  B.signs([{ label: `Inspected by · ${BRAND_TXT}` }, { label: ppi ? 'Buyer · signature & date' : 'Customer · signature & date' }]);
  B.contact(); pdfPageNumbers(B);
  return new File([pdf.output('blob')], `${checkTitle(j).replace(/\W+/g, '_')}_${j.number}_${norm(v.plate)}.pdf`, { type: 'application/pdf' });
}
