/* mendtech. — the customer approves or declines a quotation from the link we send (v3.4).
   The link carries a long random token (after #, so it never reaches server logs). The page only ever sees this one
   quotation, the customer's first name and the car — never phone numbers, costs or other customers. */
(function () {
  'use strict';
  const CFG = window.GP_CONFIG || {};
  const token = (location.hash.replace(/^#/, '').match(/^(?:t=)?([A-Za-z0-9_-]{20,100})$/) || [])[1] || '';
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const fmtDate = iso => { if (!iso) return ''; const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const todayDubai = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
  let Q = null;

  async function rpc(fn, args) {
    const key = CFG.supabaseKey || '';
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) throw new Error((j && j.message) || 'Something went wrong — please try again');
    return j;
  }
  const money = n => `${esc((Q && Q.garage.currency) || 'AED')} ${num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const waLink = () => { const w = String((Q && (Q.garage.whatsapp || Q.garage.phone)) || '').replace(/\D/g, ''); return w ? `https://wa.me/${w.startsWith('0') ? '971' + w.slice(1) : w}?text=${encodeURIComponent(`Hi, about quotation ${Q.number}`)}` : ''; };
  function totals(q) {
    const sub = r2((q.items || []).reduce((a, it) => a + r2(num(it.qty) * num(it.rate)), 0));
    const disc = r2(q.discountType === 'amt' ? num(q.discount) : sub * num(q.discount) / 100);
    const net = r2(sub - disc), vat = r2(net * num(q.vatRate) / 100);
    return { sub, disc, net, vat, total: r2(net + vat) };
  }
  function fail(msg) {
    app.innerHTML = `<div class="card"><h1>Quotation</h1><p class="muted">${esc(msg)}</p>${Q && waLink() ? `<a class="btn wa" style="display:block;text-align:center;text-decoration:none" href="${waLink()}">WhatsApp us</a>` : ''}</div>`;
  }
  function draw() {
    const q = Q, t = totals(q), v = q.vehicle || {}, g = q.garage || {};
    const expired = q.validUntil && q.validUntil < todayDubai();
    const decided = ['Approved', 'Declined', 'Converted'].includes(q.status);
    const ap = q.approval || {};
    const terms = String(g.terms || '').replace(/\{validDays\}/g, g.validDays || 7);
    let action;
    if (decided) {
      const yes = q.status !== 'Declined';
      action = `<div class="status ${yes ? 'g' : 'r'}">${yes ? '✓ Approved' : 'Declined'}${ap.name ? ` by ${esc(ap.name)}` : ''}${ap.at ? ` on ${esc(fmtDate(ap.at))}` : ''}</div>
        <p class="muted" style="text-align:center">${yes ? 'Thank you — we will contact you to arrange the work.' : 'Thank you for letting us know.'}</p>`;
    } else if (expired) {
      action = `<div class="status a">This quotation expired on ${esc(fmtDate(q.validUntil))}.</div><p class="muted" style="text-align:center">Prices may have changed — message us for an updated quotation.</p>
        ${waLink() ? `<a class="btn wa" style="display:block;text-align:center;text-decoration:none" href="${waLink()}">WhatsApp us</a>` : ''}`;
    } else {
      action = `<h2>Your decision</h2>
        <label for="nm">Your full name</label><input id="nm" autocomplete="name" maxlength="80" value="">
        <label for="nt">Note for us (optional)</label><textarea id="nt" maxlength="500" placeholder="e.g. Please call before starting"></textarea>
        <div id="er" class="err"></div>
        <div class="row2"><button class="btn no" id="dec">Decline</button><button class="btn ok2" id="apv">✓ Approve</button></div>
        <p class="muted" style="margin:10px 0 0">By approving you agree to the work and prices above. We will contact you to book the car in.</p>`;
    }
    app.innerHTML = `<div class="card">
        <h1>Quotation ${esc(q.number)}</h1><div class="sub" style="margin:4px 0 12px">${q.customer ? `Hi ${esc(q.customer)}, here` : 'Here'} is your quotation from ${esc(g.name || 'mendtech.')}.</div>
        <dl class="qmeta"><dt>Car</dt><dd>${esc([v.make, v.model, v.year].filter(Boolean).join(' '))}${v.plate ? ` · ${esc(v.plate)}` : ''}</dd>
          <dt>Date</dt><dd>${esc(fmtDate(q.date))}</dd>${q.validUntil ? `<dt>Valid until</dt><dd>${esc(fmtDate(q.validUntil))}</dd>` : ''}</dl>
        ${q.description ? `<p style="white-space:pre-wrap;margin:12px 0 0">${esc(q.description)}</p>` : ''}</div>
      <div class="card"><table class="qi"><thead><tr><th>Work &amp; parts</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>
        ${(q.items || []).map(it => `<tr><td>${esc(it.desc)}</td><td class="n">${esc(num(it.qty))}</td><td class="n">${money(r2(num(it.qty) * num(it.rate)))}</td></tr>`).join('')}</tbody></table>
        <div class="tot"><span>Subtotal</span><span class="n">${money(t.sub)}</span>
          ${t.disc ? `<span>Discount</span><span class="n">− ${money(t.disc)}</span>` : ''}
          <span>VAT ${esc(num(q.vatRate))}%</span><span class="n">${money(t.vat)}</span>
          <span class="big">Total</span><span class="big n">${money(t.total)}</span></div></div>
      <div class="card" id="act">${action}</div>
      ${terms ? `<div class="card terms">${esc(terms)}</div>` : ''}
      <div class="foot">${esc(g.name || '')}${g.address ? ' · ' + esc(g.address) : ''}${g.phone ? '<br>' + esc(g.phone) : ''}${g.footer ? '<br>' + esc(g.footer) : ''}</div>`;
    if (!decided && !expired) {
      const nm = document.getElementById('nm'), er = document.getElementById('er');
      const go = async decision => {
        const name = nm.value.trim();
        if (name.length < 2) { er.textContent = 'Please type your name'; nm.focus(); return; }
        if (decision === 'decline' && !confirm('Decline this quotation?')) return;
        document.querySelectorAll('#act button').forEach(b => b.disabled = true); er.textContent = '';
        try {
          const r = await rpc('public_quote_decide', { p_token: token, p_decision: decision, p_name: name, p_note: document.getElementById('nt').value.trim() });
          Q.status = r.status; Q.approval = r.already ? Q.approval : { name, at: new Date().toISOString() };
          draw(); window.scrollTo({ top: document.getElementById('act').offsetTop - 20, behavior: 'smooth' });
        } catch (e) { er.textContent = e.message; document.querySelectorAll('#act button').forEach(b => b.disabled = false); }
      };
      document.getElementById('apv').onclick = () => go('approve');
      document.getElementById('dec').onclick = () => go('decline');
    }
  }
  (async function start() {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) return fail('Quotation links are not switched on for this website yet.');
    if (!token) return fail('This link is incomplete — please open the full link from our message.');
    try { Q = await rpc('public_quote', { p_token: token }); }
    catch (e) { return fail('We could not load your quotation right now. Please try again in a minute.'); }
    if (!Q) return fail('This quotation link is not valid any more. Please message us for your quotation.');
    document.title = `Quotation ${Q.number} — ${Q.garage.name || 'mendtech.'}`;
    draw();
  })();
})();
