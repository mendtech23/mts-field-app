/* GaragePro — public booking page. Sends a request to the garage's online inbox.
   Live: inserts into the Supabase `requests` table (the page can only add, never read).
   Preview: writes into the GaragePro preview database in this browser. */
'use strict';
(function () {
  const CFG = window.GP_CONFIG || {};
  const LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey && CFG.garageId);
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAKES = ['Toyota', 'Nissan', 'Lexus', 'Honda', 'Mitsubishi', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'GMC', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Land Rover', 'Porsche', 'Jeep', 'Dodge', 'Mazda', 'Infiniti', 'Suzuki', 'Tesla', 'MG', 'Geely', 'Chery', 'Changan', 'Haval', 'Peugeot', 'Renault', 'Volvo', 'Jetour', 'BYD'];
  $('#makes').innerHTML = MAKES.map(m => `<option value="${m}">`).join('');

  let brand = CFG.brand || null, type = 'mobile', urgency = 'urgent', service = '', lat = null, lng = null, photo = '';

  const defaults = {
    name: 'MendTech Auto', mobile: 'MendTech Mobile', phone: 'Call +971 55 957 4148 · WhatsApp +971 52 233 8499', whatsapp: '+971 52 233 8499', logo: '',
    services: ['Battery test / replacement', 'Jump start', 'Flat tyre / puncture', 'Minor service at your location', 'AC gas top-up', 'Bulbs, wipers & fuses', 'Brake pads', 'Diagnostics (warning light)', "Car won't start", 'Other / not sure'],
    workshopServices: ['Periodic service', 'Brakes', 'AC repair', 'Electrical', 'Suspension & steering', 'Diagnostics', 'Tyres & alignment', 'Bodywork & paint', 'Other / not sure'],
    hoursStart: '08:00', hoursEnd: '20:00', allDay: false,
  };
  function readPreviewSettings() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(CFG.dbName || 'garagepro-preview');
      req.onupgradeneeded = () => { req.transaction.abort(); resolve(null); };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) { db.close(); return resolve(null); }
        const g = db.transaction('meta').objectStore('meta').get('settings');
        g.onsuccess = () => { const st = g.result; db.close(); if (!st) return resolve(null);
          const m = st.mob || {};
          resolve({ name: st.garageName, mobile: st.brandMobile, phone: [st.phone ? 'Call ' + st.phone : '', st.whatsapp ? 'WhatsApp ' + st.whatsapp : ''].filter(Boolean).join(' · '), whatsapp: st.whatsapp || st.mobile || st.phone, logo: st.logo, services: m.services, workshopServices: m.workshopServices, hoursStart: m.hoursStart, hoursEnd: m.hoursEnd, allDay: m.allDay, address: st.address }); };
        g.onerror = () => { db.close(); resolve(null); };
      };
    });
  }
  function waDigits(p) { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) return d.slice(1); if (d.startsWith('00')) return d.slice(2); if (d.startsWith('971')) return d; if (d.startsWith('0')) d = d.slice(1); return d ? '971' + d : ''; }

  function applyBrand() {
    const b = Object.assign({}, defaults, brand || {});
    brand = b;
    $('#bname').textContent = type === 'mobile' ? 'We come to you' : 'Book a workshop visit';
    $('#bsub').textContent = type === 'mobile' ? 'mendtech. mobile — Dubai & Sharjah' : 'mendtech. auto — ' + (b.address || 'our workshop');
    document.title = `Book a service — ${type === 'mobile' ? (b.mobile || b.name) : b.name}`;
    if (b.address) $('#wsAddr').textContent = b.address;
    $('#footTxt').textContent = ['mendtech. auto · mobile', b.phone].filter(Boolean).join(' · ');
    const list = type === 'mobile' ? b.services : b.workshopServices;
    $('#svc').innerHTML = (list || []).map(s => `<button type="button" class="chip ${s === service ? 'on' : ''}">${esc(s)}</button>`).join('');
    $('#svc').querySelectorAll('.chip').forEach(c => c.onclick = () => { service = c.textContent; $('#svc').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); });
    // time windows within opening hours
    const start = +(b.hoursStart || '08:00').slice(0, 2), end = +(b.hoursEnd || '20:00').slice(0, 2), wins = [];
    for (let h = start; h + 2 <= end; h += 2) wins.push(`${String(h).padStart(2, '0')}:00–${String(h + 2).padStart(2, '0')}:00`);
    $('#win').innerHTML = wins.map(w => `<option>${w}</option>`).join('');
    $('#hoursNote').textContent = b.allDay ? 'We operate 24/7.' : `Working hours ${b.hoursStart}–${b.hoursEnd}. Urgent calls outside these hours may carry an after-hours charge.`;
    $('#locCard').classList.toggle('hidden', type !== 'mobile');
    $('#urgRow').classList.toggle('hidden', type !== 'mobile');
    if (type !== 'mobile') { urgency = 'scheduled'; }
    $('#sched').classList.toggle('hidden', urgency !== 'scheduled');
    $('#whenTitle').textContent = type === 'mobile' ? '4. When?' : '3. When?';
  }
  document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    type = b.dataset.type; service = '';
    document.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === b));
    if (type === 'mobile') { urgency = 'urgent'; document.querySelectorAll('[data-urg]').forEach(x => x.classList.toggle('on', x.dataset.urg === 'urgent')); }
    applyBrand();
  });
  document.querySelectorAll('[data-urg]').forEach(b => b.onclick = () => {
    urgency = b.dataset.urg; document.querySelectorAll('[data-urg]').forEach(x => x.classList.toggle('on', x === b));
    $('#sched').classList.toggle('hidden', urgency !== 'scheduled');
  });
  const d0 = new Date(); $('#date').value = new Date(d0.getTime() - d0.getTimezoneOffset() * 60000).toISOString().slice(0, 10); $('#date').min = $('#date').value;

  $('#gps').onclick = () => {
    if (!navigator.geolocation) { $('#gpsMsg').textContent = 'Location not available on this device'; return; }
    $('#gpsMsg').textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(p => { lat = +p.coords.latitude.toFixed(6); lng = +p.coords.longitude.toFixed(6); $('#gpsMsg').innerHTML = `<span class="ok">✓ Location added (±${Math.round(p.coords.accuracy)} m)</span>`; },
      () => { $('#gpsMsg').textContent = 'Could not get location — please type the area'; }, { enableHighAccuracy: true, timeout: 12000 });
  };
  $('#photo').onchange = e => {
    const f = e.target.files[0]; if (!f) { photo = ''; return; }
    const img = new Image();
    img.onload = () => { const s = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); photo = c.toDataURL('image/jpeg', 0.7); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };

  async function sendLive(data) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/requests`, {
      method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ garage: CFG.garageId, data }),
    });
    if (!r.ok) {
      let msg = ''; try { msg = (await r.json()).message || ''; } catch (x) { }
      if (msg.startsWith('RATE_LIMIT: ')) throw new Error(msg.slice(12));
      throw new Error('Could not send (' + r.status + '). Please try again or contact us on WhatsApp.');
    }
  }
  function sendPreview(data) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CFG.dbName || 'garagepro-preview');
      req.onupgradeneeded = () => { req.transaction.abort(); };
      req.onerror = () => reject(new Error('Open the GaragePro preview app once on this computer first.'));
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('requests')) { db.close(); return reject(new Error('Open the GaragePro preview app once on this computer first.')); }
        const now = new Date().toISOString();
        const rec = { ...data, id: 'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), status: 'New', createdAt: now, updatedAt: now, receivedAt: now };
        const tx = db.transaction('requests', 'readwrite'); tx.objectStore('requests').put(rec);
        tx.oncomplete = () => { db.close(); try { new BroadcastChannel('garagepro-requests').postMessage('new'); } catch (e) { } resolve(rec.id); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }

  $('#f').onsubmit = async e => {
    e.preventDefault(); $('#err').textContent = '';
    const v = id => $(id).value.trim();
    const fail = (msg, el) => { $('#err').textContent = msg; if (el) $(el).focus(); };
    if ($('#website').value) return;   // spam trap
    if (!service) return fail('Please choose what you need.');
    if (!v('#make') || !v('#model')) return fail('Please enter the make and model of your car.', v('#make') ? '#model' : '#make');
    if (type === 'mobile' && !v('#area') && lat == null) return fail('Please tell us the area, or tap “Use my current location”.', '#area');
    if (!v('#name')) return fail('Please enter your name.', '#name');
    if (v('#phone').replace(/\D/g, '').length < 9) return fail('Please enter a valid mobile number.', '#phone');
    if (!$('#consent').checked) return fail('Please tick the box to agree to be contacted.');
    try { const last = +localStorage.getItem('gp_book_last') || 0; if (Date.now() - last < 60000) return fail('Request already sent — please wait a minute before sending another.'); } catch (x) { }
    const data = {
      serviceType: type, service, notes: v('#notes').slice(0, 800), make: v('#make'), model: v('#model'), year: v('#year'), plate: v('#plate').toUpperCase(),
      emirate: type === 'mobile' ? v('#emirate') : '', area: type === 'mobile' ? v('#area') : '', address: type === 'mobile' ? v('#address') : '', lat, lng,
      urgency: type === 'mobile' ? urgency : 'scheduled', date: urgency === 'scheduled' || type !== 'mobile' ? v('#date') : '', timeWindow: urgency === 'scheduled' || type !== 'mobile' ? v('#win') : '',
      time: urgency === 'scheduled' || type !== 'mobile' ? v('#win').slice(0, 5) : '', name: v('#name').slice(0, 80), phone: v('#phone').slice(0, 20), photo, source: 'booking page',
    };
    $('#send').disabled = true; $('#send').textContent = 'Sending…';
    try {
      if (LIVE) await sendLive(data); else await sendPreview(data);
      try { localStorage.setItem('gp_book_last', Date.now()); } catch (x) { }
      const ref = 'BK-' + Date.now().toString(36).slice(-6).toUpperCase();
      $('#refNo').textContent = ref;
      const b = brand || defaults;
      const msg = `Hello ${type === 'mobile' ? b.mobile : b.name}, I just sent a booking request (${ref}): ${service} for my ${data.make} ${data.model}${data.plate ? ' ' + data.plate : ''}. — ${data.name}`;
      const wa = waDigits(b.whatsapp || b.phone);
      $('#waBtn').href = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : '#';
      if (!wa) $('#waBtn').style.display = 'none';
      $('#f').classList.add('hidden'); $('#done').classList.remove('hidden'); window.scrollTo(0, 0);
    } catch (x) { fail(x.message); }
    finally { $('#send').disabled = false; $('#send').textContent = 'Send request'; }
  };

  (async () => {
    if (!LIVE) { $('#previewBanner').classList.remove('hidden'); brand = await readPreviewSettings(); }
    applyBrand();
  })();
})();
