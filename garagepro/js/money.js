/* mendtech. — money control (v3.8)
   · Cash & bank: a balance for each place money sits (cash in hand, bank, card machine), bank deposits and other moves,
     the daily cash-up with a petty-cash float, and the owner's day report.
   · Supplier bills: pay a bill or a supplier (oldest first), post-dated cheques, credit limits, bill photos, statements.
   · Customer credit accounts: payment terms + credit limit per customer, customer statements.
   · Fixed costs: rent, salaries, licence… what is due, paid, still to pay, saved for yearly costs, safe to spend, break-even.
   · Payments calendar: what goes out and comes in over the next weeks. */
'use strict';

/* ============ accounts ============ */
const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Cash in hand', methods: ['Cash'] },
  { id: 'bank', name: 'Bank (WIO)', methods: ['Bank transfer – WIO', 'Cheque', 'Card – Stripe'] },
  { id: 'card', name: 'Card machine (not yet in bank)', methods: ['Card (machine)'] }];
function moneySettings() { const m = S.settings.money = S.settings.money || {}; if (!Array.isArray(m.accounts) || !m.accounts.length) m.accounts = structuredClone(DEFAULT_ACCOUNTS); return m; }
const accounts = () => moneySettings().accounts;
const accountOf = method => { const a = accounts().find(x => (x.methods || []).includes(method)); return a ? a.id : ''; };
const accountName = id => (accounts().find(a => a.id === id) || {}).name || (id ? id : 'Outside the business');

/* every money movement: { date, acc, amt (+in / −out), what, kind } */
function moneyMoves() {
  const out = [], add = (date, acc, amt, what, kind) => { if (acc && date && num(amt)) out.push({ date, acc, amt: r2(num(amt)), what, kind }); };
  for (const p of S.payments) add(p.date, accountOf(p.method), p.amount, `Payment ${p.number || ''} · ${(get('customers', p.customerId) || {}).name || ''}`, 'in');
  for (const i of S.incomes) add(i.date, accountOf(i.method), i.amount, `Other income · ${i.description || i.category || ''}`, 'in');
  for (const b of allBills()) for (const p of b.pays) if (payOk(p)) add(payDate(p), accountOf(p.method || (p.initial ? b.method : '')), -num(p.amount), `${b.name} · ${b.desc}`, 'out');
  for (const t of S.transfers) { const w = t.note || TRANSFER_KINDS[t.kind] || 'Transfer'; add(t.date, t.from, -num(t.amount), w, 'transfer'); add(t.date, t.to, num(t.amount), w, 'transfer'); }
  return out;
}
/* balance at the end of a day; the opening balance is "as at the end of its date" */
function accountBalance(id, upTo = today(), moves = moneyMoves()) {
  const a = accounts().find(x => x.id === id) || {}, from = a.openingDate || '';
  let bal = from && from <= upTo ? num(a.opening) : 0;
  for (const m of moves) if (m.acc === id && m.date <= upTo && (!from || m.date > from)) bal += m.amt;
  return r2(bal);
}
const TRANSFER_KINDS = { deposit: 'Cash deposited to bank', settle: 'Card machine paid into bank', move: 'Transfer', ownerIn: 'Owner put money in', ownerOut: 'Owner took money out', adjust: 'Cash count difference' };

/* ============ supplier bills: pay, balances, cheques, credit limits ============ */
const payFields = (def, method) => [
  { k: 'amount', label: 'Amount paid', type: 'number', req: true, def },
  { k: 'date', label: 'Date paid', type: 'date', req: true, def: today() },
  { k: 'method', label: 'Payment method', type: 'select', options: S.settings.lists.paymentMethod, def: method || '' },
  { k: 'ref', label: 'Reference (transfer ref…)' },
  { k: 'chequeNo', label: 'Cheque no. (cheques only)' },
  { k: 'chequeDate', label: 'Cheque date (post-dated?)', type: 'date', help: 'The date written on the cheque — the bank pays it then' }];
function findBill(kind, id) { const src = get(kind === 'po' ? 'purchaseOrders' : 'expenses', id); return src && billOf(src, kind); }
/* pay (part of) one bill — an expense or a received purchase order */
function payBill(kind, id) {
  const b = findBill(kind, id); if (!b) return; const bal = billBalance(b);
  if (bal <= 0.005) return toast('This bill is already paid', 'ok');
  openForm({
    title: `Pay ${esc(b.name)} — ${esc(b.desc)}`, saveLabel: 'Save payment', fields: payFields(bal, b.method),
    onSave: async v => {
      if (guardClosed(v.date, 'That date')) return false;
      const a = r2(num(v.amount)); if (a <= 0) throw new Error('Amount must be more than 0');
      if (a > bal + 0.005) throw new Error(`Only ${money(bal)} is owed on this bill`);
      await addBillPayment(b, { date: v.date, amount: a, method: v.method || '', ref: v.ref || '', chequeNo: v.chequeNo || '', chequeDate: v.chequeDate || '' });
      const nb = findBill(kind, id); toast(billBalance(nb) > 0.005 ? `Paid ${money(a)} — ${money(billBalance(nb))} still owed` : 'Bill fully paid', 'ok'); render();
    },
  });
}
const recordBillPayment = id => payBill('exp', id);   // older name
/* who we owe, grouped by supplier record (else by the name typed) */
function supplierDebts() {
  const g = {};
  for (const b of openBills()) {
    const key = b.supplierId ? 's:' + b.supplierId : 'n:' + (b.name || '—').trim().toLowerCase();
    const r = g[key] = g[key] || { key, name: b.name || '—', supplierId: b.supplierId, bills: [], owed: 0, due: '' };
    r.bills.push(b); r.owed = r2(r.owed + billBalance(b));
    if (b.due && (!r.due || b.due < r.due)) r.due = b.due;
  }
  for (const r of Object.values(g)) { const s = r.supplierId && get('suppliers', r.supplierId); r.limit = s ? num(s.creditLimit) : 0; }
  return Object.values(g).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.owed - a.owed);
}
/* one payment to a supplier, clearing their oldest bills first */
function paySupplier(key) {
  const d = supplierDebts().find(x => x.key === key); if (!d) return;
  openForm({
    title: `Pay ${esc(d.name)} — owed ${money(d.owed)}`, saveLabel: 'Save payment', fields: payFields(d.owed).map(f => f.k === 'amount' ? { ...f, help: `${d.bills.length} unpaid bill(s); the payment clears the oldest first` } : f),
    onSave: async v => {
      if (guardClosed(v.date, 'That date')) return false;
      let left = r2(num(v.amount)); if (left <= 0) throw new Error('Amount must be more than 0');
      if (left > d.owed + 0.005) throw new Error(`Only ${money(d.owed)} is owed to ${d.name}`);
      for (const b of d.bills.slice().sort((a, c) => (a.date || '').localeCompare(c.date || ''))) {
        if (left <= 0.005) break;
        const fresh = findBill(b.kind, b.id), a = r2(Math.min(left, billBalance(fresh)));
        if (a <= 0) continue;
        await addBillPayment(fresh, { date: v.date, amount: a, method: v.method || '', ref: v.ref || '', chequeNo: v.chequeNo || '', chequeDate: v.chequeDate || '' }); left = r2(left - a);
      }
      const rest = supplierDebts().find(x => x.key === key);
      toast(rest ? `Saved — ${money(rest.owed)} still owed to ${d.name}` : `${d.name} fully paid`, 'ok'); render();
    },
  });
}
function creditLimitWarning(supplierId) {
  const d = supplierId && supplierDebts().find(x => x.key === 's:' + supplierId);
  if (d && d.limit > 0 && d.owed > d.limit) setTimeout(() => toast(`⚠ ${d.name}: owed ${money(d.owed)} is over the credit limit of ${money(d.limit)}`, 'err'), 900);
}
function supplierDebtsCard() {
  const list = supplierDebts(); if (!list.length) return '';
  const total = r2(list.reduce((a, d) => a + d.owed, 0)), t = today();
  return `<div class="card mb"><div class="card-head"><h3>🧾 Owed to suppliers <span class="badge">${money(total)}</span></h3></div>
    ${table([{ h: 'Supplier', v: d => `<b>${esc(d.name)}</b>` }, { h: 'Bills', cls: 'num', v: d => d.bills.length },
      { h: 'Next due', v: d => d.due ? `<span class="${d.due < t ? 'red' : d.due <= addDays(t, 3) ? 'amber' : ''}">${fmtDate(d.due)}${d.due < t ? ' · overdue' : ''}</span>` : '<span class="muted">no date</span>' },
      { h: 'Owed', cls: 'num', v: d => `<b>${money(d.owed, false)}</b>${d.limit ? `<div class="small ${d.owed > d.limit ? 'red' : 'muted'}">limit ${money(d.limit, false)}</div>` : ''}` },
      { h: '', v: d => `<button class="btn sm" onclick="event.stopPropagation();supplierStatement('${esc(d.key)}')">Statement</button> <button class="btn sm primary" onclick="event.stopPropagation();paySupplier('${esc(d.key)}')">Pay</button>` }], list, {})}</div>`;
}

/* ---- cheques we gave (post-dated) ---- */
function chequesIssued() {
  const out = [];
  for (const b of allBills()) for (const p of b.pays) if (/cheque/i.test(p.method || '') && p.id) out.push({ b, p });
  return out.sort((x, y) => payDate(x.p).localeCompare(payDate(y.p)));
}
async function setChequeStatus(kind, billId, payId, status) {
  const src = get(kind === 'po' ? 'purchaseOrders' : 'expenses', billId); if (!src || !Array.isArray(src.payments)) return;
  const p = src.payments.find(x => x.id === payId); if (!p) return;
  if (status === 'Bounced' && !(await confirmBox(`Mark cheque ${p.chequeNo || ''} (${money(p.amount)}) as bounced? The bill becomes unpaid again by that amount.`, 'Bounced', true))) return;
  p.status = status;
  if (kind === 'po') { const nb = billOf(src, 'po'); src.paidDate = billBalance(nb) <= 0.005 ? (src.paidDate || p.date) : ''; }
  await save(kind === 'po' ? 'purchaseOrders' : 'expenses', src); toast(`Cheque ${status.toLowerCase()}`, status === 'Bounced' ? 'err' : 'ok'); render();
}
function chequesCardHTML() {
  const list = chequesIssued().filter(x => x.p.status === 'Pending'); if (!list.length) return '';
  const t = today();
  return `<div class="card mb"><div class="card-head"><h3>🧾 Cheques given — not cleared yet <span class="badge">${money(list.reduce((a, x) => a + num(x.p.amount), 0))}</span></h3></div>
    <div class="card-pad muted small" style="padding-bottom:0">Keep enough money in the bank for these dates. Mark each one when the bank has paid it (or if it bounced).</div>
    ${table([{ h: 'Cheque date', v: x => `<b class="${payDate(x.p) <= t ? 'red' : payDate(x.p) <= addDays(t, 3) ? 'amber' : ''}">${fmtDate(payDate(x.p))}</b>` }, { h: 'Cheque no.', v: x => esc(x.p.chequeNo || '') },
      { h: 'To', v: x => esc(x.b.name) }, { h: 'For', v: x => `<span class="small">${esc(x.b.desc)}</span>` }, { h: 'Amount', cls: 'num', v: x => `<b>${money(x.p.amount, false)}</b>` },
      { h: '', v: x => `<button class="btn sm" onclick="setChequeStatus('${x.b.kind}','${x.b.id}','${x.p.id}','Cleared')">Cleared</button> <button class="btn sm danger" onclick="setChequeStatus('${x.b.kind}','${x.b.id}','${x.p.id}','Bounced')">Bounced</button>` }], list, {})}</div>`;
}

/* ---- photo of a supplier bill (kept with the other photos, linked to the expense or purchase order) ---- */
async function billPhotos(field, id) { return (await DB.all('photos')).filter(p => p[field] === id); }
function billPhotoButton(m, field, id) {
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = '📷 Bill photo';
  b.onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const im = await compressImage(f); const now = new Date().toISOString();
      await DB.put('photos', { id: uid(), [field]: id, stage: 'Bill', caption: 'Supplier bill', date: now, updatedAt: now, by: currentUserName(), ...im }); syncDirty(); toast('Bill photo saved', 'ok'); showBillPhotos(m, field, id); } catch (e) { toast(e.message, 'err'); } };
    inp.click(); };
  m.el.querySelector('[data-close2]').before(b);
  showBillPhotos(m, field, id);
}
async function showBillPhotos(m, field, id) {
  const list = await billPhotos(field, id), body = m.el.querySelector('.modal-body'); if (!body) return;
  let box = body.querySelector('.bill-photos'); if (!box) { box = document.createElement('div'); box.className = 'bill-photos card-pad'; body.appendChild(box); }
  box.innerHTML = list.length ? `<b class="small">Bill photo${list.length > 1 ? 's' : ''}</b><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px">${list.map(p => `<img src="${p.data}" alt="Bill photo" style="height:90px;border-radius:6px;cursor:pointer;border:1px solid var(--line)" onclick="window.open().document.write('<img src=&quot;'+this.src+'&quot; style=&quot;max-width:100%&quot;>')">`).join('')}</div>` : '';
}

/* ---- statements ---- */
function statementDoc(title, party, rows, totals, note) {
  return bdDoc(`${bdHead('STATEMENT', [['Date', fmtDate(today())], ['For', party.name || '']])}
    <div class="bd-two"><div><div class="bd-sec">${esc(title)}</div>${bdField('Name', party.name)}${bdField('Phone', party.phone)}${bdField('TRN', party.trn)}</div>
      <div><div class="bd-sec">Summary</div>${totals.map(([k, v]) => bdField(k, v)).join('')}</div></div>
    <table class="bd-items"><thead><tr><th class="c-d">Date</th><th class="c-d">Details</th><th class="c-a">Amount</th><th class="c-a">Paid</th><th class="c-a">Balance</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="c-d">${fmtDate(r.date)}</td><td class="c-d">${esc(r.what)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</td><td class="c-a">${money(r.amount, false)}</td><td class="c-a">${money(r.paid, false)}</td><td class="c-a">${money(r.balance, false)}</td></tr>`).join('') || '<tr><td colspan="5" class="c-d">Nothing in this period.</td></tr>'}</tbody></table>
    ${note ? `<p class="bd-p">${esc(note)}</p>` : ''}<div class="bd-grow"></div>${bdFoot(null)}`);
}
function showStatement(title, html, waText, party) {
  const m = openModal({ title: esc(title), size: 'xwide', body: `<div class="bd-stage">${html}</div>`,
    foot: `<button class="btn" data-close2>Close</button>${party && party.phone ? '<button class="btn wa" data-wa>Send via WhatsApp</button>' : ''}<button class="btn primary" data-print>🖨 Print</button>` });
  fitDocs(m.el);
  m.el.querySelector('[data-close2]').onclick = () => m.close();
  m.el.querySelector('[data-print]').onclick = () => printHTML(html, true);
  const wa = m.el.querySelector('[data-wa]'); if (wa) wa.onclick = () => { m.close(); openMessageDialog({ customer: { name: party.name, phone: party.phone, email: party.email }, type: 'statement', text: waText, subject: title }); };
}
function supplierStatement(key) {
  const sid = key.startsWith('s:') ? key.slice(2) : '', sup = sid ? get('suppliers', sid) : null;
  const bills = allBills().filter(b => (sid ? b.supplierId === sid : !b.supplierId && ('n:' + (b.name || '—').trim().toLowerCase()) === key) && (billBalance(b) > 0.005 || b.date >= addDays(today(), -180)))
    .filter(b => b.kind === 'po' || Array.isArray(b.src.payments)).sort((a, c) => (a.date || '').localeCompare(c.date || ''));
  const name = sup ? sup.name : (bills[0] || {}).name || 'Supplier';
  const rows = bills.map(b => ({ date: b.date, what: b.desc, sub: [b.ref, b.due ? 'due ' + fmtDate(b.due) : ''].filter(Boolean).join(' · '), amount: b.amount, paid: billPaid(b), balance: billBalance(b) }));
  const owed = r2(rows.reduce((a, r) => a + r.balance, 0)), billed = r2(rows.reduce((a, r) => a + r.amount, 0));
  const html = statementDoc('Supplier', { name, phone: sup && sup.phone, trn: sup && sup.trn }, rows, [['Bills', money(billed)], ['Paid', money(r2(billed - owed))], ['We owe', money(owed)]],
    'Bills from the last 6 months and every bill not yet paid. Please let us know if your records differ.');
  const wa = `Dear ${sup && sup.contact || name},\n\nStatement from ${S.settings.garageName} as of ${fmtDate(today())}:\n${rows.filter(r => r.balance > 0.005).map(r => `• ${fmtDate(r.date)} ${r.what}: ${money(r.balance)}`).join('\n')}\n\nTotal we owe: ${money(owed)}\nPlease confirm this matches your account.`;
  showStatement(`Statement — ${name}`, html, wa, sup && { name, phone: sup.phone, email: sup.email });
}
/* ---- customer credit accounts ---- */
const invoiceDueDaysFor = cid => { const c = cid && get('customers', cid); return c && num(c.creditDays) > 0 ? num(c.creditDays) : num(S.settings.invoiceDueDays); };
function customerCreditNote(cid) {
  const c = cid && get('customers', cid); if (!c || !(num(c.creditLimit) > 0)) return '';
  const bal = customerBalance(c.id);
  return bal > num(c.creditLimit) ? `<div class="card card-pad mb" style="border-color:var(--red)">⚠ <b>${esc(c.name)}</b> owes ${money(bal)} — over their credit limit of ${money(c.creditLimit)}.</div>` : '';
}
/* ============ Cash & bank page ============ */
PAGES.money = () => {
  const moves = moneyMoves(), t = today(), ms = moneySettings();
  const bals = accounts().map(a => ({ a, bal: accountBalance(a.id, t, moves) }));
  const todays = moves.filter(m => m.date === t);
  const lastUp = S.cashups.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  view().innerHTML = pageHead('🏦 Cash & bank', 'Where your money is: cash in hand, bank and card machine. Record bank deposits, close the day with a cash count, and see what is coming in and going out.',
    `<button class="btn" onclick="moneyTransfer('deposit')">Bank deposit</button><button class="btn" onclick="moneyTransfer('move')">Other move</button><button class="btn primary" onclick="closeDay()">Close the day</button>`) +
    `<div class="grid g4 mb">${bals.map(({ a, bal }) => `<div class="kpi click" onclick="editAccount('${a.id}')"><div class="lbl">${esc(a.name)}</div><div class="val ${bal < 0 ? 'red' : ''}">${money(bal, false)}</div>
        <div class="hint">${a.openingDate ? `since ${fmtDate(a.openingDate)}` : '<span class="amber">tap to set the real balance</span>'}</div></div>`).join('')}
      <div class="kpi"><div class="lbl">Cash float to keep</div><div class="val">${money(ms.cashFloat || 0, false)}</div><div class="hint"><a onclick="editFloat()">change</a> · ${lastUp ? `last cash-up ${fmtDate(lastUp.date)}` : 'no cash-up yet'}</div></div></div>
    ${chequesCardHTML()}
    ${paymentsCalendarHTML()}
    <div class="grid g2 mb">
      <div class="card"><div class="card-head"><h3>Today's money</h3></div>${table([{ h: 'Account', v: m => esc(accountName(m.acc)) }, { h: 'What', v: m => `<span class="small">${esc(m.what)}</span>` },
        { h: 'In', cls: 'num', v: m => m.amt > 0 ? `<span class="green">${money(m.amt, false)}</span>` : '' }, { h: 'Out', cls: 'num', v: m => m.amt < 0 ? `<span class="red">${money(-m.amt, false)}</span>` : '' }], todays, { empty: 'No money in or out today yet.' })}</div>
      <div class="card"><div class="card-head"><h3>Recent day closings</h3></div>${table([{ h: 'Date', v: c => fmtDate(c.date) }, { h: 'Expected', cls: 'num', v: c => money(c.expected, false) }, { h: 'Counted', cls: 'num', v: c => money(c.counted, false) },
        { h: 'Difference', cls: 'num', v: c => `<span class="${Math.abs(c.diff) > 0.005 ? 'red' : 'green'}">${c.diff > 0 ? '+' : ''}${money(c.diff, false)}</span>` }, { h: 'Deposited', cls: 'num', v: c => c.deposit ? money(c.deposit, false) : '' }, { h: 'By', v: c => esc(c.by || '') }],
        S.cashups.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10), { empty: 'Close the day to count the cash.' })}</div></div>
    <div class="card"><div class="card-head"><h3>Deposits & moves</h3></div>${table([{ h: 'Date', v: x => fmtDate(x.date) }, { h: 'What', v: x => esc(x.note || TRANSFER_KINDS[x.kind] || 'Transfer') }, { h: 'From', v: x => esc(accountName(x.from)) }, { h: 'To', v: x => esc(accountName(x.to)) },
      { h: 'Amount', cls: 'num', v: x => `<b>${money(x.amount, false)}</b>` }], S.transfers.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30), { click: x => `editTransfer('${x.id}')`, empty: 'No deposits or moves yet.' })}</div>`;
};
function editAccount(id) {
  const a = accounts().find(x => x.id === id); if (!a) return;
  openForm({
    title: `${esc(a.name)} — real balance`, saveLabel: 'Save',
    fields: [{ k: 'name', label: 'Name', req: true }, { k: 'opening', label: 'Real balance (AED)', type: 'number', req: true, help: 'What is really there — count the cash or check the bank app' },
      { k: 'openingDate', label: 'As at the end of', type: 'date', req: true, def: today(), help: 'Money in and out after this date is added automatically' },
      { k: 'methods', label: 'Payment methods that land here', help: 'Comma-separated, as in Settings → Lists → Payment methods' }],
    data: { ...a, methods: (a.methods || []).join(', ') },
    onSave: async v => { Object.assign(a, { name: v.name, opening: num(v.opening), openingDate: v.openingDate, methods: v.methods.split(',').map(x => x.trim()).filter(Boolean) }); await saveSettings(); toast('Saved', 'ok'); render(); },
  });
}
function editFloat() {
  const ms = moneySettings();
  openForm({ title: 'Cash float', saveLabel: 'Save', fields: [{ k: 'cashFloat', label: 'Cash to keep in the drawer (AED)', type: 'number', def: ms.cashFloat || 0, help: 'e.g. money for buying parts in cash. When you close the day, the rest is suggested for the bank.' }],
    onSave: async v => { ms.cashFloat = num(v.cashFloat); await saveSettings(); render(); } });
}
function moneyTransfer(kind = 'deposit', preset = {}) {
  const accs = accounts().map(a => [a.id, a.name]);
  const defs = { deposit: ['cash', 'bank'], settle: ['card', 'bank'], ownerIn: ['', 'bank'], ownerOut: ['cash', ''], move: ['cash', 'bank'] }[kind] || ['cash', 'bank'];
  openForm({
    title: kind === 'deposit' ? 'Bank deposit' : 'Move money', saveLabel: 'Save',
    fields: [{ k: 'kind', label: 'What', type: 'select', blank: false, def: kind, options: Object.entries(TRANSFER_KINDS).filter(([k]) => k !== 'adjust') },
      { k: 'date', label: 'Date', type: 'date', req: true, def: today() }, { k: 'amount', label: 'Amount (AED)', type: 'number', req: true, def: preset.amount || '' },
      { k: 'from', label: 'From', type: 'select', options: accs, def: defs[0], help: 'Leave empty for money from outside the business' }, { k: 'to', label: 'To', type: 'select', options: accs, def: defs[1], help: 'Leave empty for money leaving the business' },
      { k: 'note', label: 'Note (optional)', ph: 'e.g. deposit slip no.' }],
    onSave: async v => {
      if (guardClosed(v.date, 'That date')) return false;
      if (num(v.amount) <= 0) throw new Error('Amount must be more than 0');
      if (!v.from && !v.to) throw new Error('Choose where the money comes from or goes to');
      if (v.from && v.from === v.to) throw new Error('From and To are the same');
      await save('transfers', { ...v, amount: r2(num(v.amount)), by: currentUserName() }); toast('Saved', 'ok'); render();
    },
  });
}
function editTransfer(id) {
  const x = get('transfers', id); if (!x) return;
  openForm({ title: 'Deposit / move', fields: [{ k: 'date', label: 'Date', type: 'date' }, { k: 'amount', label: 'Amount', type: 'number' }, { k: 'note', label: 'Note' }], data: x,
    onSave: async v => { if (guardClosed(x.date, 'This entry') || guardClosed(v.date, 'That date')) return false; Object.assign(x, v, { amount: r2(num(v.amount)) }); await save('transfers', x); render(); },
    onDelete: async () => { if (guardClosed(x.date, 'This entry')) return false; if (!(await confirmBox('Delete this entry?', 'Delete', true))) return false; await remove('transfers', x.id); render(); return true; } });
}
/* close the day: count the cash, record the difference, deposit the rest above the float, e-mail the owner's day report */
function closeDay() {
  const t = today(), expected = accountBalance('cash', t), ms = moneySettings();
  if (!accounts().some(a => a.id === 'cash')) return toast('Add a "cash" account first', 'err');
  const done = S.cashups.find(c => c.date === t);
  const m = openForm({
    title: `Close the day — ${fmtDate(t)}`, saveLabel: 'Close the day',
    fields: [{ k: 'counted', label: `Cash counted in the drawer (app expects ${money(expected)})`, type: 'number', req: true },
      { k: 'deposit', label: done ? 'Deposit to bank now (in addition to earlier today)' : 'Deposit to bank now (AED)', type: 'number', help: `Keeps the float of ${money(ms.cashFloat || 0)} in the drawer` },
      { k: 'note', label: 'Note (optional)', ph: 'e.g. reason for a difference' }, { k: 'report', label: 'E-mail the day report to the Owner', type: 'checkbox', def: true }],
    data: {},
    onSave: async v => {
      if (guardClosed(t, 'Today')) return false;
      const counted = r2(num(v.counted)), diff = r2(counted - expected), dep = r2(num(v.deposit));
      if (dep < 0 || dep > counted + 0.005) throw new Error('The deposit cannot be more than the cash counted');
      if (done) { if (!(await confirmBox('The day was already closed. Close it again with this count?', 'Close again'))) return false; }
      if (Math.abs(diff) > 0.005) await save('transfers', { kind: 'adjust', date: t, amount: Math.abs(diff), from: diff < 0 ? 'cash' : '', to: diff > 0 ? 'cash' : '', note: `Cash count ${diff > 0 ? 'over' : 'short'} ${money(Math.abs(diff))}`, by: currentUserName() });
      if (dep > 0) await save('transfers', { kind: 'deposit', date: t, amount: dep, from: 'cash', to: accounts().some(a => a.id === 'bank') ? 'bank' : '', note: 'Deposit at day close', by: currentUserName() });
      const rec = done || {}; Object.assign(rec, { date: t, expected, counted, diff: r2((done ? num(done.diff) : 0) + diff), deposit: r2((done ? num(done.deposit) : 0) + dep), note: v.note || rec.note || '', by: currentUserName() }); await save('cashups', rec);
      toast(Math.abs(diff) > 0.005 ? `Day closed — cash ${diff > 0 ? 'over' : 'short'} by ${money(Math.abs(diff))}` : 'Day closed — cash matches', Math.abs(diff) > 0.005 ? 'err' : 'ok');
      if (v.report) sendDayReport(t);
      render();
    },
  });
  const cin = m.el.querySelector('#f_counted'), dep = m.el.querySelector('#f_deposit');
  if (cin && dep) cin.addEventListener('input', () => { if (!dep.dataset.touched) dep.value = Math.max(0, r2(num(cin.value) - num(ms.cashFloat))) || ''; });
  if (dep) dep.addEventListener('input', () => { dep.dataset.touched = '1'; });
}

/* ============ owner's day report (e-mailed through the alert e-mail) ============ */
function dayReportData(d) {
  const invs = S.invoices.filter(i => !i.void && i.date === d), sales = invs.reduce((a, i) => a + calcDoc(i).total, 0);
  const pays = S.payments.filter(p => p.date === d), byM = {}; pays.forEach(p => byM[p.method || 'Other'] = (byM[p.method || 'Other'] || 0) + num(p.amount));
  const oth = S.incomes.filter(i => i.date === d).reduce((a, i) => a + num(i.amount), 0);
  const out = moneyMoves().filter(m => m.date === d && m.kind === 'out').reduce((a, m) => a - m.amt, 0);
  const disc = invs.filter(i => calcDoc(i).discount > 0).map(i => `${i.number}: ${money(calcDoc(i).discount)}`);
  const cu = S.cashups.find(c => c.date === d);
  const open = S.jobs.filter(j => OPEN_JOB.includes(j.status)).length, done = S.jobs.filter(j => (j.completed || '').slice(0, 10) === d).length, newJobs = S.jobs.filter(j => (j.date || '') === d).length;
  const unpaid = S.invoices.filter(i => !i.void).reduce((a, i) => a + Math.max(0, invoiceState(i).balance), 0);
  const due = openBills().filter(b => b.due && b.due <= addDays(d, 3)).reduce((a, b) => a + billBalance(b), 0);
  return { d, sales: r2(sales), invoices: invs.length, collected: r2(pays.reduce((a, p) => a + num(p.amount), 0) + oth), byM, out: r2(out), disc, cu, open, done, newJobs, unpaid: r2(unpaid), due: r2(due),
    balances: accounts().map(a => [a.name, accountBalance(a.id, d)]) };
}
function dayReportHTML(r) {
  const row = (k, v, cls = '') => `<tr><td style="padding:5px 0;color:#6C7488">${k}</td><td style="padding:5px 0;text-align:right;font-weight:600" class="${cls}">${v}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Sales invoiced', `${money(r.sales)} (${r.invoices} invoice${r.invoices === 1 ? '' : 's'})`)}${row('Money collected', money(r.collected))}
    ${Object.entries(r.byM).map(([m, a]) => row('&nbsp;&nbsp;' + esc(m), money(a))).join('')}${row('Money paid out', money(r.out))}
    ${row('Cars checked in / finished / still open', `${r.newJobs} / ${r.done} / ${r.open}`)}
    ${r.cu ? row('Cash count', `${money(r.cu.counted)} counted · ${Math.abs(r.cu.diff) > 0.005 ? `<span style="color:#C62828">${r.cu.diff > 0 ? 'over' : 'short'} ${money(Math.abs(r.cu.diff))}</span>` : 'matches'}${r.cu.deposit ? ` · ${money(r.cu.deposit)} to bank` : ''}`) : row('Cash count', 'day not closed')}
    ${r.balances.map(([n, b]) => row(esc(n), money(b))).join('')}
    ${row('Customers still owe', money(r.unpaid))}${row('Supplier bills due in 3 days', money(r.due))}
    ${r.disc.length ? row('Discounts given', esc(r.disc.join(', '))) : ''}</table>`;
}
async function sendDayReport(d = today()) {
  if (!Cloud.accounts || !Sync.user) return toast('The day report needs the cloud (personal logins)', 'err');
  const r = dayReportData(d);
  try { await Cloud.rpc('send_day_report', { p_subject: `mendtech. day report — ${fmtDate(d)} · sales ${money(r.sales)}`, p_html: dayReportHTML(r) }); toast('Day report e-mailed to the Owner', 'ok'); }
  catch (e) { toast('Day report not sent: ' + e.message, 'err'); }
}

/* ============ fixed costs ============ */
const FC_EVERY = [[1, 'Every month'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Every year'], [0, 'Once']];
const fcFields = () => [
  { k: 'name', label: 'Name', req: true, ph: 'e.g. Workshop rent' }, { k: 'category', label: 'Expense category', type: 'select', options: S.settings.lists.expenseCategory, req: true },
  { k: 'amount', label: 'Amount each time (AED)', type: 'number', req: true }, { k: 'every', label: 'How often', type: 'select', blank: false, def: 1, options: FC_EVERY },
  { k: 'start', label: 'Next / first due date', type: 'date', req: true, def: today(), help: 'For monthly costs, the day of the month is used every month' },
  { k: 'payee', label: 'Paid to (optional)' }, { k: 'method', label: 'Usually paid by', type: 'select', options: S.settings.lists.paymentMethod },
  { k: 'active', label: 'Active', type: 'checkbox', def: true }, { k: 'notes', label: 'Notes', type: 'textarea', span: 'all' }];
function editFixedCost(id) {
  const f = get('fixedCosts', id);
  openForm({ title: f ? 'Edit fixed cost' : 'New fixed cost', fields: fcFields(), data: f || {},
    onSave: async v => { if (num(v.amount) <= 0) throw new Error('Amount must be more than 0'); await save('fixedCosts', f ? Object.assign(f, v, { amount: num(v.amount), every: num(v.every) }) : { ...v, amount: num(v.amount), every: num(v.every) }); render(); },
    onDelete: f ? async () => { if (!(await confirmBox('Delete this fixed cost? Payments already made stay in Expenses.', 'Delete', true))) return false; await remove('fixedCosts', f.id); render(); return true; } : null });
}
/* the due dates of a fixed cost inside [from, to] */
function fcDues(f, from, to) {
  const out = [], every = num(f.every); if (!f.start) return out;
  if (!every) { if (f.start >= from && f.start <= to) out.push(f.start); return out; }
  const s = new Date(f.start + 'T00:00:00'), day = s.getDate();
  for (let k = -240; k <= 240; k++) {
    const d = new Date(s.getFullYear(), s.getMonth() + k * every, 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    const iso = toISODate(d); if (iso > to) break; if (iso >= from && iso >= f.start.slice(0, 7) + '-01') out.push(iso);
  }
  return out;
}
const fcPaidFor = (f, due) => S.expenses.find(e => e.fixedCostId === f.id && e.fcDue === due);
function payFixedCost(id, due) {
  const f = get('fixedCosts', id); if (!f) return;
  editExpense(null, { date: today(), category: f.category, description: `${f.name} — ${new Date(due + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`, amount: f.amount, paidTo: f.payee || '', method: f.method || '', payType: 'full',
    link: { fixedCostId: f.id, fcDue: due } });
}
function fixedCostPlan(mk = monthKey(today())) {
  const from = mk + '-01', to = monthEnd(mk), list = S.fixedCosts.filter(f => f.active !== false);
  const rows = [];
  for (const f of list) for (const due of fcDues(f, from, to)) { const e = fcPaidFor(f, due); rows.push({ f, due, paid: !!e && expBalance(e) <= 0.005, part: e ? expPaid(e) : 0, e }); }
  rows.sort((a, b) => a.due.localeCompare(b.due));
  const total = r2(rows.reduce((a, r) => a + num(r.f.amount), 0)), paid = r2(rows.reduce((a, r) => a + (r.e ? expPaid(r.e) : 0), 0));
  // costs paid less often than monthly: what should be put aside each month, and how much of the next one should be saved by now
  const reserves = list.filter(f => num(f.every) > 1).map(f => {
    const next = fcDues(f, today(), addDays(today(), 400))[0]; if (!next) return null;
    const per = r2(num(f.amount) / num(f.every)), monthsLeft = Math.max(0, Math.round(daysBetween(today(), next) / 30.4));
    return { f, next, per, saved: r2(Math.max(0, num(f.amount) - per * monthsLeft)), thisMonth: next <= to };
  }).filter(Boolean);
  const monthlyEquiv = r2(list.reduce((a, f) => a + (num(f.every) ? num(f.amount) / num(f.every) : 0), 0));
  return { mk, rows, total, paid, remaining: r2(total - paid), reserves, reserveNow: r2(reserves.filter(r => !r.thisMonth).reduce((a, r) => a + r.saved, 0)), monthlyEquiv };   // one due this month is already in "still to pay"
}
PAGES.fixedcosts = () => {
  const p = fixedCostPlan(), t = today(), cash = r2(accounts().reduce((a, x) => a + accountBalance(x.id, t), 0));
  const safe = r2(cash - p.remaining - p.reserveNow), days = num(moneySettings().workDays) || 26;
  const mk = monthKey(t), invs = S.invoices.filter(i => !i.void && monthKey(i.date) === mk);
  const net = invs.reduce((a, i) => a + calcDoc(i).net, 0), gp = invs.reduce((a, i) => a + calcDoc(i).profit, 0);
  const last3 = S.invoices.filter(i => !i.void && i.date >= addDays(t, -90)), n3 = last3.reduce((a, i) => a + calcDoc(i).net, 0), g3 = last3.reduce((a, i) => a + calcDoc(i).profit, 0);
  const margin = n3 > 0 ? g3 / n3 : 0, perDay = r2(p.monthlyEquiv / days), dayOfM = Math.max(1, Number(t.slice(8, 10))), avgDay = r2(net / dayOfM);
  view().innerHTML = pageHead('📌 Fixed costs', 'The costs you must pay whatever happens — rent, salaries, licence, visas… Add them once; the app shows what is due, paid, still to pay, what to put aside for yearly costs, and what is safe to spend.',
    `<button class="btn primary" onclick="editFixedCost()">＋ Add fixed cost</button>`) +
    `<div class="grid g6 mb"><div class="kpi"><div class="lbl">Due this month</div><div class="val">${money(p.total, false)}</div></div>
      <div class="kpi"><div class="lbl">Paid</div><div class="val green">${money(p.paid, false)}</div></div>
      <div class="kpi"><div class="lbl">Still to pay</div><div class="val ${p.remaining > 0 ? 'red' : 'green'}">${money(p.remaining, false)}</div></div>
      <div class="kpi"><div class="lbl">Saved for yearly costs</div><div class="val">${money(p.reserveNow, false)}</div><div class="hint">should be put aside by now</div></div>
      <div class="kpi"><div class="lbl">Money now (all accounts)</div><div class="val">${money(cash, false)}</div><div class="hint"><a onclick="go('#/money')">Cash & bank</a></div></div>
      <div class="kpi"><div class="lbl">Safe to spend</div><div class="val ${safe < 0 ? 'red' : 'green'}">${money(safe, false)}</div><div class="hint">after what is due and saved</div></div></div>
    <div class="card card-pad mb">📊 <b>Break-even:</b> fixed costs are about <b>${money(p.monthlyEquiv)}</b> a month = <b>${money(perDay)}</b> a working day (${days} days).
      ${margin > 0 ? ` At your gross margin of ${Math.round(margin * 100)}%, you need about <b>${money(r2(perDay / margin))}</b> sales a day.` : ''}
      This month you average <b>${money(avgDay)}</b> sales a day (gross profit ${money(gp)} so far). <a onclick="editWorkDays()">Working days: ${days}</a></div>
    <div class="card mb"><div class="card-head"><h3>This month</h3></div>${table([{ h: 'Due', v: r => `<span class="${!r.paid && r.due < t ? 'red' : ''}">${fmtDate(r.due)}</span>` }, { h: 'Cost', v: r => `<b>${esc(r.f.name)}</b><div class="small muted">${esc(r.f.payee || r.f.category || '')}</div>` },
      { h: 'Amount', cls: 'num', v: r => money(r.f.amount, false) }, { h: 'Status', v: r => r.paid ? pill('Paid') : r.part > 0 ? pill('Part paid', 'amber') : r.due < t ? pill('Overdue', 'red') : pill('To pay', 'amber') },
      { h: '', v: r => r.paid ? `<button class="btn sm" onclick="editExpense('${r.e.id}')">View</button>` : r.e ? `<button class="btn sm primary" onclick="payBill('exp','${r.e.id}')">Pay rest</button>` : `<button class="btn sm primary" onclick="payFixedCost('${r.f.id}','${r.due}')">Pay</button>` }],
      p.rows, { empty: 'Nothing due this month. Add your rent, salaries and other fixed costs.' })}</div>
    ${p.reserves.length ? `<div class="card mb"><div class="card-head"><h3>Put aside for costs paid less often</h3></div>${table([{ h: 'Cost', v: r => `<b>${esc(r.f.name)}</b>` }, { h: 'Next due', v: r => fmtDate(r.next) },
      { h: 'Amount', cls: 'num', v: r => money(r.f.amount, false) }, { h: 'Put aside a month', cls: 'num', v: r => money(r.per, false) }, { h: 'Should be saved by now', cls: 'num', v: r => r.thisMonth ? '<span class="muted">due this month — see above</span>' : `<b>${money(r.saved, false)}</b>` }], p.reserves, {})}</div>` : ''}
    <div class="card"><div class="card-head"><h3>All fixed costs</h3></div>${table([{ h: 'Name', v: f => `<b>${esc(f.name)}</b>${f.active === false ? ' ' + pill('Off') : ''}` }, { h: 'Category', v: f => esc(f.category || '') },
      { h: 'How often', v: f => esc((FC_EVERY.find(x => x[0] === num(f.every)) || [, ''])[1]) }, { h: 'Next due', v: f => { const n = fcDues(f, today(), addDays(today(), 400))[0]; return n ? fmtDate(n) : '—'; } },
      { h: 'Amount', cls: 'num', v: f => `<b>${money(f.amount, false)}</b>` }, { h: 'A month', cls: 'num', v: f => num(f.every) ? money(num(f.amount) / num(f.every), false) : '—' }],
      S.fixedCosts.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')), { click: f => `editFixedCost('${f.id}')`, empty: 'No fixed costs yet — add rent, salaries, licence, visas, insurance…' })}</div>`;
};
function editWorkDays() { const ms = moneySettings(); openForm({ title: 'Working days a month', fields: [{ k: 'workDays', label: 'Days the workshop works in a month', type: 'number', def: ms.workDays || 26 }], onSave: async v => { ms.workDays = num(v.workDays) || 26; await saveSettings(); render(); } }); }

/* ============ payments calendar (next 4 weeks) ============ */
function calendarItems(days = 28) {
  const t = today(), end = addDays(t, days), items = [];
  for (const b of openBills()) { const d = b.due && b.due < t ? t : b.due; if (d && d <= end) items.push({ date: d, late: b.due < t, out: billBalance(b), what: `${b.name} — ${b.desc}`, kind: 'Supplier bill' }); }
  for (const { b, p } of chequesIssued()) if (p.status === 'Pending' && payDate(p) <= end) items.push({ date: payDate(p) < t ? t : payDate(p), late: payDate(p) < t, out: num(p.amount), what: `Cheque ${p.chequeNo || ''} to ${b.name}`, kind: 'Cheque' });
  for (const f of S.fixedCosts.filter(x => x.active !== false)) for (const d of fcDues(f, addDays(t, -31), end)) { const e = fcPaidFor(f, d); if (e && expBalance(e) <= 0.005) continue; if (d < t && !e) items.push({ date: t, late: true, out: num(f.amount), what: f.name, kind: 'Fixed cost' }); else if (d >= t) items.push({ date: d, out: e ? expBalance(e) : num(f.amount), what: f.name, kind: 'Fixed cost' }); }
  for (const i of S.invoices) { if (i.void) continue; const s = invoiceState(i); if (s.balance <= 0.005) continue; const d = i.dueDate && i.dueDate > t ? i.dueDate : t; if (d <= end) items.push({ date: d, late: !!(i.dueDate && i.dueDate < t), in: s.balance, what: `${(get('customers', i.customerId) || {}).name || ''} — ${i.number}`, kind: 'Customer invoice' }); }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
const shortDay = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
function paymentsCalendarHTML() {
  const items = calendarItems(), t = today(); if (!items.length) return '';
  const start = r2(accounts().filter(a => a.id !== 'card').reduce((a, x) => a + accountBalance(x.id, t), 0));
  const weeks = [0, 1, 2, 3].map(w => { const from = addDays(t, w * 7), to = addDays(t, w * 7 + 6), its = items.filter(x => x.date >= from && x.date <= to);
    return { from, to, its, out: r2(its.reduce((a, x) => a + num(x.out), 0)), in: r2(its.reduce((a, x) => a + num(x.in), 0)) }; });
  let run = start;
  return `<div class="card mb"><div class="card-head"><h3>📅 Next 4 weeks</h3></div><div class="card-pad muted small" style="padding-bottom:0">Starts from cash + bank now (${money(start)}). Money in = unpaid customer invoices by due date (if they pay on time).</div>
    ${table([{ h: 'Week', v: w => `<span style="white-space:nowrap">${shortDay(w.from)} – ${shortDay(w.to)}</span>` }, { h: 'Going out', cls: 'num', v: w => w.out ? `<span class="red">${money(w.out, false)}</span>` : '' }, { h: 'Coming in', cls: 'num', v: w => w.in ? `<span class="green">${money(w.in, false)}</span>` : '' },
      { h: 'Expected balance', cls: 'num', v: w => { run = r2(run - w.out + w.in); return `<b class="${run < 0 ? 'red' : ''}">${money(run, false)}</b>`; } },
      { h: 'What', v: w => `<span class="small">${w.its.slice(0, 6).map(x => `${x.late ? '<span class="red">overdue</span> ' : ''}${esc(x.what)} ${x.out ? '−' + money(x.out, false) : '+' + money(x.in, false)}`).join('<br>')}${w.its.length > 6 ? `<br>+${w.its.length - 6} more` : ''}</span>` }], weeks, {})}</div>`;
}

/* dashboard: supplier bills, cheques and fixed costs due soon (Owner / Manager) */
function supplierDueHTML() {
  if (!Auth.canPage('expenses')) return '';
  const t = today(), soon = addDays(t, 3);
  const bills = openBills().filter(b => b.due && b.due <= soon), cheques = chequesIssued().filter(x => x.p.status === 'Pending' && payDate(x.p) <= soon);
  const fcs = []; for (const f of S.fixedCosts.filter(x => x.active !== false)) for (const d of fcDues(f, addDays(t, -31), soon)) { const e = fcPaidFor(f, d); if (!e || expBalance(e) > 0.005) fcs.push({ f, d }); }
  if (!bills.length && !cheques.length && !fcs.length) return '';
  const over = bills.filter(b => b.due < t).length + fcs.filter(x => x.d < t).length;
  const parts = [bills.length ? `${bills.length} supplier bill(s) ${money(bills.reduce((a, b) => a + billBalance(b), 0))}` : '', cheques.length ? `${cheques.length} cheque(s) clearing ${money(cheques.reduce((a, x) => a + num(x.p.amount), 0))}` : '',
    fcs.length ? `${fcs.length} fixed cost(s) ${money(fcs.reduce((a, x) => a + num(x.f.amount), 0))}` : ''].filter(Boolean);
  return `<div class="card card-pad mb click" style="border-color:var(--${over ? 'red' : 'amber'})" onclick="go('#/money')">🧾 <b>To pay in the next 3 days${over ? ` — ${over} overdue` : ''}:</b> ${parts.join(' · ')} <span class="small muted">· tap for Cash & bank</span></div>`;
}
