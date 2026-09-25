/* GaragePro — printable documents (HTML preview + real PDF via jsPDF) */
'use strict';

const DOC_TITLES = { quote: 'QUOTATION', job: 'JOB CARD', invoice: 'TAX INVOICE', receipt: 'PAYMENT RECEIPT' };
function docTitle(kind, doc) { return kind === 'invoice' && (!S.settings.trn || (doc && doc.plain)) ? 'INVOICE' : DOC_TITLES[kind]; }

function groupItems(items) {
  const g = [['Parts', 'part'], ['Labour', 'labour'], ['Other / Sublet', 'other']]
    .map(([title, t]) => ({ title, items: (items || []).filter(it => (it.type || 'other') === t) }))
    .filter(x => x.items.length);
  return g;
}
function docParties(doc) {
  const v = vehicleOf(doc) || {}, c = customerOf(doc) || {};
  return { v, c };
}
function docMetaRows(kind, doc) {
  const rows = [[kind === 'receipt' ? 'Receipt No.' : kind === 'job' ? 'Job No.' : kind === 'quote' ? 'Quote No.' : 'Invoice No.', doc.number], ['Date', fmtDate(doc.date)]];
  if (kind === 'quote' && doc.validUntil) rows.push(['Valid until', fmtDate(doc.validUntil)]);
  if (kind === 'invoice' && doc.dueDate) rows.push(['Due date', fmtDate(doc.dueDate)]);
  if (kind === 'invoice' && doc.jobId) { const j = get('jobs', doc.jobId); if (j) rows.push(['Job ref.', j.number]); }
  if (kind === 'job') { if (doc.promised) rows.push(['Promised', fmtDate(doc.promised)]); rows.push(['Status', doc.status]); if (doc.technicianId) rows.push(['Technician', techName(doc.technicianId)]); }
  if (doc.lpo) rows.push(['Customer ref / LPO', doc.lpo]);
  return rows;
}
function inspectionFlags(job) { return (job.inspection || []).filter(p => p.result === 'Attention' || p.result === 'Replace'); }

/* ---------- mendtech. brand helpers (shared by documents, PDFs and printouts) ---------- */
const BRAND_TXT = 'mendtech.';
const BRAND = { navy: '#122036', steel: '#9aa3b5', gold: '#c9a227', goldInk: '#a9812e', orange: '#d97a2b', ink: '#4b5265', mute: '#6c7488', line: '#dee3e9', line2: '#c7ccd9' };
function brandPhones() {
  const st = S.settings, seen = new Set();
  return [st.phone, st.whatsapp, st.mobile].filter(Boolean).filter(p => { const k = p.replace(/\D/g, '').slice(-9); if (seen.has(k)) return false; seen.add(k); return true; }).join(' · ');
}
const brandContact = () => [brandPhones(), S.settings.email].filter(Boolean).join(' · ');
const brandFooterNote = () => S.settings.docFooter || DEFAULT_SETTINGS.docFooter;
/* numbered terms: one per line; placeholders {validDays} */
function brandTerms(txt) {
  return String(txt || '').replace(/\{validDays\}/g, num(S.settings.quoteValidDays) || 14).split('\n').map(l => l.trim()).filter(Boolean)
    .map((l, i) => /^\d+[.)]/.test(l) ? l : `${i + 1}. ${l}`);
}
const bdCB = (on, label) => `<span class="bd-cbx"><span class="bd-cb${on ? ' on' : ''}"></span>${label ? esc(label) : ''}</span>`;
const bdField = (label, val) => `<div class="bd-f"><span>${esc(label)}</span><b>${esc(val ?? '')}</b></div>`;
function bdHead(title, meta, left = '', plain = false) {
  return `<header class="bd-head"><div class="bd-brand">${plain ? '<div class="bd-logo"></div>' : `<img class="bd-logo" src="img/brand/logo.svg" alt="${BRAND_TXT} AUTO · MOBILE">`}${left}</div>
    <div class="bd-titlebox"><div class="bd-title">${esc(title)}</div>${meta ? `<div class="bd-meta${meta.cols === 2 ? ' two' : ''}">${(meta.rows || meta).map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v ?? '')}</b>`).join('')}</div>` : ''}</div></header>
    <div class="bd-rule"><i></i><i></i></div>`;
}
function bdFoot(signs, plain = false) {
  return `<footer class="bd-foot">${signs ? `<div class="bd-signs" style="grid-template-columns:repeat(${signs.length},1fr)">${signs.map(s => `<div>${s.img ? `<img src="${s.img}" alt="">` : ''}<span>${s.label}</span></div>`).join('')}</div>` : ''}
    ${plain ? '' : `<div class="bd-contact"><span>${esc(brandContact())}</span><span>${esc(brandFooterNote())}</span></div>`}</footer>${plain ? '' : '<div class="bd-bar"><i></i><i></i><i></i></div>'}`;
}
const bdDoc = (inner, cls = '') => `<div class="bdoc ${cls}">${/\bplain\b/.test(cls) ? '' : '<img class="bd-wm" src="img/brand/watermark.svg" alt="">'}<div class="bd-body">${inner}</div></div>`;
const typeLabel = it => it.type === 'part' ? 'Parts' : it.type === 'labour' ? 'Labour' : 'Other';
function bdVehicleFields(v, doc) {
  return bdField('Make/Model', [v.make, v.model].filter(Boolean).join(' ')) + bdField('Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · ')) +
    bdField('VIN', v.vin) + bdField('Year', v.year) + (doc && doc.odometer ? bdField('Odometer', fmtNum(doc.odometer) + ' km') : '');
}
/* the checked payment methods on an invoice */
function paidMethods(inv) {
  const ms = S.payments.filter(p => p.invoiceId === inv.id).map(p => (p.method || '').toLowerCase());
  return { cash: ms.some(m => m.includes('cash')), card: ms.some(m => m.includes('card')), bank: ms.some(m => m.includes('bank') || m.includes('transfer') || m.includes('cheque')), credit: ms.some(m => m.includes('credit')) };
}

/* ---------- HTML documents (screen preview + print) ---------- */
function docHTML(kind, doc, extra = {}) {
  if (kind === 'receipt') return receiptHTML(doc, extra);
  if (kind === 'job') return jobCardHTML(doc, extra);
  const st = S.settings, { v, c } = docParties(doc);
  const t = calcDoc(doc), s = kind === 'invoice' ? invoiceState(doc) : null;
  const mob = lineOf(doc) === 'mobile';
  const meta = kind === 'quote'
    ? [['Quote no.', doc.number], ['Date', fmtDate(doc.date)], ['Valid until', fmtDate(doc.validUntil)]]
    : [['Invoice no.', doc.number], ['Date', fmtDate(doc.date)], ['Job card no.', (get('jobs', doc.jobId) || {}).number || ''],
      ...(doc.dueDate && doc.dueDate !== doc.date ? [['Due date', fmtDate(doc.dueDate)]] : []), ...(doc.lpo ? [['Customer ref', doc.lpo]] : [])];
  const plain = !!doc.plain;   // "plain document": no company name, logo, TRN, bank or contact details
  const trn = kind === 'invoice' && !plain ? `<div class="bd-trn">TRN: <b>${esc(st.trn || '')}</b></div>` : '';
  const party = kind === 'quote'
    ? `<div><div class="bd-sec">Customer</div>${bdField('Name', c.name)}${bdField('Mobile', c.phone)}${bdField('Email', c.email)}</div>`
    : `<div><div class="bd-sec">Bill to</div>${bdField('Name', c.name)}${bdField('Company', c.company || (c.type === 'Company' ? c.name : ''))}${bdField('Mobile', c.phone)}${bdField('TRN', c.trn)}</div>`;
  let rows = '', n = 0;
  for (const it of doc.items || []) {
    n++;
    rows += `<tr><td class="c-n">${n}</td><td class="c-d">${esc(it.desc)}${it.partNo ? `<small>${esc(it.partNo)}</small>` : ''}</td><td class="c-t">${typeLabel(it)}</td>
      <td class="c-q">${fmtNum(it.qty)}${it.type === 'labour' ? ' h' : ''}</td><td class="c-u">${money(it.rate, false)}</td><td class="c-a">${money(lineTotal(it), false)}</td></tr>`;
  }
  for (let i = n; i < 8; i++) rows += `<tr class="pad"><td class="c-n"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
  const disc = t.discount ? `− ${money(t.discount)}` : '—';
  let tot = `<div class="bd-tot"><div><span>Subtotal</span><b>${money(t.subtotal)}</b></div>
    <div><span>Discount${t.discount && doc.discountType !== 'amt' ? ` (${num(doc.discount)}%)` : ''}</span><b>${disc}</b></div>
    <div><span>VAT ${num(t.vatRate)}%</span><b>${money(t.vat)}</b></div>
    <div class="grand"><span>TOTAL</span><b>${money(t.total)}</b></div>`;
  if (s) tot += `<div><span>Paid</span><b>${money(s.paid)}</b></div><div class="bal"><span>Balance due</span><b>${money(s.balance)}</b></div>`;
  tot += '</div>';
  let left = '';
  if (kind === 'quote') {
    const terms = brandTerms(st.quoteTerms);
    left = `${doc.notes ? `<div class="bd-sec">Notes</div><p class="bd-p">${esc(doc.notes)}</p>` : ''}${terms.length ? `<div class="bd-sec">Terms</div>${terms.map(l => `<p class="bd-term">${esc(l)}</p>`).join('')}` : ''}`;
  } else {
    const pm = paidMethods(doc), link = payLinkFor(doc), pasted = pastedBankDetails();
    left = `<div class="bd-sec">Payment</div><div class="bd-cbrow">${bdCB(pm.cash, 'Cash')}${bdCB(pm.card, 'Card')}${bdCB(pm.bank, 'Bank transfer')}${bdCB(pm.credit, 'Credit (fleet)')}</div>
      ${plain ? '' : `<p class="bd-bank">Bank: <b>${esc(st.wioIban ? (st.wioBank || 'Wio Bank') : '')}</b> IBAN: <b>${esc(st.wioIban || '')}</b></p>
      ${st.wioIban && (st.wioName || st.legalName) ? `<p class="bd-p">Account name: ${esc(st.wioName || st.legalName)} · Reference: ${esc(doc.number)}</p>` : ''}
      ${pasted && !st.wioIban ? `<p class="bd-p" style="white-space:pre-wrap">${esc(pasted)}</p>` : ''}`}
      ${link && s.balance > 0 && !doc.void ? `<div class="bd-pay">${qrSVG(link, 74)}<div><b>Pay by card / Apple Pay</b><br>Scan the code or open<br><span>${esc(link)}</span></div></div>` : ''}
      ${brandTerms(st.invoiceTerms).map(l => `<p class="bd-p">${esc(l.replace(/^\d+[.)]\s*/, ''))}</p>`).join('')}
      ${doc.notes ? `<p class="bd-p"><b>Notes:</b> ${esc(doc.notes)}</p>` : ''}
      <p class="bd-words">Amount in words: ${esc(amountInWords(t.total))}</p>`;
  }
  const desc = kind === 'quote' ? doc.description : doc.workDone;
  const stamp = doc.void ? '<div class="bd-stamp void">VOID</div>' : s && s.status === 'Paid' ? '<div class="bd-stamp">PAID</div>' : '';
  const signs = kind === 'quote' ? [{ label: plain ? 'Prepared by' : `Prepared by · ${BRAND_TXT}` }, { label: 'Customer approval · name, signature &amp; date' }]
    : [{ label: 'Authorised signature &amp; stamp' }, { label: 'Received by customer · signature &amp; date' }];
  return bdDoc(`${bdHead(kind === 'invoice' ? docTitle('invoice', doc) : 'QUOTATION', meta, trn, plain)}
    <div class="bd-two">${party}<div><div class="bd-sec">Vehicle</div>${bdVehicleFields(v, doc)}</div></div>
    ${kind === 'quote' ? `<div class="bd-cbrow" style="margin-top:12px">${bdCB(!mob, 'Workshop (Auto)')}${bdCB(mob, 'On-site (Mobile)')}</div>` : ''}
    ${desc ? `<div class="bd-sec" style="margin-top:14px">${kind === 'quote' ? 'Work requested' : 'Work carried out'}</div><p class="bd-p" style="white-space:pre-wrap">${esc(desc)}</p>` : ''}
    <table class="bd-items"><thead><tr><th class="c-n">#</th><th class="c-d">Description</th><th class="c-t">Type</th><th class="c-q">Qty</th><th class="c-u">Unit (${esc(st.currency)})</th><th class="c-a">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="bd-after"><div class="bd-left">${left}</div><div class="bd-right">${tot}${stamp}</div></div>
    <div class="bd-grow"></div>${bdFoot(signs, plain)}`, (doc.void ? 'is-void' : '') + (plain ? ' plain' : ''));
}

const CHECK_BODY = ['Front bumper', 'Bonnet', 'Windscreen', 'Roof', 'Left side / doors', 'Right side / doors', 'Rear bumper', 'Boot / tailgate', 'Wheels / rims', 'Mirrors & lights'];
const CHECK_ITEMS = ['Spare tyre', 'Jack & tools', 'Registration (Mulkiya)', 'Service book', 'Car key(s)', 'Remote / key fob', 'Floor mats', 'Charging cables', 'Warning triangle', 'Valuables noted'];
const FUEL_STEPS = ['E', '¼', '½', '¾', 'F'];
function jobCardHTML(j, extra = {}) {
  const { v, c } = docParties(j.vehicleId ? j : {}), ck = j.checkin || {}, mob = isMobile(j), m = j.mobile || {};
  const tech = mob ? crewOf(j).join(', ') : techName(j.technicianId);
  const fuel = FUEL_STEPS.indexOf(j.fuelIn);
  const body = CHECK_BODY.map(a => { const x = (ck.body || {})[a]; return `<tr><td>${esc(a)}</td>${['OK', 'S', 'D', 'C'].map(k => `<td class="cb">${bdCB(x === k)}</td>`).join('')}</tr>`; }).join('');
  const items = CHECK_ITEMS.map(a => { const x = (ck.items || {})[a]; const label = a === 'Car key(s)' ? `Car key(s) · qty ${ck.keys ? `<u>${esc(ck.keys)}</u>` : '___'}` : esc(a); return `<tr><td>${label}</td><td class="cb">${bdCB(x === true)}</td><td class="cb">${bdCB(x === false)}</td></tr>`; }).join('');
  const lines = (txt, min) => { const ls = String(txt || '').split('\n').filter(Boolean); while (ls.length < min) ls.push(''); return ls.map(l => `<div class="bd-line">${esc(l)}</div>`).join(''); };
  const notes = [j.diagnosis, ...inspectionFlags(j).map(p => `${p.result === 'Replace' ? 'REPLACE' : 'ATTENTION'}: ${p.point}${p.note ? ' — ' + p.note : ''}`)].filter(Boolean).join('\n');
  const hide = !!extra.hidePrices, its = j.items || [];
  const work = its.length ? `<div class="bd-sec">Work &amp; parts</div><table class="bd-items sm"><thead><tr><th class="c-n">#</th><th class="c-d">Description</th><th class="c-t">Type</th><th class="c-q">Qty</th>${hide ? '' : '<th class="c-u">Unit</th><th class="c-a">Amount</th>'}</tr></thead><tbody>
    ${its.map((it, i) => `<tr><td class="c-n">${i + 1}</td><td class="c-d">${esc(it.desc)}</td><td class="c-t">${typeLabel(it)}</td><td class="c-q">${fmtNum(it.qty)}${it.type === 'labour' ? ' h' : ''}</td>${hide ? '' : `<td class="c-u">${money(it.rate, false)}</td><td class="c-a">${money(lineTotal(it), false)}</td>`}</tr>`).join('')}</tbody></table>
    ${hide ? '' : `<div class="bd-after"><div></div><div class="bd-right"><div class="bd-tot sm"><div class="grand"><span>ESTIMATE (incl. VAT)</span><b>${money(calcDoc(j).total)}</b></div></div></div></div>`}` : '';
  const sg = j.signatures || {};
  const meta = { cols: 2, rows: [['Job no.', j.number], ['Date in', fmtDate(j.date)], ['Technician', tech], ['Time in', ck.timeIn || (j.createdAt ? new Date(j.createdAt).toTimeString().slice(0, 5) : '')]] };
  return bdDoc(`${bdHead('JOB CARD · VEHICLE CHECK-IN', meta)}
    <div class="bd-cbrow wide">${bdCB(!mob, 'Workshop (Auto)')}${bdCB(mob, 'On-site (Mobile)')}${bdCB(!!ck.breakdown, 'Breakdown / recovery')}
      <span class="bd-f inline"><span>Location</span><b>${esc(ck.location || (mob ? locationText(m) : ''))}</b></span></div>
    <div class="bd-two"><div><div class="bd-sec">Customer</div>${bdField('Name', c.name)}${bdField('Mobile', c.phone)}${bdField('Email', c.email)}</div>
      <div><div class="bd-sec">Vehicle</div>${bdField('Make/Model', [v.make, v.model].filter(Boolean).join(' '))}${bdField('Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · '))}${bdField('VIN', v.vin)}${bdField('Year', v.year)}</div></div>
    <div class="bd-cf"><div><div class="bd-sec">Customer complaint / work requested</div>${lines(j.complaint || (mob ? m.problem : ''), 4)}</div>
      <div><div class="bd-sec">Fuel level</div><div class="bd-fuel">${FUEL_STEPS.map((f, i) => `<div class="${fuel >= 0 && i <= fuel ? 'on' : ''}"></div>`).join('')}</div>
        <div class="bd-fuel-l">${FUEL_STEPS.map(f => `<span>${f}</span>`).join('')}</div>
        <div class="bd-f" style="margin-top:14px"><span>Odometer</span><b>${j.odometer ? fmtNum(j.odometer) : ''}<i>km</i></b></div></div></div>
    <div class="bd-two tables"><table class="bd-grid"><thead><tr><th>Body condition</th><th>OK</th><th>S</th><th>D</th><th>C</th></tr></thead><tbody>${body}</tbody></table>
      <table class="bd-grid"><thead><tr><th>Items in vehicle</th><th>Yes</th><th>No</th></tr></thead><tbody>${items}</tbody></table></div>
    <div class="bd-legend">S = scratch · D = dent · C = crack / chip${ck.bodyNotes ? ` · <b>${esc(ck.bodyNotes)}</b>` : ''}</div>
    <div class="bd-sec" style="margin-top:14px">Technician notes / findings</div>${lines(notes, 5)}
    <div class="bd-grow"></div>
    <p class="bd-decl">I confirm the vehicle condition above and authorise ${BRAND_TXT} to inspect the vehicle. Additional work will be quoted and approved before it starts. ${BRAND_TXT} is not responsible for valuables left in the vehicle.</p>
    ${bdFoot([{ label: 'Customer · drop-off' + (sg.checkin ? ' — ' + esc(sg.checkin.name || '') : ''), img: sg.checkin && sg.checkin.data }, { label: `Received by · ${BRAND_TXT}` },
      { label: 'Customer · collection &amp; date' + (sg.collection ? ' — ' + esc(sg.collection.name || '') + ', ' + esc(fmtDate((sg.collection.at || '').slice(0, 10))) : ''), img: sg.collection && sg.collection.data }])}`)
    + (work ? bdDoc(`${bdHead('JOB CARD · WORK & PARTS', { cols: 2, rows: [['Job no.', j.number], ['Date in', fmtDate(j.date)], ['Plate no.', v.plate], ['Page', '2 of 2']] })}${work}<div class="bd-grow"></div>${bdFoot(null)}`) : '');
}

function receiptHTML(p, extra = {}) {
  const inv = extra.invoice || get('invoices', p.invoiceId) || {}, s = inv.id ? invoiceState(inv) : null, { v, c } = docParties(inv.id ? inv : p);
  const mth = (p.method || '').toLowerCase();
  return bdDoc(`${bdHead('PAYMENT RECEIPT', [['Receipt no.', p.number], ['Date', fmtDate(p.date)], ['Invoice no.', inv.number || '']])}
    <div class="bd-two"><div><div class="bd-sec">Received from</div>${bdField('Name', c.name)}${bdField('Mobile', c.phone)}${bdField('Email', c.email)}</div>
      <div><div class="bd-sec">Vehicle</div>${bdField('Make/Model', [v.make, v.model].filter(Boolean).join(' '))}${bdField('Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · '))}${bdField('VIN', v.vin)}</div></div>
    <table class="bd-items"><thead><tr><th class="c-n">#</th><th class="c-d">Description</th><th class="c-a">Amount</th></tr></thead><tbody>
      <tr><td class="c-n">1</td><td class="c-d">Payment against invoice ${esc(inv.number || '')}${p.reference ? `<small>Reference: ${esc(p.reference)}</small>` : ''}</td><td class="c-a">${money(p.amount, false)}</td></tr></tbody></table>
    <div class="bd-after"><div class="bd-left"><div class="bd-sec">Payment method</div><div class="bd-cbrow">${bdCB(mth.includes('cash'), 'Cash')}${bdCB(mth.includes('card'), 'Card')}${bdCB(/bank|transfer|cheque/.test(mth), 'Bank transfer')}${bdCB(mth.includes('credit'), 'Credit (fleet)')}</div>
      ${/stripe|wio|machine|cheque/i.test(p.method || '') ? `<p class="bd-p">Method: ${esc(p.method)}</p>` : ''}<p class="bd-words">Amount in words: ${esc(amountInWords(p.amount))}</p></div>
      <div class="bd-right"><div class="bd-tot"><div class="grand"><span>RECEIVED</span><b>${money(p.amount)}</b></div>
        ${s ? `<div><span>Invoice total</span><b>${money(s.total)}</b></div><div><span>Paid to date</span><b>${money(s.paid)}</b></div><div class="bal"><span>Balance due</span><b>${money(s.balance)}</b></div>` : ''}</div></div></div>
    <div class="bd-grow"></div>${bdFoot([{ label: `Received by · ${BRAND_TXT}` }, { label: 'Customer · signature &amp; date' }])}`);
}

function printDoc(kind, doc, extra) {
  printHTML(docHTML(kind, doc, extra), true);
}
function previewDoc(kind, doc, extra = {}) {
  const m = openModal({
    title: `${kind === 'job' ? 'JOB CARD' : docTitle(kind, doc)} ${esc(doc.number || '')}`, size: 'xwide',
    body: `<div class="bd-stage">${docHTML(kind, doc, extra)}</div>`,
    foot: `<button class="btn" data-print>🖨 Print</button><button class="btn" data-pdf>⬇ Download PDF</button><button class="btn wa" data-send>Send via WhatsApp / Email</button>`
  });
  fitDocs(m.el);
  m.el.querySelector('[data-print]').onclick = () => printDoc(kind, doc, extra);
  m.el.querySelector('[data-pdf]').onclick = async () => { const f = await pdfFile(kind, doc, extra); if (f) downloadBlob(f, f.name); };
  m.el.querySelector('[data-send]').onclick = () => { m.close(); openSendDialog(kind, doc, extra); };
}
/* A4 documents are 794 px wide: shrink them to fit phone screens */
function fitDocs(root) {
  const stage = root.querySelector('.bd-stage'); if (!stage) return;
  const fit = () => { const w = stage.clientWidth - 2; stage.querySelectorAll('.bdoc').forEach(d => { d.style.zoom = w < 794 ? (w / 794).toFixed(3) : ''; }); };
  requestAnimationFrame(fit);
}

/* ---------- Real PDF (jsPDF + AutoTable, bundled): the same mendtech. layout as the printed documents ----------
   A4 = 210 × 297 mm. The HTML templates are 794 px wide, so 1 px = 0.2645 mm and font px × 0.75 = pt. */
const PDF_LIBS = ['lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js', 'lib/pdf-fonts.js', 'lib/brand-assets.js'];   // bundled — works offline
async function ensurePdfLibs() { for (const s of PDF_LIBS) await loadScript(s); }
function pdfName(kind, doc) {
  const v = vehicleOf(kind === 'receipt' ? get('invoices', doc.invoiceId) || doc : doc);
  const t = kind === 'job' ? 'JOB_CARD' : kind === 'quote' ? 'QUOTATION' : kind === 'receipt' ? 'RECEIPT' : docTitle(kind, doc).replace(/\s+/g, '_');
  return `${t}_${doc.number || ''}${v ? '_' + norm(v.plate) : ''}.pdf`;
}
async function pdfFile(kind, doc, extra = {}) {
  try { await ensurePdfLibs(); }
  catch (e) { toast('PDF engine could not load (lib folder missing?). Use Print → "Save as PDF" instead.', 'err'); return null; }
  const pdf = buildPDF(kind, doc, extra);
  const blob = pdf.output('blob');
  return new File([blob], pdfName(kind, doc), { type: 'application/pdf' });
}

const PX = 0.26458;   // mm per template px
const RGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function brandPDF(opts = {}) {
  const plain = !!opts.plain;   // no logo, watermark, colour bar or contact line
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const F = window.GP_PDF_FONTS || {};
  const fams = [['Inter-Regular', 'Inter'], ['Inter-SemiBold', 'InterSemi'], ['Inter-Bold', 'InterBold'], ['SpaceGrotesk-Bold', 'SpaceGrotesk']];
  let brandFonts = true;
  try { for (const [file, fam] of fams) { pdf.addFileToVFS(file + '.ttf', F[file]); pdf.addFont(file + '.ttf', fam, 'normal'); } }
  catch (e) { brandFonts = false; }
  // only characters our embedded fonts contain (Latin-1 + common punctuation)
  const ok = /[\x20-\x7E\xA0-\xFF–—‘’“”•…€−]/;
  const safe = s => Array.isArray(s) ? s.map(safe) : [...String(s ?? '')].map(ch => ch === '\n' || ok.test(ch) ? ch : '').join('');
  const _text = pdf.text.bind(pdf);
  pdf.text = (t, ...a) => _text(Array.isArray(t) ? t.map(safe) : safe(t), ...a);
  const _split = pdf.splitTextToSize.bind(pdf);
  pdf.splitTextToSize = (t, w, o) => _split(Array.isArray(t) ? t.map(safe) : safe(t), w, o);
  const face = { reg: brandFonts ? ['Inter', 'normal'] : ['helvetica', 'normal'], semi: brandFonts ? ['InterSemi', 'normal'] : ['helvetica', 'bold'],
    bold: brandFonts ? ['InterBold', 'normal'] : ['helvetica', 'bold'], head: brandFonts ? ['SpaceGrotesk', 'normal'] : ['helvetica', 'bold'] };
  const K = { W: 210, H: 297, M: 48 * PX, R: 210 - 48 * PX };
  const api = {
    pdf, K, face,
    font(f, pxSize, color = BRAND.ink, spacing = 0) { pdf.setFont(...face[f]); pdf.setFontSize(pxSize * 0.75); pdf.setTextColor(...RGB(color)); pdf.setCharSpace(spacing); },
    fill(c) { pdf.setFillColor(...RGB(c)); }, draw(c, w = 0.26) { pdf.setDrawColor(...RGB(c)); pdf.setLineWidth(w); },
    hline(x1, x2, y, c = BRAND.line2, w = 0.26) { api.draw(c, w); pdf.line(x1, y, x2, y); },
    txt(s, x, y, opt) { pdf.text(String(s ?? ''), x, y, opt); },
    fit(s, w) { let t = String(s ?? ''); while (t && pdf.getTextWidth(t) > w) t = t.slice(0, -1); return t === String(s ?? '') ? t : t.slice(0, -1) + '…'; },
    sec(label, x, y) { api.font('semi', 9.5, BRAND.goldInk, 9.5 * 0.75 * 0.24 * 0.3528); api.txt(String(label).toUpperCase(), x, y); pdf.setCharSpace(0); },
    field(label, val, x, y, w) {   // y = baseline
      api.font('reg', 10.5, BRAND.mute); api.txt(label, x, y);
      const vx = x + 70 * PX; api.font('semi', 10.5, BRAND.navy); api.txt(api.fit(val, w - 70 * PX - 1), vx + 0.5, y);
      api.hline(vx, x + w, y + 1.4);
    },
    cb(x, y, on, s = 12 * PX, c = BRAND.navy) {   // x,y = top-left
      api.draw(on ? BRAND.navy : c, on ? 0.32 : 0.28);
      if (on) { api.fill(BRAND.navy); pdf.roundedRect(x, y, s, s, 0.6, 0.6, 'FD'); api.draw('#ffffff', 0.42); pdf.lines([[s * 0.2, s * 0.2], [s * 0.36, -s * 0.42]], x + s * 0.24, y + s * 0.5); }
      else pdf.roundedRect(x, y, s, s, 0.6, 0.6, 'S');
    },
    cbLabel(x, y, on, label) { api.cb(x, y - 2.7, on); api.font('reg', 10.5, BRAND.ink); api.txt(label, x + 12 * PX + 1.9, y); return x + 12 * PX + 1.9 + pdf.getTextWidth(label) + 22 * PX; },
    header(title, rows, opts = {}) {
      const I = window.GP_BRAND_IMG || {};
      if (I.logo && !plain) pdf.addImage(I.logo, 'PNG', K.M, 43 * PX, 165 * PX, 165 * PX / 2.885, 'logo', 'FAST');
      const cs = (opts.titlePx || 26) * 0.75 * 0.035 * 0.3528; api.font('head', opts.titlePx || 26, BRAND.navy, cs);
      api.txt(title, K.R - pdf.getTextWidth(title) - cs * (title.length - 1), 62 * PX); pdf.setCharSpace(0);
      const two = opts.cols === 2, vw = (two ? 96 : 128) * PX; let y = 84 * PX;
      if (!two) for (const [k, v] of rows) {
        const vx = K.R - vw; api.font('reg', 10.5, BRAND.ink); api.txt(k, vx - 2.6, y, { align: 'right' });
        api.font('semi', 10.5, BRAND.navy); api.txt(api.fit(v, vw - 1), vx + 0.5, y); api.hline(vx, K.R, y + 1.4); y += 19 * PX;
      } else for (let i = 0; i < rows.length; i += 2) {
        [[rows[i], K.R - vw * 2 - 17], [rows[i + 1], K.R - vw]].forEach(([r, vx]) => { if (!r) return;
          api.font('reg', 10.5, BRAND.ink); api.txt(r[0], vx - 2.6, y, { align: 'right' }); api.font('semi', 10.5, BRAND.navy); api.txt(api.fit(r[1], vw - 1), vx + 0.5, y); api.hline(vx, vx + vw, y + 1.4); });
        y += 19 * PX;
      }
      if (opts.trn != null) { api.font('reg', 10, BRAND.ink); api.txt('TRN:', K.M, 128 * PX); api.font('semi', 10, BRAND.navy); api.txt(opts.trn, K.M + 9, 128 * PX); api.hline(K.M + 8, K.M + 8 + 92 * PX, 128 * PX + 1.2); }
      const ry = 150 * PX; api.fill('#eef0f4'); pdf.rect(K.M, ry, K.R - K.M, 4 * PX, 'F');
      api.fill(BRAND.gold); pdf.rect(K.M, ry, 55 * PX, 4 * PX, 'F'); api.fill(BRAND.orange); pdf.rect(K.M + 55 * PX, ry, 55 * PX, 4 * PX, 'F');
      return 174 * PX;
    },
    watermark() { const I = window.GP_BRAND_IMG || {}; if (I.watermark && !plain) pdf.addImage(I.watermark, 'PNG', 172 * PX, 478 * PX, 486 * PX, 486 * PX / 1.712, 'wm', 'FAST'); },
    bar() { if (plain) return; const y = K.H - 7 * PX; api.fill(BRAND.navy); pdf.rect(0, y, K.W * 0.64, 7 * PX, 'F'); api.fill(BRAND.gold); pdf.rect(K.W * 0.64, y, K.W * 0.18, 7 * PX, 'F'); api.fill(BRAND.orange); pdf.rect(K.W * 0.82, y, K.W * 0.18 + 0.1, 7 * PX, 'F'); },
    contact() { if (plain) return; const y = K.H - 7 * PX - 16 * PX - 1; api.font('reg', 9, BRAND.mute); api.txt(brandContact(), K.M, y); api.txt(brandFooterNote(), K.R, y, { align: 'right' }); },
    signTop: () => K.H - 7 * PX - 16 * PX - 1 - 22 * PX - 8 * PX - 3,   // y of the signature lines
    signs(list) {
      const y = api.signTop(), gap = 34 * PX, w = (K.R - K.M - gap * (list.length - 1)) / list.length;
      list.forEach((s, i) => { const x = K.M + i * (w + gap);
        if (s.img) { try { pdf.addImage(s.img, 'PNG', x, y - 12.5, Math.min(w, 55), 12); } catch (e) { } }
        api.hline(x, x + w, y, BRAND.steel, 0.32); api.font('reg', 10, BRAND.ink); api.txt(s.label, x, y + 8 * PX + 2.6); });
    },
    /* every page: watermark first so content sits on top — call before drawing a page */
    newPage() { pdf.addPage(); api.watermark(); api.bar(); },
  };
  api.watermark(); api.bar();
  return api;
}

/* items table (AutoTable) in the brand style; returns the y below it */
function pdfItems(B, startY, items, { hide = false, pad = 0, desc = true } = {}) {
  const { pdf, K, face } = B;
  const body = (items || []).map((it, i) => {
    const d = it.desc + (it.partNo ? '\n' + it.partNo : '');
    const row = [i + 1, d, typeLabel(it), fmtNum(it.qty) + (it.type === 'labour' ? ' h' : '')];
    if (!hide) row.push(money(it.rate, false), money(lineTotal(it), false));
    return row;
  });
  for (let i = body.length; i < pad; i++) body.push(hide ? ['', '', '', ''] : ['', '', '', '', '', '']);
  const head = hide ? ['#', 'DESCRIPTION', 'TYPE', 'QTY'] : ['#', 'DESCRIPTION', 'TYPE', 'QTY', `UNIT (${S.settings.currency})`, 'AMOUNT'];
  pdf.autoTable({
    startY, theme: 'plain', margin: { left: K.M, right: K.W - K.R, top: 18, bottom: 34 },
    head: [head], body,
    styles: { font: face.reg[0], fontStyle: face.reg[1], fontSize: 10.5 * 0.75, textColor: RGB(BRAND.navy), cellPadding: { top: 1.9, bottom: 1.7, left: 2.1, right: 2.1 }, minCellHeight: 27 * PX, valign: 'middle', lineColor: RGB(BRAND.line), lineWidth: 0 },
    headStyles: { font: face.semi[0], fontStyle: face.semi[1], fillColor: RGB(BRAND.navy), textColor: 255, fontSize: 9.5 * 0.75, minCellHeight: 27 * PX },
    columnStyles: { 0: { cellWidth: 28 * PX, halign: 'center', textColor: RGB(BRAND.steel) }, 2: { cellWidth: 72 * PX, textColor: RGB(BRAND.steel), fontSize: 9.5 * 0.75 }, 3: { cellWidth: 44 * PX, halign: 'right' }, 4: { cellWidth: 84 * PX, halign: 'right' }, 5: { cellWidth: 92 * PX, halign: 'right', font: face.semi[0] } },
    didParseCell: d => {
      d.cell.text = d.cell.text.map(t => [...t].filter(ch => ch.charCodeAt(0) < 0x2200).join(''));
      if (d.section === 'head') { d.cell.styles.halign = d.column.index >= 3 ? 'right' : d.column.index === 0 ? 'center' : 'left'; d.cell.styles.textColor = 255; }
      if (d.section === 'body' && d.column.index === 1 && d.cell.raw && String(d.cell.raw).includes('\n')) d.cell.styles.fontSize = 10.5 * 0.75;
    },
    didDrawCell: d => {
      if (d.section !== 'body') return;
      B.draw(BRAND.line, 0.26); pdf.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      if (d.column.index > 0) pdf.line(d.cell.x, d.cell.y, d.cell.x, d.cell.y + d.cell.height);
    },
    willDrawPage: d => { if (d.pageNumber > 1) { B.watermark(); B.bar(); } },
  });
  return pdf.lastAutoTable.finalY;
}
/* totals box on the right; rows: [label, value, style] style: '' | 'grand' | 'bal' */
function pdfTotals(B, y, rows, w = 230 * PX) {
  const { pdf, K } = B, x = K.R - w;
  for (const [k, v, st] of rows) {
    if (st === 'grand') {
      B.fill(BRAND.navy); pdf.roundedRect(x, y + 0.5, w, 34 * PX, 0.8, 0.8, 'F');
      B.font('head', 13, '#ffffff'); B.txt(k, x + 2.1, y + 0.5 + 34 * PX / 2 + 1.6); B.txt(v, K.R - 2.1, y + 0.5 + 34 * PX / 2 + 1.6, { align: 'right' });
      y += 34 * PX + 1;
    } else {
      B.font(st === 'bal' ? 'bold' : 'reg', 10.5, BRAND.navy); B.txt(k, x + 2.1, y + 27 * PX / 2 + 1.3);
      B.font(st === 'bal' ? 'bold' : 'semi', 10.5, BRAND.navy); B.txt(v, K.R - 2.1, y + 27 * PX / 2 + 1.3, { align: 'right' });
      y += 27 * PX; B.hline(x, K.R, y, BRAND.line);
    }
  }
  return y;
}
function pdfLines(B, text, x, y, w, px = 10, color = BRAND.ink, lh = 4.0) {
  B.font('reg', px, color); const ls = B.pdf.splitTextToSize(String(text || ''), w);
  ls.forEach((l, i) => B.txt(l, x, y + i * lh)); return y + ls.length * lh;
}

function buildPDF(kind, doc, extra = {}) {
  if (kind === 'job') return buildJobPDF(doc, extra);
  if (kind === 'receipt') return buildReceiptPDF(doc, extra);
  const plain = !!doc.plain;
  const B = brandPDF({ plain }), { pdf, K } = B, st = S.settings, { v, c } = docParties(doc);
  const t = calcDoc(doc), s = kind === 'invoice' ? invoiceState(doc) : null, mob = lineOf(doc) === 'mobile';
  const rows = kind === 'quote' ? [['Quote no.', doc.number], ['Date', fmtDate(doc.date)], ['Valid until', fmtDate(doc.validUntil)]]
    : [['Invoice no.', doc.number], ['Date', fmtDate(doc.date)], ['Job card no.', (get('jobs', doc.jobId) || {}).number || ''],
      ...(doc.dueDate && doc.dueDate !== doc.date ? [['Due date', fmtDate(doc.dueDate)]] : []), ...(doc.lpo ? [['Customer ref', doc.lpo]] : [])];
  let y = B.header(kind === 'quote' ? 'QUOTATION' : docTitle('invoice', doc), rows, { trn: kind === 'invoice' && !plain ? (st.trn || '') : null });
  const colW = (K.R - K.M - 22 * PX) / 2, x2 = K.M + colW + 22 * PX;
  B.sec(kind === 'quote' ? 'Customer' : 'Bill to', K.M, y + 2.4); B.sec('Vehicle', x2, y + 2.4);
  let fy = y + 2.4 + 7 * PX + 24 * PX - 1.2;
  const left = kind === 'quote' ? [['Name', c.name], ['Mobile', c.phone], ['Email', c.email]] : [['Name', c.name], ['Company', c.company || (c.type === 'Company' ? c.name : '')], ['Mobile', c.phone], ['TRN', c.trn]];
  const right = [['Make/Model', [v.make, v.model].filter(Boolean).join(' ')], ['Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · ')], ['VIN', v.vin], ['Year', v.year], ...(doc.odometer ? [['Odometer', fmtNum(doc.odometer) + ' km']] : [])];
  left.forEach(([k, val], i) => B.field(k, val, K.M, fy + i * 24 * PX, colW));
  right.forEach(([k, val], i) => B.field(k, val, x2, fy + i * 24 * PX, colW));
  y = fy + Math.max(left.length, right.length) * 24 * PX - 24 * PX + 4;
  if (kind === 'quote') { y += 12 * PX; let cx = B.cbLabel(K.M, y + 2.6, !mob, 'Workshop (Auto)'); B.cbLabel(cx, y + 2.6, mob, 'On-site (Mobile)'); y += 6; }
  const desc = kind === 'quote' ? doc.description : doc.workDone;
  if (desc) { y += 3.7; B.sec(kind === 'quote' ? 'Work requested' : 'Work carried out', K.M, y + 2.4); y = pdfLines(B, desc, K.M, y + 7.2, K.R - K.M, 10) - 1; }
  y = pdfItems(B, y + 16 * PX, doc.items, { pad: 8 }) + 14 * PX;
  const tot = [['Subtotal', money(t.subtotal)], [`Discount${t.discount && doc.discountType !== 'amt' ? ` (${num(doc.discount)}%)` : ''}`, t.discount ? '- ' + money(t.discount) : '-'], [`VAT ${num(t.vatRate)}%`, money(t.vat)], ['TOTAL', money(t.total), 'grand']];
  if (s) tot.push(['Paid', money(s.paid)], ['Balance due', money(s.balance), 'bal']);
  const leftW = K.R - K.M - 230 * PX - 28 * PX;
  // left column content (terms or payment) — measured first so we know if it fits above the signatures
  const leftDraw = (dry) => {
    let ly = y + 1.2;
    const P = { sec: (l) => { if (!dry) B.sec(l, K.M, ly + 2.4); ly += 7.5; }, lines: (tx, px = 10, col = BRAND.ink) => { B.font('reg', px); const ls = pdf.splitTextToSize(String(tx), leftW); if (!dry) { B.font('reg', px, col); ls.forEach((l, i) => B.txt(l, K.M, ly + i * 3.9)); } ly += ls.length * 3.9 + 1.2; } };
    if (kind === 'quote') {
      if (doc.notes) { P.sec('Notes'); P.lines(doc.notes); }
      const terms = brandTerms(st.quoteTerms); if (terms.length) { P.sec('Terms'); terms.forEach(l => P.lines(l)); }
    } else {
      P.sec('Payment');
      const pm = paidMethods(doc);
      if (!dry) { let cx = K.M; [[pm.cash, 'Cash'], [pm.card, 'Card'], [pm.bank, 'Bank transfer'], [pm.credit, 'Credit (fleet)']].forEach(([on, l]) => { cx = B.cbLabel(cx, ly + 1.5, on, l); }); }
      ly += 8;
      if (!dry && !plain) {
        B.font('reg', 10, BRAND.ink); B.txt('Bank:', K.M, ly); B.font('semi', 10, BRAND.navy); const bk = st.wioIban ? (st.wioBank || 'Wio Bank') : ''; B.txt(bk, K.M + 10, ly); B.hline(K.M + 9.5, K.M + 36, ly + 1.1, BRAND.navy, 0.2);
        B.font('reg', 10, BRAND.ink); B.txt('IBAN:', K.M + 39, ly); B.font('semi', 10, BRAND.navy); B.txt(st.wioIban || '', K.M + 49.5, ly); B.hline(K.M + 49, Math.min(K.M + leftW, K.M + 110), ly + 1.1, BRAND.navy, 0.2);
      }
      if (!plain) {
        ly += 5;
        if (st.wioIban && (st.wioName || st.legalName)) P.lines(`Account name: ${st.wioName || st.legalName} · Reference: ${doc.number}`);
        const pasted = pastedBankDetails(); if (pasted && !st.wioIban) P.lines(pasted);
      }
      const link = payLinkFor(doc), qm = link && s.balance > 0 && !doc.void ? qrMatrix(link) : null;
      if (qm) {
        const qs = 19; if (!dry) { const n = qm.length, cell = qs / n; B.fill('#000000'); qm.forEach((row, r) => row.forEach((d, cc) => { if (d) pdf.rect(K.M + cc * cell, ly + r * cell, cell + 0.01, cell + 0.01, 'F'); }));
          B.font('semi', 9.5, BRAND.navy); B.txt('Pay by card / Apple Pay', K.M + qs + 3, ly + 4); B.font('reg', 9, BRAND.mute); pdf.splitTextToSize(link, leftW - qs - 4).slice(0, 3).forEach((l, i) => B.txt(l, K.M + qs + 3, ly + 8.2 + i * 3.6)); }
        ly += qs + 6;
      }
      brandTerms(st.invoiceTerms).forEach(l => P.lines(l.replace(/^\d+[.)]\s*/, '')));
      if (doc.notes) P.lines('Notes: ' + doc.notes);
      P.lines('Amount in words: ' + amountInWords(t.total), 9.5, BRAND.mute);
    }
    return ly;
  };
  const needLeft = leftDraw(true), needRight = y + tot.length * 27 * PX + 12;
  if (Math.max(needLeft, needRight) > B.signTop() - 14) { B.newPage(); y = 20; }
  leftDraw(false);
  const ty = pdfTotals(B, y, tot);
  if (doc.void || (s && s.status === 'Paid')) {   // PAID / VOID stamp over the table corner
    const red = !!doc.void; pdf.saveGraphicsState && pdf.saveGraphicsState();
    B.draw(red ? '#b91c1c' : BRAND.gold, 0.7); B.font('head', 20, red ? '#b91c1c' : BRAND.goldInk, 1.2);
    const sx = K.R - 34, sy = y - 17; pdf.roundedRect(sx, sy, 32, 10, 1, 1, 'S'); B.txt(red ? 'VOID' : 'PAID', sx + 16, sy + 7.2, { align: 'center' }); pdf.setCharSpace(0);
  }
  B.signs(kind === 'quote' ? [{ label: plain ? 'Prepared by' : `Prepared by · ${BRAND_TXT}` }, { label: 'Customer approval · name, signature & date' }] : [{ label: 'Authorised signature & stamp' }, { label: 'Received by customer · signature & date' }]);
  B.contact(); pdfPageNumbers(B);
  return pdf;
}

function pdfPageNumbers(B) {
  const n = B.pdf.getNumberOfPages(); if (n < 2) return;
  for (let i = 1; i <= n; i++) { B.pdf.setPage(i); B.font('reg', 8.5, BRAND.mute); B.txt(`Page ${i} of ${n}`, B.K.W / 2, B.K.H - 7 * PX - 2.2, { align: 'center' }); }
  B.pdf.setPage(n);
}

function buildJobPDF(j, extra = {}) {
  const B = brandPDF(), { pdf, K } = B, { v, c } = docParties(j), ck = j.checkin || {}, mob = isMobile(j), m = j.mobile || {};
  const tech = mob ? crewOf(j).join(', ') : techName(j.technicianId);
  let y = B.header('JOB CARD · VEHICLE CHECK-IN', [['Job no.', j.number], ['Date in', fmtDate(j.date)], ['Technician', tech], ['Time in', ck.timeIn || (j.createdAt ? new Date(j.createdAt).toTimeString().slice(0, 5) : '')]], { cols: 2, titlePx: 22 });
  // job type + location
  let cx = B.cbLabel(K.M, y + 2.6, !mob, 'Workshop (Auto)'); cx = B.cbLabel(cx, y + 2.6, mob, 'On-site (Mobile)'); cx = B.cbLabel(cx, y + 2.6, !!ck.breakdown, 'Breakdown / recovery');
  B.font('reg', 10.5, BRAND.mute); B.txt('Location', cx, y + 2.6); B.font('semi', 10.5, BRAND.navy); B.txt(B.fit(ck.location || (mob ? locationText(m) : ''), K.R - cx - 16), cx + 15.5, y + 2.6); B.hline(cx + 15, K.R, y + 4);
  y += 12 * PX + 7;
  const colW = (K.R - K.M - 22 * PX) / 2, x2 = K.M + colW + 22 * PX;
  B.sec('Customer', K.M, y + 2.4); B.sec('Vehicle', x2, y + 2.4);
  const fy = y + 2.4 + 7 * PX + 24 * PX - 1.2;
  [['Name', c.name], ['Mobile', c.phone], ['Email', c.email]].forEach(([k, val], i) => B.field(k, val, K.M, fy + i * 24 * PX, colW));
  [['Make/Model', [v.make, v.model].filter(Boolean).join(' ')], ['Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · ')], ['VIN', v.vin], ['Year', v.year]].forEach(([k, val], i) => B.field(k, val, x2, fy + i * 24 * PX, colW));
  y = fy + 3 * 24 * PX + 6;
  // complaint lines + fuel
  const cfW = K.R - K.M - 222 * PX - 28 * PX, fx = K.M + cfW + 28 * PX;
  B.sec('Customer complaint / work requested', K.M, y + 2.4); B.sec('Fuel level', fx, y + 2.4);
  const lines = (txt, min, x, y0, w) => { B.font('reg', 10.5, BRAND.navy); const ls = String(txt || '').split('\n').flatMap(l => pdf.splitTextToSize(l, w - 1)).filter(Boolean); while (ls.length < min) ls.push('');
    ls.forEach((l, i) => { const ly = y0 + (i + 1) * 24 * PX; B.font('reg', 10.5, BRAND.navy); B.txt(l, x + 0.5, ly - 1.3); B.hline(x, x + w, ly); }); return y0 + ls.length * 24 * PX; };
  const ly = lines(j.complaint || (mob ? m.problem : ''), 4, K.M, y + 3.5, cfW);
  const fuel = FUEL_STEPS.indexOf(j.fuelIn), bw = (222 * PX - 4 * 3 * PX) / 5;
  FUEL_STEPS.forEach((f, i) => { const bx = fx + i * (bw + 3 * PX), by = y + 5; B.draw(BRAND.navy, 0.32); if (fuel >= 0 && i <= fuel) { B.fill(BRAND.navy); pdf.roundedRect(bx, by, bw, 22 * PX, 0.5, 0.5, 'FD'); } else pdf.roundedRect(bx, by, bw, 22 * PX, 0.5, 0.5, 'S');
    B.font('reg', 9, BRAND.mute); B.txt(f, bx + bw / 2, by + 22 * PX + 4, { align: 'center' }); });
  const oy = y + 5 + 22 * PX + 4 + 9; B.font('reg', 10.5, BRAND.mute); B.txt('Odometer', fx, oy); B.font('semi', 10.5, BRAND.navy); B.txt(j.odometer ? fmtNum(j.odometer) : '', fx + 19, oy); B.font('reg', 9, BRAND.mute); B.txt('km', K.R, oy - 1.5, { align: 'right' }); B.hline(fx + 18.5, K.R, oy + 1.4);
  y = Math.max(ly, oy) + 16 * PX;
  // body condition + items tables
  const grid = (x, w, title, cols, rows) => {
    const cw = 34 * PX, hh = 6.2, rh = 23 * PX; B.fill(BRAND.navy); pdf.roundedRect(x, y, w, hh, 0.8, 0.8, 'F'); pdf.rect(x, y + 1, w, hh - 1, 'F');
    B.font('semi', 8.5, '#ffffff', 0.25); B.txt(title.toUpperCase(), x + 2.6, y + 4.2); cols.forEach((cl, i) => B.txt(cl, x + w - cw * (cols.length - i) + cw / 2, y + 4.2, { align: 'center' })); pdf.setCharSpace(0);
    rows.forEach(([label, vals], r) => { const ry = y + hh + r * rh; B.font('reg', 10, BRAND.navy); B.txt(label, x + 2.6, ry + rh / 2 + 1.3);
      vals.forEach((on, i) => B.cb(x + w - cw * (cols.length - i) + cw / 2 - 1.6, ry + rh / 2 - 1.6, on, 3.2, BRAND.steel)); B.hline(x, x + w, ry + rh, BRAND.line); });
    return y + hh + rows.length * rh;
  };
  const body = CHECK_BODY.map(a => { const x = (ck.body || {})[a]; return [a, ['OK', 'S', 'D', 'C'].map(k => x === k)]; });
  const items = CHECK_ITEMS.map(a => { const x = (ck.items || {})[a]; return [a === 'Car key(s)' ? `Car key(s) · qty ${ck.keys || '___'}` : a, [x === true, x === false]]; });
  const gy = Math.max(grid(K.M, colW, 'Body condition', ['OK', 'S', 'D', 'C'], body), grid(x2, colW, 'Items in vehicle', ['YES', 'NO'], items));
  B.font('reg', 9, BRAND.mute); B.txt('S = scratch · D = dent · C = crack / chip' + (ck.bodyNotes ? ' · ' + ck.bodyNotes : ''), K.M, gy + 4);
  y = gy + 10;
  B.sec('Technician notes / findings', K.M, y + 2.4);
  const notes = [j.diagnosis, ...inspectionFlags(j).map(p => `${p.result === 'Replace' ? 'REPLACE' : 'ATTENTION'}: ${p.point}${p.note ? ' - ' + p.note : ''}`)].filter(Boolean).join('\n');
  lines(notes, 5, K.M, y + 3.5, K.R - K.M);
  // declaration + signatures
  const decl = `I confirm the vehicle condition above and authorise ${BRAND_TXT} to inspect the vehicle. Additional work will be quoted and approved before it starts. ${BRAND_TXT} is not responsible for valuables left in the vehicle.`;
  B.font('reg', 8.8, BRAND.ink); pdf.splitTextToSize(decl, K.R - K.M).forEach((l, i) => B.txt(l, K.M, B.signTop() - 16 + i * 3.6));
  const sg = j.signatures || {};
  B.signs([{ label: 'Customer · drop-off' + (sg.checkin ? ' - ' + (sg.checkin.name || '') : ''), img: sg.checkin && sg.checkin.data }, { label: `Received by · ${BRAND_TXT}` }, { label: 'Customer · collection & date', img: sg.collection && sg.collection.data }]);
  B.contact();
  // page 2: work & parts
  if ((j.items || []).length) {
    B.newPage();
    let y2 = B.header('JOB CARD · WORK & PARTS', [['Job no.', j.number], ['Date in', fmtDate(j.date)], ['Plate no.', v.plate], ['Page', '2 of 2']], { cols: 2 });
    B.sec('Work & parts', K.M, y2 + 2.4);
    y2 = pdfItems(B, y2 + 6, j.items, { hide: !!extra.hidePrices }) + 4;
    if (!extra.hidePrices) pdfTotals(B, y2, [['ESTIMATE (incl. VAT)', money(calcDoc(j).total), 'grand']]);
    B.contact();
  }
  return pdf;
}

function buildReceiptPDF(p, extra = {}) {
  const B = brandPDF(), { pdf, K } = B, inv = extra.invoice || get('invoices', p.invoiceId) || {}, s = inv.id ? invoiceState(inv) : null, { v, c } = docParties(inv.id ? inv : p);
  let y = B.header('PAYMENT RECEIPT', [['Receipt no.', p.number], ['Date', fmtDate(p.date)], ['Invoice no.', inv.number || '']]);
  const colW = (K.R - K.M - 22 * PX) / 2, x2 = K.M + colW + 22 * PX;
  B.sec('Received from', K.M, y + 2.4); B.sec('Vehicle', x2, y + 2.4);
  const fy = y + 2.4 + 7 * PX + 24 * PX - 1.2;
  [['Name', c.name], ['Mobile', c.phone], ['Email', c.email]].forEach(([k, val], i) => B.field(k, val, K.M, fy + i * 24 * PX, colW));
  [['Make/Model', [v.make, v.model].filter(Boolean).join(' ')], ['Plate no.', [v.plate, v.emirate].filter(Boolean).join(' · ')], ['VIN', v.vin]].forEach(([k, val], i) => B.field(k, val, x2, fy + i * 24 * PX, colW));
  y = fy + 2 * 24 * PX + 8;
  pdf.autoTable({
    startY: y, theme: 'plain', margin: { left: K.M, right: K.W - K.R },
    head: [['#', 'DESCRIPTION', 'AMOUNT']], body: [[1, `Payment against invoice ${inv.number || ''}${p.reference ? '\nReference: ' + p.reference : ''}`, money(p.amount, false)]],
    styles: { font: B.face.reg[0], fontSize: 10.5 * 0.75, textColor: RGB(BRAND.navy), cellPadding: 2.1, minCellHeight: 27 * PX, valign: 'middle' },
    headStyles: { font: B.face.semi[0], fillColor: RGB(BRAND.navy), textColor: 255, fontSize: 9.5 * 0.75 },
    columnStyles: { 0: { cellWidth: 28 * PX, halign: 'center', textColor: RGB(BRAND.steel) }, 2: { cellWidth: 92 * PX, halign: 'right', font: B.face.semi[0] } },
    didParseCell: d => { if (d.section === 'head') { d.cell.styles.halign = d.column.index === 2 ? 'right' : d.column.index === 0 ? 'center' : 'left'; d.cell.styles.textColor = 255; } },
    didDrawCell: d => { if (d.section === 'body') { B.hline(d.cell.x, d.cell.x + d.cell.width, d.cell.y + d.cell.height, BRAND.line); } },
  });
  y = pdf.lastAutoTable.finalY + 14 * PX;
  B.sec('Payment method', K.M, y + 3.6);
  const mth = (p.method || '').toLowerCase(); let cx = K.M;
  [[mth.includes('cash'), 'Cash'], [mth.includes('card'), 'Card'], [/bank|transfer|cheque/.test(mth), 'Bank transfer'], [mth.includes('credit'), 'Credit (fleet)']].forEach(([on, l]) => { cx = B.cbLabel(cx, y + 10.5, on, l); });
  let ly = y + 16;
  if (/stripe|wio|machine|cheque/i.test(p.method || '')) { B.font('reg', 10, BRAND.ink); B.txt('Method: ' + p.method, K.M, ly); ly += 5; }
  B.font('reg', 9.5, BRAND.mute); pdf.splitTextToSize('Amount in words: ' + amountInWords(p.amount), K.R - K.M - 230 * PX - 28 * PX).forEach((l, i) => B.txt(l, K.M, ly + i * 3.8));
  const rows = [['RECEIVED', money(p.amount), 'grand']];
  if (s) rows.push(['Invoice total', money(s.total)], ['Paid to date', money(s.paid)], ['Balance due', money(s.balance), 'bal']);
  pdfTotals(B, y, rows);
  B.signs([{ label: `Received by · ${BRAND_TXT}` }, { label: 'Customer · signature & date' }]);
  B.contact();
  return pdf;
}

/* ---------- Job card: vehicle check-in (fills the printed JOB CARD · VEHICLE CHECK-IN) ---------- */
function checkinCardHTML(j) {
  const ck = j.checkin || {}, locked = false;
  const seg = (path, val, opts) => `<div class="seg">${opts.map(([k, l]) => `<button type="button" class="${val === k ? 'on' : ''}" onclick="ckSet(${jsq(path)}, ${val === k ? 'null' : jsq(k)})">${l}</button>`).join('')}</div>`;
  const done = Object.keys(ck.body || {}).length + Object.keys(ck.items || {}).length;
  return `<div class="card mb"><div class="card-head"><h3>🚗 Vehicle check-in</h3><span class="small muted">${done ? `${done} of ${CHECK_BODY.length + CHECK_ITEMS.length} checked` : 'prints on the job card'}</span></div>
    <div class="card-pad"><div class="grid g4 mb">
      <div class="field"><label>Time in</label><input type="time" value="${esc(ck.timeIn || '')}" onchange="ckSet('timeIn', this.value)"></div>
      <div class="field"><label>Car keys (qty)</label><input type="number" min="0" value="${esc(ck.keys || '')}" onchange="ckSet('keys', this.value)"></div>
      <div class="field span2"><label>Location (mobile / breakdown)</label><input value="${esc(ck.location || '')}" placeholder="${esc(isMobile(j) ? locationText(j.mobile) : 'Workshop')}" onchange="ckSet('location', this.value)"></div>
      <div class="field spanall"><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" style="width:auto" ${ck.breakdown ? 'checked' : ''} onchange="ckSet('breakdown', this.checked)"> Breakdown / recovery</label></div></div>
      <div class="grid g2">
        <div><div class="fieldset-title" style="margin-bottom:6px">Body condition <span class="faint" style="text-transform:none;letter-spacing:0">S = scratch · D = dent · C = crack / chip</span></div>
          ${CHECK_BODY.map(a => `<div class="ck-row"><span>${esc(a)}</span>${seg('body.' + a, (ck.body || {})[a], [['OK', 'OK'], ['S', 'S'], ['D', 'D'], ['C', 'C']])}</div>`).join('')}
          <div class="field mt-s"><label>Damage notes</label><input value="${esc(ck.bodyNotes || '')}" onchange="ckSet('bodyNotes', this.value)" placeholder="e.g. scratch rear left door"></div></div>
        <div><div class="fieldset-title" style="margin-bottom:6px">Items in vehicle</div>
          ${CHECK_ITEMS.map(a => { const x = (ck.items || {})[a]; return `<div class="ck-row"><span>${esc(a)}</span>${seg('items.' + a, x === true ? 'Y' : x === false ? 'N' : null, [['Y', 'Yes'], ['N', 'No']])}</div>`; }).join('')}</div>
      </div></div></div>`;
}
function ckSet(path, val) {
  const j = ED.doc; if (!j) return;
  j.checkin = j.checkin || {};
  const [a, b] = path.split(/\.(.+)/);
  if (b) {
    j.checkin[a] = j.checkin[a] || {};
    let v = val; if (a === 'items' && val != null) v = val === 'Y';
    if (v == null) delete j.checkin[a][b]; else j.checkin[a][b] = v;
    edChanged(); edFlush().then(() => { const el = document.getElementById('ckBox'); if (el) el.innerHTML = checkinCardHTML(j); });
  } else { j.checkin[a] = val; edChanged(); }
}

/* ---------- Blank brand stationery: letterhead + paper job card (Settings → Invoices & numbering) ---------- */
function letterheadHTML() {
  const st = S.settings;
  return bdDoc(`<header class="bd-head" style="min-height:0"><img class="bd-logo" src="img/brand/logo.svg" alt="${BRAND_TXT}">
      <div class="bd-lh-contact">${esc(brandPhones())}<br>${esc(st.email || '')}<br>${esc(st.address || '')}</div></header>
    <div class="bd-rule" style="margin-top:22px"><i></i><i></i></div>
    <div class="bd-lh-ref"><span>Ref:</span><span>Date:</span></div>
    <div class="bd-grow"></div>
    <div class="bd-lh-foot"><span><b class="a">AUTO</b> Workshop ${esc(st.workshopHours || '08:00–20:00')} <b class="m">MOBILE</b> ${st.mob.allDay ? '24/7 breakdown' : esc(st.mob.hoursStart + '–' + st.mob.hoursEnd) + ' · 24/7 emergency (extra charge)'}</span><span>TRN: ${st.trn ? esc(st.trn) : '____________'}</span></div>
    <div class="bd-bar"><i></i><i></i><i></i></div>`, 'letterhead');
}
async function letterheadPDF() {
  await ensurePdfLibs();
  const B = brandPDF(), { pdf, K } = B, st = S.settings, I = window.GP_BRAND_IMG || {};
  if (I.logo) pdf.addImage(I.logo, 'PNG', K.M, 43 * PX, 165 * PX, 165 * PX / 2.885, 'logo', 'FAST');
  B.font('reg', 10.5, BRAND.ink); [brandPhones(), st.email, st.address].filter(Boolean).forEach((l, i) => B.txt(l, K.R, 56 * PX + i * 19 * PX, { align: 'right' }));
  const ry = 158 * PX; B.fill('#eef0f4'); pdf.rect(K.M, ry, K.R - K.M, 4 * PX, 'F'); B.fill(BRAND.gold); pdf.rect(K.M, ry, 55 * PX, 4 * PX, 'F'); B.fill(BRAND.orange); pdf.rect(K.M + 55 * PX, ry, 55 * PX, 4 * PX, 'F');
  B.font('reg', 11, BRAND.mute); B.txt('Ref:', K.M, 202 * PX); B.txt('Date:', K.R, 202 * PX, { align: 'right' });
  const fy = K.H - 7 * PX - 16 * PX - 1; let x = K.M;
  B.font('semi', 9.5, BRAND.goldInk, 0.3); B.txt('AUTO', x, fy); x += pdf.getTextWidth('AUTO') + 2.4; pdf.setCharSpace(0);
  B.font('reg', 9.5, BRAND.mute); const w1 = `Workshop ${st.workshopHours || '08:00–20:00'}`; B.txt(w1, x, fy); x += pdf.getTextWidth(w1) + 6;
  B.font('semi', 9.5, BRAND.orange, 0.3); B.txt('MOBILE', x, fy); x += pdf.getTextWidth('MOBILE') + 3; pdf.setCharSpace(0);
  B.font('reg', 9.5, BRAND.mute); B.txt(st.mob.allDay ? '24/7 breakdown' : `${st.mob.hoursStart}–${st.mob.hoursEnd} · 24/7 emergency (extra charge)`, x, fy);
  B.txt('TRN: ' + (st.trn || '____________'), K.R, fy, { align: 'right' });
  return new File([pdf.output('blob')], 'mendtech_letterhead.pdf', { type: 'application/pdf' });
}
function blankJobCardHTML() { return jobCardHTML({ number: 'JC-', date: '', items: [], line: 'auto', checkin: {} }); }
function brandStationeryHTML() {
  return `<div class="card card-pad mt"><h3 style="margin-top:0">📄 Brand stationery</h3><p class="muted small">Blank ${BRAND_TXT} paper for letters and for check-ins without the app (e.g. on the road).</p>
    <div class="row"><button class="btn" onclick="printHTML(letterheadHTML(), true)">🖨 Letterhead</button>
      <button class="btn" onclick="letterheadPDF().then(f => downloadBlob(f, f.name))">⬇ Letterhead PDF</button>
      <button class="btn" onclick="printHTML(blankJobCardHTML(), true)">🖨 Blank job card (check-in form)</button></div></div>`;
}
