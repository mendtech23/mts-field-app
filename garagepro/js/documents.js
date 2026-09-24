/* GaragePro — printable documents (HTML preview + real PDF via jsPDF) */
'use strict';

const DOC_TITLES = { quote: 'QUOTATION', job: 'JOB CARD', invoice: 'TAX INVOICE', receipt: 'PAYMENT RECEIPT' };
function docTitle(kind) { return kind === 'invoice' && !S.settings.trn ? 'INVOICE' : DOC_TITLES[kind]; }

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

/* ---------- HTML preview ---------- */
function docHTML(kind, doc, extra = {}) {
  const st = S.settings;
  const { v, c } = docParties(doc);
  const head = `<div class="dh">
    <div style="display:flex;gap:14px;align-items:flex-start">${st.logo ? `<img src="${st.logo}" alt="">` : ''}
      <div><div class="gname">${esc(brandFor(doc))}</div>${lineOf(doc) === 'mobile' ? `<div style="color:#c2410c;font-size:11px;font-weight:700;letter-spacing:.05em">MOBILE SERVICE · BY ${esc(st.garageName.toUpperCase())}</div>` : ''}${st.legalName ? `<div style="color:#333;font-size:11.5px">${esc(st.legalName)}</div>` : ''}<div style="color:#555;line-height:1.5">${esc(st.tagline || '')}${st.tagline ? '<br>' : ''}${esc(st.address)}<br>${esc(contactLine())}<br>${esc([st.email, st.website].filter(Boolean).join(' · '))}${st.trn ? `<br><b>TRN: ${esc(st.trn)}</b>` : ''}</div></div></div>
    <div><div class="dtitle">${docTitle(kind)}</div><div class="meta">${docMetaRows(kind, doc).map(([k, val]) => `<b>${esc(k)}:</b> ${esc(val)}`).join('<br>')}</div></div></div>`;

  if (kind === 'receipt') {
    const inv = extra.invoice, bal = inv ? invoiceState(inv).balance : 0;
    return `<div class="docv">${head}
      <div class="boxes"><div class="box"><div class="bt">Received from</div><b>${esc(c.name || '')}</b><br>${esc(c.phone || '')}</div>
      <div class="box"><div class="bt">Vehicle</div>${esc(v.plate || '')} ${esc(vehicleLabel(v))}</div></div>
      <table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody>
      <tr><td>Payment against ${esc(inv ? inv.number : '')} — ${esc(doc.method || '')}${doc.reference ? ' (Ref: ' + esc(doc.reference) + ')' : ''}</td><td class="n"><b>${money(doc.amount)}</b></td></tr></tbody></table>
      <div class="dtot"><div><span>Invoice total</span><span>${inv ? money(invoiceState(inv).total) : ''}</span></div><div><span>Total paid to date</span><span>${inv ? money(invoiceState(inv).paid) : ''}</span></div><div class="g"><span>Balance remaining</span><span>${money(bal)}</span></div></div>
      <div class="sign"><div>Received by</div><div>Customer</div></div></div>`;
  }

  const t = calcDoc(doc);
  const vatOn = num(t.vatRate) > 0;
  const hidePrices = kind === 'job' && extra.hidePrices;
  let rows = '', n = 0;
  for (const g of groupItems(doc.items)) {
    rows += `<tr class="sec"><td colspan="${hidePrices ? 3 : 5}">${g.title}</td></tr>`;
    for (const it of g.items) {
      n++;
      rows += `<tr><td>${n}</td><td>${esc(it.desc)}${it.partNo ? `<div style="color:#777;font-size:11px">${esc(it.partNo)}</div>` : ''}</td><td class="n">${fmtNum(it.qty)}${it.type === 'labour' ? ' h' : ''}</td>${hidePrices ? '' : `<td class="n">${money(it.rate, false)}</td><td class="n">${money(lineTotal(it), false)}</td>`}</tr>`;
    }
  }
  if (!n) rows = `<tr><td colspan="5" style="text-align:center;color:#888;padding:18px">No items</td></tr>`;

  let tot = '';
  if (!hidePrices) {
    tot = `<div class="dtot"><div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      ${t.discount ? `<div><span>Discount${doc.discountType !== 'amt' ? ` (${num(doc.discount)}%)` : ''}</span><span>− ${money(t.discount)}</span></div><div><span>Net amount</span><span>${money(t.net)}</span></div>` : ''}
      ${vatOn ? `<div><span>VAT ${num(t.vatRate)}%</span><span>${money(t.vat)}</span></div>` : ''}
      <div class="g"><span>TOTAL ${esc(st.currency)}</span><span>${money(t.total, false)}</span></div>`;
    if (kind === 'invoice') {
      const s = invoiceState(doc);
      tot += `<div><span>Paid</span><span>${money(s.paid)}</span></div><div style="font-weight:800"><span>Balance due</span><span>${money(s.balance)}</span></div>`;
    }
    tot += '</div>';
  }
  const paidStamp = kind === 'invoice' && invoiceState(doc).status === 'Paid' ? '<div style="margin-top:-40px"><span class="stamp">PAID</span></div>' : '';

  let jobBlock = '';
  if (kind === 'job' || (kind === 'quote' && doc.description) || (kind === 'invoice' && doc.workDone)) {
    const parts = [];
    if (kind === 'job') {
      if (doc.complaint) parts.push(['Customer complaint / request', doc.complaint]);
      if (doc.diagnosis) parts.push(['Diagnosis / work done', doc.diagnosis]);
      const fl = inspectionFlags(doc);
      if (fl.length) parts.push(['Inspection advisories', fl.map(p => `${p.result === 'Replace' ? '✖' : '!'} ${p.point}${p.note ? ' — ' + p.note : ''}`).join('\n')]);
    } else if (kind === 'quote') parts.push(['Work description', doc.description]);
    else parts.push(['Work carried out', doc.workDone]);
    jobBlock = parts.map(([h, b]) => `<div class="box" style="margin-bottom:10px"><div class="bt">${esc(h)}</div><div style="white-space:pre-wrap">${esc(b)}</div></div>`).join('');
  }

  const terms = kind === 'quote' ? st.quoteTerms : kind === 'invoice' ? st.invoiceTerms : '';
  const hasPayInfo = hasPaymentDetails(doc);
  const foot = [doc.notes ? 'Notes: ' + doc.notes : '', terms].filter(Boolean).join('\n\n');
  let payBox = '';
  if (kind === 'invoice' && hasPayInfo && !doc.void) {   // always shown on invoices once your payment details are set
    const link = payLinkFor(doc), bal = invoiceState(doc).balance, pasted = pastedBankDetails();
    payBox = `<div class="box" style="margin-top:16px;display:flex;gap:14px;align-items:center;break-inside:avoid">
      ${link && bal > 0 ? `<div style="flex:none">${qrSVG(link, 96)}</div>` : ''}
      <div style="line-height:1.6"><div class="bt">${bal > 0 ? `How to pay — balance ${money(bal)}` : 'Payment details'}</div>
        ${link ? `<b>Card / Apple Pay / Google Pay (Stripe):</b> ${bal > 0 ? 'scan the QR or open ' : ''}<span style="word-break:break-all">${esc(link)}</span><br>` : ''}
        ${st.wioIban ? `<b>Bank transfer (WIO):</b> ${esc(st.wioName || st.legalName || st.garageName)} · ${esc(st.wioBank || 'Wio Bank')} · IBAN ${esc(st.wioIban)} · Ref ${esc(doc.number)}<br>` : ''}
        ${pasted && !(st.wioIban && pasted.replace(/\s/g, '').includes(st.wioIban.replace(/\s/g, ''))) ? `<b>Bank transfer:</b><span style="white-space:pre-wrap"> ${esc(pasted)}</span> · Ref ${esc(doc.number)}<br>` : ''}
        ${st.wioLink ? `<b>WIO pay link:</b> <span style="word-break:break-all">${esc(st.wioLink)}</span><br>` : ''}
        ${st.whatsapp ? `<span style="color:#555">Questions? WhatsApp ${esc(st.whatsapp)}</span>` : ''}</div></div>`;
  }

  return `<div class="docv">${head}
    <div class="boxes">
      <div class="box"><div class="bt">${kind === 'quote' ? 'Prepared for' : kind === 'job' ? 'Customer' : 'Bill to'}</div><b>${esc(c.name || '—')}</b><br>${esc(c.phone || '')}${c.email ? '<br>' + esc(c.email) : ''}${c.address ? '<br>' + esc(c.address) : ''}${c.trn ? '<br>TRN: ' + esc(c.trn) : ''}</div>
      <div class="box"><div class="bt">Vehicle</div><b style="font-size:14px">${esc(v.plate || '—')}</b> ${esc(v.emirate || '')}<br>${esc(vehicleLabel(v))}${v.color ? ' · ' + esc(v.color) : ''}<br>VIN: ${esc(v.vin || '—')}<br>Odometer: ${doc.odometer ? fmtNum(doc.odometer) + ' km' : '—'}</div>
    </div>
    ${jobBlock}
    <table><thead><tr><th style="width:30px">#</th><th>Description</th><th class="n">Qty</th>${hidePrices ? '' : '<th class="n">Rate</th><th class="n">Amount</th>'}</tr></thead><tbody>${rows}</tbody></table>
    ${tot}${paidStamp}${payBox}
    ${foot ? `<div class="foot">${esc(foot)}</div>` : ''}
    ${kind === 'invoice' && !hidePrices ? `<div style="margin-top:8px;font-size:11.5px"><b>Amount in words:</b> ${esc(amountInWords(t.total))}</div>` : ''}
    ${kind === 'job' ? jobSignHTML(doc) : kind === 'quote' ? '<div class="sign"><div>Customer approval (sign &amp; date)</div><div>For ' + esc(st.garageName) + '</div></div>' : ''}
  </div>`;
}

function jobSignHTML(doc) {
  const sg = doc.signatures || {};
  const slot = (k, label) => `<div>${sg[k] ? `<img src="${sg[k].data}" style="height:60px;max-width:100%;object-fit:contain;display:block">` : '<div style="height:60px"></div>'}
    <div style="border-top:1px solid #999;padding-top:5px">${label}${sg[k] ? ` — ${esc(sg[k].name || '')}, ${new Date(sg[k].at).toLocaleString('en-GB')}` : ''}</div></div>`;
  return `<div class="sign" style="margin-top:24px">${slot('checkin', 'Customer — I authorise the above work')}${slot('collection', 'Customer — vehicle collected in good order')}</div>`;
}
function printDoc(kind, doc, extra) {
  $('#printRoot').innerHTML = docHTML(kind, doc, extra);
  setTimeout(() => { window.print(); }, 50);
}
function previewDoc(kind, doc, extra = {}) {
  const m = openModal({
    title: `${docTitle(kind)} ${esc(doc.number || '')}`, size: 'xwide',
    body: `<div style="background:#e5e7eb;padding:16px;border-radius:8px">${docHTML(kind, doc, extra)}</div>`,
    foot: `<button class="btn" data-print>🖨 Print</button><button class="btn" data-pdf>⬇ Download PDF</button><button class="btn wa" data-send>Send via WhatsApp / Email</button>`
  });
  m.el.querySelector('[data-print]').onclick = () => printDoc(kind, doc, extra);
  m.el.querySelector('[data-pdf]').onclick = async () => { const f = await pdfFile(kind, doc, extra); if (f) downloadBlob(f, f.name); };
  m.el.querySelector('[data-send]').onclick = () => { m.close(); openSendDialog(kind, doc, extra); };
}

/* ---------- Real PDF (jsPDF + AutoTable from CDN) ---------- */
const PDF_LIBS = ['lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js'];   // bundled — works offline
async function ensurePdfLibs() { for (const s of PDF_LIBS) await loadScript(s); }
function pdfName(kind, doc) {
  const v = vehicleOf(doc);
  return `${docTitle(kind).replace(/\s+/g, '_')}_${doc.number || ''}${v ? '_' + norm(v.plate) : ''}.pdf`;
}

async function pdfFile(kind, doc, extra = {}) {
  try { await ensurePdfLibs(); }
  catch (e) { toast('PDF engine could not load (lib folder missing?). Use Print → "Save as PDF" instead.', 'err'); return null; }
  const pdf = buildPDF(kind, doc, extra);
  const blob = pdf.output('blob');
  return new File([blob], pdfName(kind, doc), { type: 'application/pdf' });
}

function buildPDF(kind, doc, extra = {}) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  // Standard PDF fonts only cover Latin-1: map typographic characters to safe ones
  const safe = s => String(s ?? '').replace(/[‒-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, '-').replace(/[^\x00-\xFF]/g, '');
  const _text = pdf.text.bind(pdf);
  pdf.text = (t, ...a) => _text(Array.isArray(t) ? t.map(safe) : safe(t), ...a);
  const _split = pdf.splitTextToSize.bind(pdf);
  pdf.splitTextToSize = (t, w, o) => _split(safe(t), w, o);
  const _auto = pdf.autoTable.bind(pdf);
  pdf.autoTable = opts => _auto({ ...opts, didParseCell: d => { d.cell.text = d.cell.text.map(safe); if (opts.didParseCell) opts.didParseCell(d); } });
  const st = S.settings, W = 210, M = 14;
  const { v, c } = docParties(doc);
  const ACC = [234, 88, 12], INK = [17, 24, 39], GREY = [100, 100, 100];
  let x = M, y = 14;

  // Header
  if (st.logo) {
    try {
      const p = pdf.getImageProperties(st.logo);
      const h = 20, w = Math.min(45, p.width * h / p.height);
      pdf.addImage(st.logo, x, y, w, w * p.height / p.width); x += w + 5;
    } catch (e) { }
  }
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(...INK);
  pdf.text(brandFor(doc) || '', x, y + 5);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...GREY);
  const hl = [lineOf(doc) === 'mobile' ? 'Mobile service by ' + st.garageName : '', st.legalName, st.tagline, st.address, contactLine(), [st.email, st.website].filter(Boolean).join(' · ')].filter(Boolean);
  hl.forEach((l, i) => pdf.text(String(l), x, y + 10 + i * 4));
  let hy = y + 10 + hl.length * 4;
  if (st.trn) { pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...INK); pdf.text('TRN: ' + st.trn, x, hy); hy += 4; }

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(...ACC);
  pdf.text(docTitle(kind), W - M, y + 6, { align: 'right' });
  pdf.setFontSize(9); pdf.setTextColor(...INK);
  let my = y + 12;
  for (const [k, val] of docMetaRows(kind, doc)) {
    pdf.setFont('helvetica', 'bold'); pdf.text(k + ':', W - M - 38, my, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.text(String(val ?? ''), W - M, my, { align: 'right' }); my += 4.5;
  }
  y = Math.max(hy, my, y + 22) + 2;
  pdf.setDrawColor(...ACC); pdf.setLineWidth(0.8); pdf.line(M, y, W - M, y); y += 5;

  // Parties boxes
  const bw = (W - 2 * M - 6) / 2;
  const box = (bx, title, lines) => {
    pdf.setFontSize(7.5); pdf.setTextColor(...GREY); pdf.setFont('helvetica', 'bold'); pdf.text(title.toUpperCase(), bx + 3, y + 4.5);
    pdf.setTextColor(...INK); pdf.setFontSize(9.5);
    let ly = y + 9.5;
    lines.filter(Boolean).forEach((l, i) => { pdf.setFont('helvetica', i === 0 ? 'bold' : 'normal'); pdf.text(pdf.splitTextToSize(String(l), bw - 6)[0], bx + 3, ly); ly += 4.3; });
    return ly;
  };
  const partyTitle = kind === 'quote' ? 'Prepared for' : kind === 'invoice' ? 'Bill to' : kind === 'receipt' ? 'Received from' : 'Customer';
  const e1 = box(M, partyTitle, [c.name || '—', c.phone, c.email, c.address, c.trn ? 'TRN: ' + c.trn : '']);
  const e2 = box(M + bw + 6, 'Vehicle', [`${v.plate || '—'} ${v.emirate || ''}`, vehicleLabel(v) + (v.color ? ' · ' + v.color : ''), 'VIN: ' + (v.vin || '—'), 'Odometer: ' + (doc.odometer ? fmtNum(doc.odometer) + ' km' : '—')]);
  const bh = Math.max(e1, e2) - y;
  pdf.setDrawColor(210); pdf.setLineWidth(0.3);
  pdf.roundedRect(M, y, bw, bh, 1.5, 1.5); pdf.roundedRect(M + bw + 6, y, bw, bh, 1.5, 1.5);
  y += bh + 5;

  const textBlock = (title, body) => {
    if (!body) return;
    const lines = pdf.splitTextToSize(String(body), W - 2 * M - 6);
    const h = 8 + lines.length * 4.2;
    if (y + h > 280) { pdf.addPage(); y = 16; }
    pdf.setDrawColor(210); pdf.roundedRect(M, y, W - 2 * M, h, 1.5, 1.5);
    pdf.setFontSize(7.5); pdf.setTextColor(...GREY); pdf.setFont('helvetica', 'bold'); pdf.text(title.toUpperCase(), M + 3, y + 4.5);
    pdf.setFontSize(9.5); pdf.setTextColor(...INK); pdf.setFont('helvetica', 'normal'); pdf.text(lines, M + 3, y + 9.3);
    y += h + 4;
  };

  const tableStyles = {
    theme: 'plain', margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 2, textColor: INK, lineColor: [225, 225, 225], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
  };

  if (kind === 'receipt') {
    const inv = extra.invoice, s = inv ? invoiceState(inv) : null;
    pdf.autoTable({
      ...tableStyles, startY: y, head: [['Description', 'Amount']],
      body: [[`Payment against ${inv ? inv.number : ''} — ${doc.method || ''}${doc.reference ? ' (Ref: ' + doc.reference + ')' : ''}`, money(doc.amount)]],
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });
    y = pdf.lastAutoTable.finalY + 6;
    if (s) {
      [['Invoice total', money(s.total)], ['Total paid to date', money(s.paid)], ['Balance remaining', money(s.balance)]].forEach(([k, val], i) => {
        pdf.setFont('helvetica', i === 2 ? 'bold' : 'normal'); pdf.setFontSize(i === 2 ? 11 : 9.5);
        pdf.text(k, W - M - 70, y); pdf.text(val, W - M, y, { align: 'right' }); y += 6;
      });
    }
  } else {
    if (kind === 'job') {
      textBlock('Customer complaint / request', doc.complaint);
      textBlock('Diagnosis / work done', doc.diagnosis);
      const fl = inspectionFlags(doc);
      if (fl.length) textBlock('Inspection advisories', fl.map(p => `${p.result === 'Replace' ? '[REPLACE]' : '[ATTENTION]'} ${p.point}${p.note ? ' - ' + p.note : ''}`).join('\n'));
    } else if (kind === 'quote') textBlock('Work description', doc.description);
    else if (kind === 'invoice') textBlock('Work carried out', doc.workDone);

    const hide = kind === 'job' && extra.hidePrices;
    const body = []; let n = 0;
    for (const g of groupItems(doc.items)) {
      body.push([{ content: g.title.toUpperCase(), colSpan: hide ? 3 : 5, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', fontSize: 8 } }]);
      for (const it of g.items) {
        n++;
        const desc = it.desc + (it.partNo ? '\n' + it.partNo : '');
        const row = [n, desc, fmtNum(it.qty) + (it.type === 'labour' ? ' h' : '')];
        if (!hide) row.push(money(it.rate, false), money(lineTotal(it), false));
        body.push(row);
      }
    }
    if (!n) body.push([{ content: 'No items', colSpan: hide ? 3 : 5, styles: { halign: 'center', textColor: 150 } }]);
    pdf.autoTable({
      ...tableStyles, startY: y,
      head: [hide ? ['#', 'Description', 'Qty'] : ['#', 'Description', 'Qty', 'Rate', 'Amount']],
      body,
      columnStyles: { 0: { cellWidth: 9 }, 2: { halign: 'right', cellWidth: 18 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 28 } },
      didParseCell: d => { if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right'; },
    });
    y = pdf.lastAutoTable.finalY + 5;

    if (!hide) {
      const t = calcDoc(doc);
      const rows = [['Subtotal', money(t.subtotal)]];
      if (t.discount) { rows.push([`Discount${doc.discountType !== 'amt' ? ` (${num(doc.discount)}%)` : ''}`, '- ' + money(t.discount)]); rows.push(['Net amount', money(t.net)]); }
      if (num(t.vatRate) > 0) rows.push([`VAT ${num(t.vatRate)}%`, money(t.vat)]);
      if (y + rows.length * 5.5 + 20 > 285) { pdf.addPage(); y = 16; }
      pdf.setFontSize(9.5); pdf.setTextColor(...INK);
      for (const [k, val] of rows) { pdf.setFont('helvetica', 'normal'); pdf.text(k, W - M - 70, y); pdf.text(val, W - M, y, { align: 'right' }); y += 5.5; }
      pdf.setDrawColor(...INK); pdf.setLineWidth(0.6); pdf.line(W - M - 72, y - 3, W - M, y - 3); y += 2.5;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5);
      pdf.text('TOTAL', W - M - 70, y); pdf.text(money(t.total), W - M, y, { align: 'right' }); y += 7;
      if (kind === 'invoice') {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8.5);
        const w = pdf.splitTextToSize('Amount in words: ' + amountInWords(t.total), 100);
        pdf.text(w, M, y - 7); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5);
      }
      if (kind === 'invoice') {
        const s = invoiceState(doc);
        pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal');
        pdf.text('Paid', W - M - 70, y); pdf.text(money(s.paid), W - M, y, { align: 'right' }); y += 5.5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Balance due', W - M - 70, y); pdf.text(money(s.balance), W - M, y, { align: 'right' }); y += 6;
        if (s.status === 'Paid') {
          pdf.setTextColor(22, 163, 74); pdf.setDrawColor(22, 163, 74); pdf.setLineWidth(1);
          pdf.roundedRect(M + 2, y - 22, 34, 12, 2, 2); pdf.setFontSize(18); pdf.text('PAID', M + 19, y - 13.5, { align: 'center' }); pdf.setTextColor(...INK);
        }
      }
    }
    y += 3;
    const terms = kind === 'quote' ? st.quoteTerms : kind === 'invoice' ? st.invoiceTerms : '';
    const hasPayInfo = hasPaymentDetails(doc);
    if (kind === 'invoice' && hasPayInfo && !doc.void) {   // always on invoices once payment details are set
      const bal = invoiceState(doc).balance, link = payLinkFor(doc), qm = link && bal > 0 ? qrMatrix(link) : null, pasted = pastedBankDetails();
      const lines = [];
      if (link) lines.push(`Card / Apple Pay / Google Pay (Stripe):${bal > 0 ? ' scan the QR or open' : ''}`, link);
      if (st.wioIban) lines.push(`Bank transfer (WIO): ${st.wioName || st.legalName || st.garageName} - ${st.wioBank || 'Wio Bank'}`, `IBAN ${st.wioIban} - Ref ${doc.number}`);
      if (pasted && !(st.wioIban && pasted.replace(/\s/g, '').includes(st.wioIban.replace(/\s/g, '')))) lines.push('Bank transfer:', ...pasted.split('\n'), `Reference: ${doc.number}`);
      if (st.wioLink) lines.push('WIO pay link: ' + st.wioLink);
      if (st.whatsapp) lines.push('Questions? WhatsApp ' + st.whatsapp);
      const qs = qm ? 26 : 0, tx = M + 3 + (qm ? qs + 4 : 0);
      const wrapped = lines.flatMap(l => pdf.splitTextToSize(l, W - M - tx - 3));
      const bh = Math.max(qs + 6, 9 + wrapped.length * 4);
      if (y + bh > 282) { pdf.addPage(); y = 16; }
      pdf.setDrawColor(210); pdf.setLineWidth(0.3); pdf.roundedRect(M, y, W - 2 * M, bh, 1.5, 1.5);
      if (qm) { const n = qm.length, cell = qs / n; pdf.setFillColor(0, 0, 0); qm.forEach((row, r) => row.forEach((d, c) => { if (d) pdf.rect(M + 3 + c * cell, y + 3 + r * cell, cell, cell, 'F'); })); }
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...GREY);
      pdf.text(bal > 0 ? `HOW TO PAY - BALANCE ${money(bal)}` : 'PAYMENT DETAILS', tx, y + 5);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...INK);
      pdf.text(wrapped, tx, y + 9.5);
      y += bh + 5;
    }
    const foot = [doc.notes ? 'Notes: ' + doc.notes : '', terms].filter(Boolean).join('\n\n');
    if (foot) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(70);
      const lines = pdf.splitTextToSize(foot, W - 2 * M);
      if (y + lines.length * 3.8 > 285) { pdf.addPage(); y = 16; }
      pdf.text(lines, M, y); y += lines.length * 3.8 + 4;
    }
    if (kind === 'job' || kind === 'quote') {
      if (y + 22 > 287) { pdf.addPage(); y = 20; }
      y += 14; pdf.setDrawColor(150); pdf.setLineWidth(0.3);
      const sg = (kind === 'job' && doc.signatures) || {};
      const sigImg = (s, x) => { if (!s) return; try { pdf.addImage(s.data, 'PNG', x, y - 13, 60, 13); } catch (e) { } };
      sigImg(sg.checkin, M); sigImg(sg.collection, W - M - 75);
      pdf.line(M, y, M + 75, y); pdf.line(W - M - 75, y, W - M, y);
      pdf.setFontSize(8); pdf.setTextColor(90);
      pdf.text(kind === 'job' ? 'Customer - I authorise the above work' + (sg.checkin ? ` (${sg.checkin.name || ''})` : '') : 'Customer approval (sign & date)', M, y + 4);
      pdf.text(kind === 'job' ? 'Vehicle collected in good order' + (sg.collection ? ` (${sg.collection.name || ''})` : '') : 'For ' + st.garageName, W - M - 75, y + 4);
    }
  }
  // Footer on each page
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setFontSize(7.5); pdf.setTextColor(150); pdf.setFont('helvetica', 'normal');
    pdf.text(`${brandFor(doc)} · ${contactLine()}`, M, 291);
    pdf.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' });
  }
  return pdf;
}
