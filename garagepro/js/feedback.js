/* mendtech. — private feedback page (v3.8): the customer rates the job 1–5 from the link we send after delivery.
   The page sees only this job's number, the customer's first name and the car. 3 or less goes to the Owner as an alert;
   4–5 are invited to leave a Google review (when the garage has set its review link). */
(function () {
  'use strict';
  const CFG = window.GP_CONFIG || {};
  const token = (location.hash.replace(/^#/, '').match(/^(?:t=)?([A-Za-z0-9_-]{20,100})$/) || [])[1] || '';
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let F = null, rating = 0;
  async function rpc(fn, args) {
    const key = CFG.supabaseKey || '', h = { apikey: key, 'Content-Type': 'application/json' };
    if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
    if (!r.ok) throw new Error((j && j.message) || 'Something went wrong — please try again');
    return j;
  }
  const waLink = () => { const g = (F && F.garage) || {}, w = String(g.whatsapp || g.phone || '').replace(/\D/g, ''); return w ? `https://wa.me/${w.startsWith('0') ? '971' + w.slice(1) : w}` : ''; };
  function thanks(review) {
    app.innerHTML = `<div class="card done"><div class="tick">✓</div><h1>Thank you${F && F.customer ? ', ' + esc(F.customer) : ''}!</h1>
      <p class="muted">${rating >= 4 ? 'We are glad you are happy with the work.' : 'We are sorry it was not perfect — we will contact you to put it right.'}</p>
      ${review ? `<p class="muted">Would you share it on Google? It helps a small workshop a lot.</p><a class="btn" style="display:block;text-align:center;text-decoration:none" href="${esc(review)}" target="_blank" rel="noopener">⭐ Leave a Google review</a>` : ''}
      ${rating <= 3 && waLink() ? `<a class="btn wa" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="${waLink()}">WhatsApp us</a>` : ''}</div>`;
  }
  function draw() {
    const v = F.vehicle || {}, g = F.garage || {};
    if (F.done) { rating = F.rating || 5; return thanks(null); }
    app.innerHTML = `<div class="card"><h1>How did we do?</h1><p class="sub">${esc(g.name || 'mendtech.')} · ${esc([v.make, v.model].filter(Boolean).join(' '))} ${esc(v.plate || '')} · job ${esc(F.number || '')}</p>
      <div class="stars" id="st">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      <label for="cm">Anything to tell us? (optional)</label><textarea id="cm" maxlength="500" placeholder="What was good, what could be better"></textarea>
      <div id="er" class="err"></div><button class="btn" id="go" style="margin-top:12px">Send</button></div>`;
    const btns = [...app.querySelectorAll('#st button')];
    btns.forEach(b => b.onclick = () => { rating = +b.dataset.n; btns.forEach(x => x.classList.toggle('on', +x.dataset.n <= rating)); });
    app.querySelector('#go').onclick = async () => {
      const er = app.querySelector('#er'); if (!rating) { er.textContent = 'Tap the stars to choose 1 to 5'; return; }
      const b = app.querySelector('#go'); b.disabled = true; b.textContent = 'Sending…';
      try { const r = await rpc('public_feedback_submit', { p_token: token, p_rating: rating, p_comment: app.querySelector('#cm').value.trim() }); thanks(r && r.review); }
      catch (e) { er.textContent = e.message; b.disabled = false; b.textContent = 'Send'; }
    };
  }
  (async () => {
    if (!token || !CFG.supabaseUrl) { app.innerHTML = '<div class="card"><h1>Link not valid</h1><p class="muted">Please use the link we sent you on WhatsApp.</p></div>'; return; }
    try { F = await rpc('public_feedback', { p_token: token }); if (!F) throw new Error('This link is not valid'); draw(); }
    catch (e) { app.innerHTML = `<div class="card"><h1>Link not valid</h1><p class="muted">${esc(e.message)}</p></div>`; }
  })();
})();
