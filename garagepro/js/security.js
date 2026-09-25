/* GaragePro — Security Level 1: strong PIN hashing + lockout, Owner-PIN approvals,
   password-protected backups, security alert log. */
'use strict';

const SEC = {
  PIN_RE: /^\d{6,8}$/,        // new and changed PINs: 6–8 digits
  PIN_ITER: 150000,           // PBKDF2-SHA256 rounds for PINs
  BACKUP_ITER: 310000,        // PBKDF2-SHA256 rounds for backup passwords
  MAX_TRIES: 5,               // wrong PINs before the login locks
  LOCK_MIN: 15,               // first lockout; doubles on every further wrong PIN, max 24 h
};

/* ---------- bytes helpers ---------- */
const secRand = n => crypto.getRandomValues(new Uint8Array(n));
const toHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const fromHex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
function toB64(bytes) {
  const u = new Uint8Array(bytes); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function pbkdf2Bits(secret, salt, iter, bits = 256) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, bits);
}

/* ---------- PINs ----------
   New format: "pbkdf2$<rounds>$<salt hex>$<hash hex>". Old v3.0 hashes (plain SHA-256) still unlock,
   then the person must choose a new 6-digit PIN before continuing. */
async function hashPinStrong(pin) {
  const salt = secRand(16);
  return `pbkdf2$${SEC.PIN_ITER}$${toHex(salt)}$${toHex(await pbkdf2Bits('garagepro:' + pin, salt, SEC.PIN_ITER))}`;
}
async function legacyHashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('garagepro:' + pin));
  return toHex(buf);
}
const isStrongPinHash = h => typeof h === 'string' && h.startsWith('pbkdf2$');
async function verifyPin(staff, pin) {
  const h = staff && staff.pinHash;
  if (!h || !pin) return false;
  if (isStrongPinHash(h)) {
    const [, iter, salt, hash] = h.split('$');
    const got = toHex(await pbkdf2Bits('garagepro:' + pin, fromHex(salt), +iter));
    let diff = got.length ^ hash.length;
    for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
    return diff === 0;
  }
  return (await legacyHashPin(pin)) === h;
}

/* ---------- lockout (kept on this device) ---------- */
const PinGuard = {
  key: 'gp_pin_fails',
  all() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { return {}; } },
  put(m) { try { localStorage.setItem(this.key, JSON.stringify(m)); } catch (e) { } },
  state(id) { return this.all()[id] || { n: 0, until: 0 }; },
  lockedFor(id) { const s = this.state(id); return s.until > Date.now() ? Math.ceil((s.until - Date.now()) / 60000) : 0; },
  triesLeft(id) { return Math.max(0, SEC.MAX_TRIES - this.state(id).n); },
  clear(id) { const m = this.all(); delete m[id]; this.put(m); },
  fail(staff) {
    const m = this.all(), s = m[staff.id] || { n: 0, until: 0 };
    s.n++;
    if (s.n >= SEC.MAX_TRIES) {
      const mins = Math.min(24 * 60, SEC.LOCK_MIN * 2 ** (s.n - SEC.MAX_TRIES));
      s.until = Date.now() + mins * 60000;
      secLog('lockout', `${staff.name}'s login locked for ${fmtMins(mins)} after ${s.n} wrong PINs`, 'alert');
    } else if (s.n === 3) secLog('pin-fail', `3 wrong PINs in a row for ${staff.name}`, 'warn');
    m[staff.id] = s; this.put(m);
    return s;
  },
  /* one place for every PIN check: honours the lockout, counts failures, resets on success */
  async check(staff, pin) {
    const wait = this.lockedFor(staff.id);
    if (wait) return { ok: false, msg: `Too many wrong PINs — ${staff.name}'s login is locked for ${fmtMins(wait)}.` };
    if (await verifyPin(staff, pin)) {
      if (this.state(staff.id).n >= 3) secLog('pin-ok', `${staff.name} signed in after ${this.state(staff.id).n} wrong PINs`, 'warn');
      this.clear(staff.id); return { ok: true };
    }
    const s = this.fail(staff);
    if (s.until > Date.now()) return { ok: false, msg: `Too many wrong PINs — locked for ${fmtMins(this.lockedFor(staff.id))}.` };
    return { ok: false, msg: `Wrong PIN — ${this.triesLeft(staff.id)} ${this.triesLeft(staff.id) === 1 ? 'try' : 'tries'} left` };
  },
};

/* ---------- security alert log (synced to every device via the "secLog" collection) ---------- */
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'browser';
  return `${br} on ${os}`;
}
function secLog(type, text, level = 'info') {
  if (!S.secLog || !DB.db) return;
  save('secLog', { at: new Date().toISOString(), type, text, level, user: currentUserName() || (Auth && Auth.active ? '' : 'No login'), device: deviceLabel() }).catch(() => { });
  if (level !== 'info' && typeof renderNav === 'function') setTimeout(renderNav, 50);
}
function secUnread() {
  const seen = S.settings.secSeenAt || '';
  return S.secLog.filter(e => e.level !== 'info' && (e.at || '') > seen).length;
}
/* Only the Owner (or anyone, while no staff logins exist) sees the alerts */
const secCanSee = () => !Auth.active || (Auth.user && Auth.user.role === 'owner');
async function secMarkSeen() { S.settings.secSeenAt = new Date().toISOString(); await saveSettings(); render(); }
function secAlertsHTML() {
  const list = [...S.secLog].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 150);
  const seen = S.settings.secSeenAt || '', unread = secUnread();
  const ico = { alert: ['var(--redSoft)', '⛔'], warn: ['var(--amberSoft, #fef3c7)', '⚠'], info: ['var(--graySoft)', '•'] };
  return `<div class="card mb"><div class="card-head"><h3>🚨 Security alerts ${unread ? `<span class="badge">${unread} new</span>` : ''}</h3>
      <div class="actions">${unread ? `<button class="btn sm" onclick="secMarkSeen()">Mark all as read</button>` : ''}</div></div>
    ${list.length ? list.map(e => { const [bg, i] = ico[e.level] || ico.info; const isNew = e.level !== 'info' && (e.at || '') > seen; return `<div class="alert-row" ${isNew ? 'style="font-weight:600"' : ''}><div class="alert-ico" style="background:${bg}">${i}</div>
      <div class="grow">${esc(e.text)}<div class="small faint">${esc(new Date(e.at).toLocaleString('en-GB'))} · ${esc(e.user || '—')} · ${esc(e.device || '')}</div></div></div>`; }).join('')
      : '<div class="card-pad muted">No security events yet. Wrong PINs, lockouts, Owner approvals, voided invoices, deleted payments, reopened months, bank-detail changes and backups will be listed here.</div>'}</div>`;
}

/* ---------- Owner-PIN approval ----------
   Resolves to { by: '<owner name>' } when approved, or false.
   - No staff logins yet: nothing to check against, the action goes ahead (and is logged).
   - The Owner is signed in: goes ahead without a PIN, unless opts.always (e.g. bank details).
   - Anyone else: an active Owner must type their PIN on this device. */
function ownerApprove(what, opts = {}) {
  // one approval box at a time (e.g. a field firing "change" twice). A box that a page redraw
  // removed counts as cancelled, so a lost box never blocks later approvals.
  if (ownerApprove.el) { if (ownerApprove.el.isConnected) return Promise.resolve(false); ownerApprove.cancel(); }
  return ownerApproveNow(what, opts);
}
ownerApprove.pending = () => !!(ownerApprove.el && ownerApprove.el.isConnected);
function ownerApproveNow(what, opts) {
  if (Cloud.accounts) return cloudApprove(what, opts);   // Level 2: the server checks the Owner's approval PIN
  const me = currentUserName();
  if (!Auth.active) { secLog('approval', `${what} (no staff logins set up)`, opts.level || 'info'); return Promise.resolve({ by: '' }); }
  if (Auth.user && Auth.user.role === 'owner' && !opts.always) { secLog('approval', `${what} — by Owner ${me}`, 'info'); return Promise.resolve({ by: me }); }
  const owners = S.staff.filter(s => s.role === 'owner' && s.active !== false && s.pinHash);
  if (!owners.length) { toast('No active Owner login to approve this', 'err'); return Promise.resolve(false); }
  const selfOwner = Auth.user && Auth.user.role === 'owner';
  return new Promise(resolve => {
    const m = openModal({
      title: selfOwner ? 'Confirm with your PIN' : 'Owner approval needed', size: 'narrow',
      body: `<p style="margin-top:0">${esc(what)}</p>
        ${selfOwner ? '' : `<p class="small muted">Requested by <b>${esc(me || 'this device')}</b>. The Owner must type their PIN here.</p>`}
        ${owners.length > 1 && !selfOwner ? `<div class="field"><label>Owner</label><select id="oa_who">${owners.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label>${selfOwner ? 'Your' : 'Owner'} PIN</label><input id="oa_pin" class="inp center" type="password" inputmode="numeric" maxlength="8" autocomplete="off" style="font-size:20px;letter-spacing:.3em"></div>
        <div id="oa_err" class="small red"></div>`,
      foot: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Approve</button>`,
    });
    let done = false;
    const finish = v => { if (done) return; done = true; ownerApprove.el = null; m.close(); resolve(v); };
    const deny = () => { if (!done) secLog('approval-cancel', `Not approved: ${what}`, 'info'); finish(false); };
    ownerApprove.el = m.el; ownerApprove.cancel = deny;
    m.el.querySelector('[data-no]').onclick = deny;
    m.el.querySelector('[data-close]').onclick = deny;
    const go = async () => {
      const whoSel = m.el.querySelector('#oa_who');
      const owner = selfOwner ? Auth.user : whoSel ? get('staff', whoSel.value) : owners[0];
      const r = await PinGuard.check(owner, m.el.querySelector('#oa_pin').value);
      if (!r.ok) { m.el.querySelector('#oa_err').textContent = r.msg; m.el.querySelector('#oa_pin').value = ''; m.el.querySelector('#oa_pin').focus(); if (!selfOwner) secLog('approval-fail', `Wrong Owner PIN for: ${what}`, 'warn'); return; }
      secLog('approval', `${what} — approved by Owner ${owner.name}${selfOwner ? '' : ' for ' + (me || 'this device')}`, opts.level || 'warn');
      finish({ by: owner.name });
    };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelector('#oa_pin').onkeydown = e => { if (e.key === 'Enter') go(); };
  });
}

/* ---------- discounts ---------- */
function discountLimit() { const v = S.settings.security && S.settings.security.discountLimit; return v === '' || v == null ? 10 : num(v); }
function discountPct(doc) {
  const t = calcDoc(doc);
  if (t.subtotal > 0) return r2(t.discount / t.subtotal * 100);
  return doc.discountType === 'amt' ? (num(doc.discount) > 0 ? 100 : 0) : num(doc.discount);
}

/* ---------- password-protected backups (AES-GCM 256, key from PBKDF2) ---------- */
async function backupKey(password, salt, iter) {
  const bits = await pbkdf2Bits(password, salt, iter);
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptBackup(obj, password) {
  const salt = secRand(16), iv = secRand(12);
  const key = await backupKey(password, salt, SEC.BACKUP_ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { app: 'GaragePro', format: 'encrypted', v: 1, version: obj.version, exportedAt: obj.exportedAt, kdf: 'PBKDF2-SHA256', iter: SEC.BACKUP_ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
}
async function decryptBackup(file, password) {
  const key = await backupKey(password, fromB64(file.salt), file.iter);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data)); }
  catch (e) { throw new Error('Wrong backup password'); }
  return JSON.parse(new TextDecoder().decode(plain));
}
/* modal: ask for a password (twice when creating) */
function askPassword({ title, text, confirm = false, okLabel = 'OK' }) {
  return new Promise(resolve => {
    const m = openModal({
      title, size: 'narrow',
      body: `${text ? `<p style="margin-top:0">${text}</p>` : ''}<div class="field"><label>Password</label><input id="bp_1" type="password" autocomplete="new-password"></div>
        ${confirm ? '<div class="field"><label>Type it again</label><input id="bp_2" type="password" autocomplete="new-password"></div>' : ''}<div id="bp_err" class="small red"></div>`,
      foot: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>${okLabel}</button>`,
    });
    const err = t => { m.el.querySelector('#bp_err').textContent = t; };
    m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(null); };
    m.el.querySelector('[data-close]').onclick = () => { m.close(); resolve(null); };
    const go = () => {
      const p1 = m.el.querySelector('#bp_1').value;
      if (confirm) {
        if (p1.length < 8) return err('Use at least 8 characters');
        if (p1 !== m.el.querySelector('#bp_2').value) return err('The two passwords are different');
      } else if (!p1) return err('Enter the password');
      m.close(); resolve(p1);
    };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
  });
}

/* ---------- force a new 6-digit PIN (old 4-digit PINs from v3.0) ---------- */
function askNewPin(staff) {
  return new Promise(resolve => {
    const m = openModal({
      title: 'Choose a new 6-digit PIN', size: 'narrow',
      body: `<p style="margin-top:0">Hi ${esc(staff.name)} — GaragePro now uses stronger PINs. Please choose a new PIN of <b>6 to 8 digits</b>. Don't use your birthday, phone number or 123456.</p>
        <div class="field"><label>New PIN</label><input id="np_1" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div>
        <div class="field"><label>Type it again</label><input id="np_2" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div><div id="np_err" class="small red"></div>`,
      foot: `<button class="btn primary" data-yes>Save new PIN</button>`, sticky: true,
    });
    m.el.querySelector('[data-close]').style.display = 'none';
    const go = async () => {
      const p1 = m.el.querySelector('#np_1').value, err = m.el.querySelector('#np_err');
      const bad = pinProblem(p1);
      if (bad) { err.textContent = bad; return; }
      if (p1 !== m.el.querySelector('#np_2').value) { err.textContent = 'The two PINs are different'; return; }
      staff.pinHash = await hashPinStrong(p1); await save('staff', staff);
      secLog('pin-change', `${staff.name} set a new 6-digit PIN`, 'info');
      m.close(); resolve(true);
    };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
  });
}
function pinProblem(pin) {
  if (!SEC.PIN_RE.test(pin)) return 'PIN must be 6–8 digits';
  if (/^(\d)\1+$/.test(pin)) return 'PIN cannot be the same digit repeated';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN cannot be a simple sequence';
  return '';
}

/* ---------- live-site security headers check (Settings → Staff & security) ---------- */
async function checkSecurityHeaders() {
  const el = document.getElementById('secHeaders'); if (!el) return;
  if (!/^https?:/.test(location.protocol)) { el.innerHTML = secCheckRow(true, 'Running from this PC (offline copy) — website security headers apply to the online version'); return; }
  try {
    const r = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
    const ok = !!(r.headers.get('content-security-policy') && r.headers.get('x-frame-options'));
    el.innerHTML = secCheckRow(ok, ok ? 'Website security headers are active' : 'Website security headers missing — publish the whole folder (including the _headers file) to Netlify');
  } catch (e) { el.innerHTML = ''; }
}
const secCheckRow = (ok, t) => `<div class="alert-row"><div class="alert-ico" style="background:${ok ? 'var(--greenSoft)' : 'var(--redSoft)'}">${ok ? '✔' : '⚠'}</div><div class="grow">${esc(t)}</div></div>`;
