/* GaragePro — sending documents & messages via WhatsApp / Email / native share */
'use strict';

function docMessageCtx(kind, doc, extra = {}) {
  const { v, c } = docParties(doc);
  const ctx = { ...baseCtx(v, c), number: doc.number, status: isMobile(doc) ? (doc.mobile || {}).status || '' : doc.status || '', garage: brandFor(doc), brand: brandFor(doc) };
  if (kind === 'receipt') {
    const inv = extra.invoice;
    Object.assign(ctx, { amount: money(doc.amount), method: doc.method || '', receipt: doc.number, number: inv ? inv.number : '', balance: inv ? money(invoiceState(inv).balance) : '' });
  } else {
    const t = calcDoc(doc);
    Object.assign(ctx, { amount: money(t.total), items: itemsSummary(doc.items), validUntil: fmtDate(doc.validUntil) });
    if (kind === 'quote') ctx.approveLine = approveLineFor(doc);
    if (kind === 'invoice') { const s = invoiceState(doc); ctx.paid = money(s.paid); ctx.balance = money(s.balance); ctx.payInfo = s.balance > 0 ? payInfoText(doc, money(s.balance)) : ''; ctx.payLink = payLinkFor(doc); }
    if (kind === 'job') { const jt = jobTotals(doc); ctx.balance = money(jt.status === 'Not invoiced' ? jt.total : jt.balance); }
  }
  return ctx;
}
/* tap-to-approve: a private link for this quotation (Security Level 2 cloud needed) */
const quoteLinksOn = () => typeof Cloud !== 'undefined' && Cloud.level2 && !!Sync.user && /^https?:$/.test(location.protocol) && !(IS_PREVIEW && !CFG.previewCloud);
function quoteLink(q) {
  if (!q.shareToken) { const b = crypto.getRandomValues(new Uint8Array(24)); q.shareToken = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); save('quotes', q); }
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'approve.html#' + q.shareToken;
}
function approveLineFor(q) {
  if (!quoteLinksOn() || ['Approved', 'Declined', 'Converted'].includes(q.status)) return 'Reply YES to approve and we will start the work.';
  return `Tap here to approve or decline:\n${quoteLink(q)}\n\nOr simply reply YES to approve.`;
}
function docTemplateKey(kind, doc) {
  if (kind === 'job') return doc.status === 'Ready' ? 'ready' : 'jobUpdate';
  return kind;
}

async function logMessage({ vehicleId, customerId, channel, type, text, docId, number }) {
  await save('messages', { date: new Date().toISOString(), vehicleId, customerId, channel, type, text, docId, number });
}

function waLink(phone, text) { return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`; }
function mailLink(email, subject, body) { return `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
const canShareFiles = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } };

/* Main send dialog for quotes / invoices / job cards / receipts */
function openSendDialog(kind, doc, extra = {}) {
  const { v, c } = docParties(doc);
  const st = S.settings;
  const text = fillTemplate(st.templates[docTemplateKey(kind, doc)], docMessageCtx(kind, doc, extra));
  const subject = `${docTitle(kind, doc)} ${doc.number} — ${v.plate || ''} ${vehicleLabel(v)}${doc.plain ? '' : ' — ' + brandFor(doc)}`;
  const hasShare = canShareFiles();
  const m = openModal({
    title: `Send ${docTitle(kind).toLowerCase()} ${esc(doc.number)}`, size: 'wide',
    body: `<div class="grid g2">
      <div class="field"><label>WhatsApp / mobile number</label><input id="sd_phone" value="${esc(c.whatsapp || c.phone || '')}" placeholder="050 123 4567"><div class="help">Local numbers get +${esc(st.countryCode)} added automatically.</div></div>
      <div class="field"><label>Email</label><input id="sd_email" type="email" value="${esc(c.email || '')}" placeholder="customer@email.com"></div>
      <div class="field spanall"><label>Message (you can edit before sending)</label><textarea id="sd_text" style="min-height:230px;font-family:inherit">${esc(text)}</textarea></div>
      <div class="field spanall"><label style="display:flex;gap:8px;align-items:center;color:var(--ink);font-size:13.5px"><input type="checkbox" id="sd_pdf" checked> Also save the PDF so I can attach it (${esc(pdfName(kind, doc))})</label>
      <div class="help">WhatsApp and email links can't attach files automatically — the PDF downloads so you can drag it into the chat/email.${hasShare ? ' Or use <b>Share PDF</b> to send the file directly through Windows/phone sharing.' : ''}</div></div>
    </div>`,
    foot: `<button class="btn left" data-copy>Copy text</button>
      ${kind === 'invoice' && payLinkFor(doc) ? '<button class="btn" data-qr>Show pay QR</button>' : ''}
      <button class="btn" data-sms>SMS</button>
      ${hasShare ? '<button class="btn dark" data-share>📤 Share PDF…</button>' : ''}
      <button class="btn blue" data-mail>✉ Email</button>
      <button class="btn wa" data-wa>WhatsApp</button>`
  });
  const val = id => m.el.querySelector(id).value;
  const afterSend = async channel => {
    await logMessage({ vehicleId: doc.vehicleId, customerId: doc.customerId, channel, type: kind, text: val('#sd_text'), docId: doc.id, number: doc.number });
    if (kind === 'quote' && (doc.status || 'Draft') === 'Draft') { doc.status = 'Sent'; doc.sentAt = new Date().toISOString(); await save('quotes', doc); }
    if (kind === 'invoice' && !doc.sentAt) { doc.sentAt = new Date().toISOString(); await save('invoices', doc); }
    toast('Logged in vehicle history', 'ok');
    m.close(); render();
  };
  const maybePdf = async () => { if (m.el.querySelector('#sd_pdf').checked) { const f = await pdfFile(kind, doc, extra); if (f) downloadBlob(f, f.name); } };
  m.el.querySelector('[data-copy]').onclick = async () => { await navigator.clipboard.writeText(val('#sd_text')); toast('Message copied'); };
  m.el.querySelector('[data-sms]').onclick = () => {
    const ph = val('#sd_phone'); if (!ph) return toast('Enter a mobile number', 'err');
    window.location.href = `sms:+${waNumber(ph)}?body=${encodeURIComponent(val('#sd_text'))}`;
    afterSend('SMS');
  };
  const qrBtn = m.el.querySelector('[data-qr]'); if (qrBtn) qrBtn.onclick = () => showPayQR(doc);
  m.el.querySelector('[data-wa]').onclick = async () => {
    const ph = val('#sd_phone'); if (!ph) return toast('Enter a WhatsApp number', 'err');
    await maybePdf();
    window.open(waLink(ph, val('#sd_text')), '_blank');
    afterSend('WhatsApp');
  };
  m.el.querySelector('[data-mail]').onclick = async () => {
    const em = val('#sd_email'); if (!em) return toast('Enter an email address', 'err');
    await maybePdf();
    window.location.href = mailLink(em, subject, val('#sd_text'));
    afterSend('Email');
  };
  if (hasShare) m.el.querySelector('[data-share]').onclick = async () => {
    const f = await pdfFile(kind, doc, extra); if (!f) return;
    try { await navigator.share({ files: [f], title: subject, text: val('#sd_text') }); afterSend('Shared PDF'); }
    catch (e) { if (e.name !== 'AbortError') toast('Sharing failed: ' + e.message, 'err'); }
  };
}

/* Simple message dialog for reminders / quick notes to a customer */
function openMessageDialog({ vehicle, customer, type = 'custom', text = '', subject = '' }) {
  const c = customer || customerOf(vehicle) || {};
  const m = openModal({
    title: `Message ${esc(c.name || 'customer')}`, size: 'wide',
    body: `<div class="grid g2">
      <div class="field"><label>WhatsApp / mobile</label><input id="md_phone" value="${esc(c.whatsapp || c.phone || '')}"></div>
      <div class="field"><label>Email</label><input id="md_email" value="${esc(c.email || '')}"></div>
      <div class="field spanall"><label>Template</label><select id="md_tpl"><option value="">— keep current text —</option>${Object.keys(S.settings.templates).map(k => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(TEMPLATE_LABELS[k] || k)}</option>`).join('')}</select></div>
      <div class="field spanall"><label>Message</label><textarea id="md_text" style="min-height:200px">${esc(text)}</textarea></div></div>`,
    foot: `<button class="btn left" data-copy>Copy</button><button class="btn" data-sms>SMS</button><button class="btn blue" data-mail>✉ Email</button><button class="btn wa" data-wa>WhatsApp</button>`
  });
  const val = id => m.el.querySelector(id).value;
  m.el.querySelector('#md_tpl').onchange = e => {
    const k = e.target.value; if (!k) return;
    m.el.querySelector('#md_text').value = fillTemplate(S.settings.templates[k], { ...baseCtx(vehicle, c), date: '', item: '' });
  };
  const done = async channel => { await logMessage({ vehicleId: vehicle && vehicle.id, customerId: c.id, channel, type, text: val('#md_text') }); toast('Logged in history', 'ok'); m.close(); render(); };
  m.el.querySelector('[data-copy]').onclick = async () => { await navigator.clipboard.writeText(val('#md_text')); toast('Copied'); };
  m.el.querySelector('[data-wa]').onclick = () => { if (!val('#md_phone')) return toast('Enter a number', 'err'); window.open(waLink(val('#md_phone'), val('#md_text')), '_blank'); done('WhatsApp'); };
  m.el.querySelector('[data-sms]').onclick = () => { window.location.href = `sms:${'+' + waNumber(val('#md_phone'))}?body=${encodeURIComponent(val('#md_text'))}`; done('SMS'); };
  m.el.querySelector('[data-mail]').onclick = () => { if (!val('#md_email')) return toast('Enter an email', 'err'); window.location.href = mailLink(val('#md_email'), subject || S.settings.garageName, val('#md_text')); done('Email'); };
}

/* ---------- QR codes for payment links ---------- */
function qrSVG(text, px = 180) {
  if (typeof qrcode !== 'function' || !text) return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let rects = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) rects += `M${c + 2} ${r + 2}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 4} ${n + 4}" width="${px}" height="${px}" style="background:#fff;display:block" role="img" aria-label="Payment QR code"><path d="${rects}" fill="#000"/></svg>`;
}
function qrMatrix(text) {
  if (typeof qrcode !== 'function' || !text) return null;
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = [];
  for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
  return m;
}
function showPayQR(inv) {
  const link = payLinkFor(inv), st = S.settings;
  if (!link) { toast('Add your Stripe payment link in Settings → Payments first', 'err'); return; }
  const bal = inv ? invoiceState(inv).balance : 0;
  openModal({
    title: 'Scan to pay', size: 'narrow',
    body: `<div class="center"><div style="display:inline-block;padding:12px;background:#fff;border-radius:12px;border:1px solid var(--line)">${qrSVG(link, 230)}</div>
      ${inv ? `<div style="font-size:26px;font-weight:800;margin-top:10px">${money(bal)}</div><div class="muted">Invoice ${esc(inv.number)} — type this amount on the payment page</div>` : ''}
      <div class="small muted mt-s">Card · Apple Pay · Google Pay (Stripe)</div>
      ${st.wioIban ? `<hr class="sep"><div class="small">Bank transfer: <b>${esc(st.wioName || st.legalName || st.garageName)}</b><br>${esc(st.wioBank || 'Wio Bank')} · IBAN <span class="mono">${esc(st.wioIban)}</span></div>` : ''}</div>`,
  });
}

const TEMPLATE_LABELS = {
  followUp: 'Follow-up — recommended work not done', review: 'Google review request',
  quote: 'Quotation', invoice: 'Invoice', receipt: 'Payment receipt', ready: 'Vehicle ready for collection', jobUpdate: 'Job status update',
  serviceDue: 'Service due reminder', regExpiry: 'Registration expiring', insExpiry: 'Insurance expiring', payment: 'Payment reminder',
  inspection: 'Inspection results', thanks: 'Thank you / feedback',
};
