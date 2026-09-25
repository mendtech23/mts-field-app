/* mendtech. — Security Level 2 (v3.4), the app side.
   Personal cloud logins (Owner: e-mail + password + authenticator code; staff: username + password), the Owner's
   staff / devices / audit log / alerts screens, Owner approvals checked by the server, and the Technician & Driver
   sync that only ever receives their own jobs. The database enforces every rule (garagepro-cloud/sql/level2.sql);
   these screens are the controls. */
'use strict';

const CLOUD_ROLES = ['manager', 'advisor', 'technician', 'driver'];
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { } };
const ssDel = k => { try { sessionStorage.removeItem(k); } catch (e) { } };

const Cloud = {
  me: null,        // whoami from the server (kept for offline start)
  level2: false,   // the server has the Level 2 script
  init() {
    try { this.me = JSON.parse(lsGet('gp_cloud_me') || 'null'); } catch (e) { this.me = null; }
    this.level2 = !!this.me;
  },
  /* personal logins are in use on this device (sticky once seen) */
  get accounts() {
    if (IS_PREVIEW && !CFG.previewCloud) return false;
    if (CFG.accounts || lsGet('gp_accounts') === '1') return true;
    return !!(this.me && this.me.role && (this.me.role !== 'owner' || this.me.mfa_enrolled));
  },
  get role() { return this.me && this.me.role; },
  get crew() { return this.accounts && ['technician', 'driver'].includes(this.role); },
  isOwner() { return this.role === 'owner'; },
  /* the session supabase-js keeps on this device (works offline) */
  stored() { try { const s = JSON.parse(lsGet('gp_sb_auth') || 'null'); return s && s.refresh_token && s.user ? s : null; } catch (e) { return null; } },
  signedIn() { const s = this.stored(); return !!(s && this.me && this.me.role && s.user.id === this.me.user_id); },
  needsCode() { return !!(this.me && this.me.role === 'owner' && this.me.mfa_enrolled && this.me.aal !== 'aal2'); },
  user() {
    const m = this.me; if (!m || !m.role) return null;
    return { id: m.user_id, name: m.name || 'Owner', role: m.role, techId: m.tech_id || '', title: m.title || '', username: m.username || '', cloud: true, active: true };
  },
  keep() { if (this.me) lsSet('gp_cloud_me', JSON.stringify(this.me)); else lsDel('gp_cloud_me'); if (this.accounts) lsSet('gp_accounts', '1'); },
  get sb() { return Sync.client; },

  async rpc(fn, args) {
    if (!Sync.client) await Sync.connect();
    const { data, error } = await Sync.client.rpc(fn, args || {});
    if (error) { const e = new Error(error.message); e.code = error.code; throw e; }
    return data;
  },
  /* Edge Functions (login, staff-admin) */
  async fn(name, body) {
    if (!Sync.client) await Sync.connect();
    const { data: s } = await Sync.client.auth.getSession();
    const token = s && s.session ? s.session.access_token : '';
    const key = Sync.cfg.key;
    const h = { 'Content-Type': 'application/json', apikey: key };
    if (token) h.Authorization = 'Bearer ' + token; else if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
    let r;
    try { r = await fetch(`${Sync.cfg.url}/functions/v1/${name}`, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error(navigator.onLine ? 'Cannot reach the cloud — try again' : 'No internet connection'); }
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const e = new Error(j.message || j.error || `Server error ${r.status}`); e.status = r.status; e.code = j.error; throw e; }
    return j;
  },
  async refresh() {
    try { this.me = await this.rpc('whoami'); this.level2 = true; }
    catch (e) {
      if (e.code === 'PGRST202' || e.code === '42883' || /function .*whoami/i.test(e.message)) { this.level2 = false; this.me = null; this.keep(); return null; }
      throw e;
    }
    this.keep(); return this.me;
  },

  /* ---------- sign in / out ---------- */
  async signIn(login, password) {
    if (!Sync.cfg.url || !Sync.cfg.key) throw new Error('This device is not connected to the cloud yet');
    if (!Sync.client) await Sync.connect();
    let session;
    try { session = (await this.fn('login', { login, password })).session; }
    catch (e) {
      if (e.status !== 404 || !login.includes('@')) throw e;
      const { data, error } = await Sync.client.auth.signInWithPassword({ email: login, password });   // sign-in function not deployed yet
      if (error) throw new Error('Wrong e-mail or password');
      session = data.session;
    }
    const { data, error } = await Sync.client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (error) throw error;
    Sync.user = data.user || (data.session && data.session.user);
    Sync.cfg.enabled = true; Sync.saveCfg();
    const me = await this.refresh();
    if (!me) throw new Error('The cloud has not been upgraded to Security Level 2 yet');
    if (!me.role) { await this.forget(); throw new Error('This login is switched off. Ask the Owner.'); }
    lsSet('gp_accounts', '1');
    return this.needsCode() ? 'code' : 'ok';
  },
  async verifyCode(code) {
    const { data: f, error: e1 } = await Sync.client.auth.mfa.listFactors();
    if (e1) throw e1;
    const t = (f.totp || []).find(x => x.status === 'verified');
    if (!t) throw new Error('No authenticator app is set up on this login');
    const { error } = await Sync.client.auth.mfa.challengeAndVerify({ factorId: t.id, code: String(code).replace(/\D/g, '') });
    if (error) throw new Error(/invalid|expired|code/i.test(error.message) ? 'Wrong or expired code — type the newest code from the app' : error.message);
    await this.refresh();
  },
  /* signed in (and code done): make this device theirs, then start syncing */
  async begin() {
    await this.ensureScope();
    Auth.user = this.user(); ssSet('gp_unlocked', Auth.user.id);
    document.getElementById('lockScreen')?.remove(); document.body.classList.remove('locked-screen');
    this.hello();
    if (!lsGet('gp_lock_' + Auth.user.id)) await askLockPin(Auth.user);
    Sync.start();
    Auth.armIdle();
    if (!Auth.canPage(currentRoute()[0] || 'dashboard')) location.hash = '#/' + (Auth.role().home || 'dashboard');
    render(); toast(`Welcome, ${Auth.user.name}`, 'ok');
    if (this.isOwner()) this.alertToast();
  },
  async forget() {   // drop the session on this device
    Sync.stop();
    try { if (Sync.client) await Sync.client.auth.signOut({ scope: 'local' }); } catch (e) { }
    lsDel('gp_sb_auth');
    Sync.user = null; Auth.user = null; this.me = null; this.keep(); ssDel('gp_unlocked');
  },
  async signOut(skipAsk) {
    if (navigator.onLine && Sync.user) { try { await Sync.syncNow(); } catch (e) { } }
    const pend = await Sync.pendingCount();
    if (!skipAsk && pend && !(await confirmBox(`${pend} change(s) on this device are not uploaded yet (no internet?). If you sign out now they are uploaded the next time you sign in here.`, 'Sign out anyway', true))) return;
    await this.forget(); closeAllModals(); showCloudLogin();
  },
  /* the Owner signed this device out, or the login was switched off: nothing stays on the device */
  async revoked(reason) {
    await this.forget();
    await wipeLocalData(); await DB.del('meta', 'scope');
    closeAllModals(); showCloudLogin(reason);
  },
  async hello() {
    try {
      const r = await this.rpc('device_hello', { p_label: deviceLabel(), p_ua: navigator.userAgent.slice(0, 300) });
      if (r && r.revoked) await this.revoked(r.reason);
    } catch (e) { console.warn('device_hello', e.message); }
  },
  /* every 5 minutes: am I still allowed in? */
  async heartbeat() {
    if (!Sync.user || !navigator.onLine) return;
    try {
      const was = this.me && this.me.role, me = await this.refresh();
      if (!me) return;
      if (!me.role) return this.revoked('Your login was switched off by the Owner.');
      if (!me.session_ok) return this.revoked('This device was signed out by the Owner.');
      if (was && me.role !== was) { toast(`Your role changed to ${(ROLES[me.role] || {}).label || me.role} — reloading`, ''); await this.ensureScope(); Auth.user = this.user(); ssSet('gp_unlocked', Auth.user.id); render(); }
      await this.hello();
    } catch (e) { console.warn('heartbeat', e.message); }
  },

  /* ---------- whose data is on this device ----------
     Office logins share the garage data; Technicians / Drivers only have their own jobs. When a different kind of login
     signs in here, the local copy is emptied and downloaded again for that person. */
  scopeOf(m) { return m.garage_id + ':' + (['technician', 'driver'].includes(m.role) ? 'crew:' + m.user_id : m.role); },
  async ensureScope() {
    const want = this.scopeOf(this.me);
    const cur = ((await DB.all('meta')).find(x => x.id === 'scope') || {}).v || (this.me.garage_id + ':owner');   // no mark = data of the old shared garage login
    if (cur === want) { await DB.put('meta', { id: 'scope', v: want }); return false; }
    if (!this.crew && navigator.onLine && (await Sync.pendingCount())) { try { await Sync.push(); } catch (e) { console.warn('push before switching', e); } }
    await wipeLocalData();
    await DB.put('meta', { id: 'scope', v: want });
    return true;
  },
  async alertToast() {
    try {
      const { count } = await Sync.client.from('alerts').select('id', { count: 'exact', head: true }).eq('seen', false).neq('level', 'info');
      if (count) setTimeout(() => toast(`🚨 ${count} new security alert(s) — Settings → Staff & security`, 'err'), 900);
    } catch (e) { }
  },
};
Cloud.init();

/* empty this device (collections, photos, sync position) — the cloud copy is untouched */
async function wipeLocalData() {
  for (const c of COLLECTIONS) { await DB.clear(c); S[c] = []; }
  await DB.clear('photos');
  for (const id of ['sync', 'tombs', 'settingsBase']) await DB.del('meta', id);
  S.settings = structuredClone(DEFAULT_SETTINGS); S.settings.updatedAt = '';
  await DB.put('meta', S.settings);
}

function deviceLabel() {
  const saved = lsGet('gp_device_label'); if (saved) return saved;
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /Windows/.test(ua) ? 'Windows PC' : /Mac OS/.test(ua) ? 'Mac' : 'Computer';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${br}`;
}
async function renameDevice() {
  const m = openModal({ title: 'Name this device', size: 'narrow',
    body: `<div class="field"><label>Device name (the Owner sees it in the devices list)</label><input id="dv_n" maxlength="60" value="${esc(deviceLabel())}" placeholder="e.g. Front desk PC"></div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>` });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-s]').onclick = () => { const v = m.el.querySelector('#dv_n').value.trim(); if (v) lsSet('gp_device_label', v.slice(0, 60)); else lsDel('gp_device_label'); m.close(); toast('Saved — shows after the next sign-in', 'ok'); render(); };
}

/* ---------- screens: sign in, authenticator code, screen lock ---------- */
function lockShell(inner) {
  document.body.classList.add('locked-screen');
  let el = document.getElementById('lockScreen');
  if (!el) { el = document.createElement('div'); el.id = 'lockScreen'; document.body.appendChild(el); }
  el.innerHTML = `<div class="lock-card">
    <img class="lock-logo light" src="img/brand/logo.svg" alt="mendtech. auto · mobile"><img class="lock-logo dark" src="img/brand/logo-reverse.svg" alt="">
    ${inner}<p class="small faint center" style="margin-top:16px">mendtech. workshop app v${APP_VERSION}${IS_PREVIEW ? ' · PREVIEW' : ''}</p></div>`;
  return el;
}
function showCloudLogin(notice) {
  closeAllModals();
  const needCfg = !Sync.cfg.url || !Sync.cfg.key;
  const el = lockShell(`<p class="muted center" style="margin:0 0 14px">Sign in</p>
    ${notice ? `<div class="lock-note">${esc(notice)}</div>` : ''}
    ${needCfg ? `<div class="field"><label>Cloud address (Owner: from Supabase)</label><input id="cl_url" class="inp" placeholder="https://xxxx.supabase.co"></div>
      <div class="field"><label>Cloud key</label><input id="cl_key" class="inp" placeholder="publishable / anon key"></div>` : ''}
    <div class="field"><label>Username (Owner: your e-mail)</label><input id="cl_user" class="inp" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(lsGet('gp_last_login') || '')}"></div>
    <div class="field"><label>Password</label><input id="cl_pass" class="inp" type="password" autocomplete="current-password"></div>
    <div id="cl_err" class="small center lock-err"></div>
    <button class="btn primary lg" id="cl_go" style="width:100%;justify-content:center">Sign in</button>
    <p class="small faint center" style="margin:12px 0 0">Forgot your password? Ask the Owner to reset it.</p>`);
  const $e = s => el.querySelector(s), err = t => { $e('#cl_err').textContent = t || ''; };
  let busy = false;
  const go = async () => {
    if (busy) return;
    const login = $e('#cl_user').value.trim(), pass = $e('#cl_pass').value;
    if (!login || !pass) return err('Enter your username and password');
    if (needCfg) {
      const url = $e('#cl_url').value.trim().replace(/\/$/, ''), key = $e('#cl_key').value.trim();
      if (!/^https:\/\/.+/.test(url) || !key) return err('Enter the cloud address and key');
      Sync.cfg.url = url; Sync.cfg.key = key; Sync.client = null; Sync.saveCfg();
    }
    busy = true; $e('#cl_go').disabled = true; err('Signing in…');
    try {
      const r = await Cloud.signIn(login, pass);
      lsSet('gp_last_login', login.includes('@') ? '' : login);
      if (r === 'code') showCodeScreen(); else await Cloud.begin();
    } catch (e) { err(e.message || String(e)); $e('#cl_pass').value = ''; $e('#cl_pass').focus(); }
    finally { busy = false; const b = $e('#cl_go'); if (b) b.disabled = false; }
  };
  $e('#cl_go').onclick = go;
  el.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
  setTimeout(() => ($e('#cl_user').value ? $e('#cl_pass') : $e('#cl_user')).focus(), 50);
}
function showCodeScreen() {
  const el = lockShell(`<p class="muted center" style="margin:0 0 6px">Authenticator code</p>
    <p class="small muted center" style="margin:0 0 14px">Open Google / Microsoft Authenticator on your phone and type the 6-digit code for <b>mendtech.</b></p>
    <input id="cd_in" class="inp center" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" style="font-size:24px;letter-spacing:.35em">
    <div id="cd_err" class="small center lock-err"></div>
    <button class="btn primary lg" id="cd_go" style="width:100%;justify-content:center">Verify</button>
    <p class="small center" style="margin:14px 0 0"><a href="#" id="cd_other">Sign in as someone else</a></p>`);
  const $e = s => el.querySelector(s), err = t => { $e('#cd_err').textContent = t || ''; };
  let busy = false;
  const go = async () => {
    const code = $e('#cd_in').value.replace(/\D/g, '');
    if (busy || code.length !== 6) return err(code.length ? 'The code has 6 digits' : '');
    busy = true; err('Checking…');
    try { await Cloud.verifyCode(code); await Cloud.begin(); }
    catch (e) { err(e.message); $e('#cd_in').value = ''; $e('#cd_in').focus(); }
    finally { busy = false; }
  };
  $e('#cd_go').onclick = go;
  $e('#cd_in').oninput = () => { if ($e('#cd_in').value.replace(/\D/g, '').length === 6) go(); };
  $e('#cd_other').onclick = async e => { e.preventDefault(); await Cloud.forget(); showCloudLogin(); };
  setTimeout(() => $e('#cd_in').focus(), 50);
}
/* the app locked itself (idle / opened again): the same person unlocks with their device PIN */
function showCloudLock() {
  const u = Cloud.user(); if (!u) return showCloudLogin();
  const pinHash = lsGet('gp_lock_' + u.id), who = { id: 'cloud:' + u.id, name: u.name, pinHash };
  const el = lockShell(`<div class="center" style="margin:0 0 12px"><span class="av lg">${esc(u.name.slice(0, 1).toUpperCase())}</span>
      <div style="font-weight:600;margin-top:6px">${esc(u.name)}</div><div class="small faint">${esc(u.title || (ROLES[u.role] || {}).label || '')}</div></div>
    ${pinHash ? `<input id="lk_in" class="inp center" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" autocomplete="off" style="font-size:22px;letter-spacing:.3em">`
      : `<input id="lk_in" class="inp" type="password" placeholder="Your password" autocomplete="current-password">`}
    <div id="lk_err" class="small center lock-err"></div>
    <button class="btn primary lg" id="lk_go" style="width:100%;justify-content:center">Unlock</button>
    <p class="small center" style="margin:14px 0 0"><a href="#" id="lk_out">Not ${esc(u.name)}? Sign out</a></p>`);
  const $e = s => el.querySelector(s), err = t => { $e('#lk_err').textContent = t || ''; };
  const wait = PinGuard.lockedFor(who.id); if (wait) err(`Locked after too many wrong PINs — sign out and sign in with your password`);
  let busy = false;
  const unlocked = () => { Auth.user = u; ssSet('gp_unlocked', u.id); el.remove(); document.body.classList.remove('locked-screen'); Auth.armIdle();
    if (!Auth.canPage(currentRoute()[0] || 'dashboard')) location.hash = '#/' + (Auth.role().home || 'dashboard'); render(); };
  const go = async () => {
    if (busy) return; busy = true;
    const v = $e('#lk_in').value;
    try {
      if (pinHash) {
        const r = await PinGuard.check(who, v);
        if (r.ok) return unlocked();
        $e('#lk_in').value = '';
        if (PinGuard.lockedFor(who.id)) { await Cloud.signOut(true); showCloudLogin('Too many wrong PINs — sign in with your password.'); return; }
        err(r.msg);
      } else {
        const s = Cloud.stored();
        if (!navigator.onLine) return err('No internet — your password cannot be checked. Set a PIN next time.');
        await Cloud.signIn(s.user.email, v);
        if (Cloud.needsCode()) return showCodeScreen();
        unlocked();
      }
    } catch (e) { err(e.message); } finally { busy = false; }
  };
  $e('#lk_go').onclick = go;
  $e('#lk_in').onkeydown = e => { if (e.key === 'Enter') go(); };
  $e('#lk_out').onclick = e => { e.preventDefault(); Cloud.signOut(); };
  setTimeout(() => $e('#lk_in').focus(), 50);
}
/* PIN for unlocking this device quickly (the password is still needed to sign in) */
function askLockPin(u, change) {
  return new Promise(resolve => {
    const m = openModal({
      title: change ? 'Change your screen-lock PIN' : 'Choose a screen-lock PIN', size: 'narrow', sticky: !change,
      body: `<p style="margin-top:0">${change ? '' : `Hi ${esc(u.name)} — the app locks itself when nobody uses it. `}Choose a PIN of <b>6 to 8 digits</b> to unlock it on <b>this device</b>. Your password is still needed to sign in.</p>
        <div class="field"><label>PIN</label><input id="lp_1" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div>
        <div class="field"><label>Type it again</label><input id="lp_2" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div><div id="lp_err" class="small red"></div>`,
      foot: `${change ? '<button class="btn" data-no>Cancel</button>' : ''}<button class="btn primary" data-yes>Save PIN</button>`,
    });
    if (!change) m.el.querySelector('[data-close]').style.display = 'none';
    else m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
    const go = async () => {
      const p1 = m.el.querySelector('#lp_1').value, bad = pinProblem(p1), er = m.el.querySelector('#lp_err');
      if (bad) return er.textContent = bad;
      if (p1 !== m.el.querySelector('#lp_2').value) return er.textContent = 'The two PINs are different';
      lsSet('gp_lock_' + u.id, await hashPinStrong(p1)); PinGuard.clear('cloud:' + u.id);
      m.close(); toast('PIN saved', 'ok'); resolve(true);
    };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
    setTimeout(() => m.el.querySelector('#lp_1').focus(), 50);
  });
}

/* ---------- Owner approval, checked by the server ----------
   Staff type the Owner's approval PIN; the server checks it (5 wrong → locked + alert) and allows exactly that
   change for 10 minutes. The Owner needs no PIN, except for opts.always (bank details, restore, erase). */
function cloudApprove(what, opts) {
  const me = Auth.user || {};
  if (me.role === 'owner' && !opts.always) return Promise.resolve({ by: me.name });
  if (!navigator.onLine || !Sync.user) { toast('Owner approval is checked online — connect to the internet and try again', 'err'); return Promise.resolve(false); }
  const self = me.role === 'owner';
  return new Promise(resolve => {
    const m = openModal({
      title: self ? 'Confirm with your approval PIN' : 'Owner approval needed', size: 'narrow',
      body: `<p style="margin-top:0">${esc(what)}</p>
        ${self ? '' : `<p class="small muted">Requested by <b>${esc(me.name || '')}</b>. The Owner types their <b>approval PIN</b> here. It is checked by the server; 5 wrong tries lock approvals and alert the Owner.</p>`}
        <div class="field"><label>Owner approval PIN</label><input id="oa_pin" class="inp center" type="password" inputmode="numeric" maxlength="8" autocomplete="off" style="font-size:20px;letter-spacing:.3em"></div>
        <div id="oa_err" class="small red"></div>`,
      foot: `<button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Approve</button>`,
    });
    let done = false, busy = false;
    const finish = v => { if (done) return; done = true; ownerApprove.el = null; m.close(); resolve(v); };
    ownerApprove.el = m.el; ownerApprove.cancel = () => finish(false);
    m.el.querySelector('[data-no]').onclick = () => finish(false);
    m.el.querySelector('[data-close]').onclick = () => finish(false);
    const err = t => { m.el.querySelector('#oa_err').textContent = t; };
    const go = async () => {
      if (busy) return; busy = true; err('Checking…');
      try {
        const r = await Cloud.rpc('approve_with_pin', { p_action: opts.action || 'confirm', p_target: opts.target || '-', p_detail: String(what).slice(0, 300), p_pin: m.el.querySelector('#oa_pin').value });
        if (r && r.ok) { finish({ by: self ? me.name : 'Owner (PIN)', approval: r.approval_id }); Sync.markDirty(); return; }
        if (r && r.error === 'PIN_NOT_SET' && self) { toast('Tip: set your approval PIN in Settings → Staff & security', ''); finish({ by: me.name }); return; }
        err((r && r.message) || 'Not approved'); m.el.querySelector('#oa_pin').value = ''; m.el.querySelector('#oa_pin').focus();
      } catch (e) { err(e.message); } finally { busy = false; }
    };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelector('#oa_pin').onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => m.el.querySelector('#oa_pin').focus(), 50);
  });
}

/* ---------- Settings → Cloud & devices (personal logins) ---------- */
function cloudAccountHTML() {
  const u = Auth.user || Cloud.user() || {}, s = Cloud.stored();
  return `<div class="grid g2">
    <div class="card card-pad"><h3>👤 My login</h3>
      <dl class="kv" style="grid-template-columns:130px 1fr">
        <dt>Name</dt><dd><b>${esc(u.name || '')}</b></dd>
        <dt>Role</dt><dd>${esc((ROLES[u.role] || {}).label || '')}${u.title ? ' · ' + esc(u.title) : ''}</dd>
        <dt>${u.role === 'owner' ? 'E-mail' : 'Username'}</dt><dd>${esc(u.role === 'owner' ? (s && s.user.email) || '' : u.username || '')}</dd>
        <dt>This device</dt><dd>${esc(deviceLabel())} <a href="#" onclick="event.preventDefault();renameDevice()">rename</a></dd>
        <dt>Cloud</dt><dd>${esc(Sync.status)}${Sync.lastSync ? ' · ' + Sync.lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}${Sync.detail ? `<div class="small red">${esc(Sync.detail)}</div>` : ''}</dd></dl>
      <div class="row mt"><button class="btn primary" onclick="Sync.syncNow().then(render)">⟳ Sync now</button>
        <button class="btn" onclick="changeMyPassword()">Change my password</button>
        <button class="btn" onclick="askLockPin(Auth.user, true)">Change my screen-lock PIN</button>
        <button class="btn" onclick="Auth.lock()">🔒 Lock</button>
        <button class="btn danger" onclick="Cloud.signOut()">Sign out</button></div>
      ${Cloud.isOwner() && !Cloud.crew ? `<div class="row mt-s"><button class="btn sm" onclick="resyncAll()">Download everything again</button></div>` : ''}</div>
    <div class="card card-pad"><h3>🔐 How this is protected</h3>
      <ul class="small muted" style="line-height:1.7;padding-left:18px;margin:0">
        <li>Everyone signs in with their own username and password. The Owner also needs the 6-digit authenticator code.</li>
        <li>What each login can see and change is enforced by the cloud database, not just hidden on screen.</li>
        <li>Voids, deletions, big discounts, payment links and bank details need the Owner's approval PIN, checked by the server.</li>
        <li>Every change is written to an audit log nobody can edit. The Owner gets e-mail alerts for anything important.</li>
        <li>The Owner can sign any device out instantly. 5 wrong passwords lock a login and alert the Owner.</li></ul></div></div>`;
}
async function changeMyPassword() {
  const p = await askPassword({ title: 'Change my password', text: 'At least 8 characters, with letters and numbers. You stay signed in on this device.', confirm: true, okLabel: 'Change password' });
  if (!p) return;
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return toast('At least 8 characters, with letters and numbers', 'err');
  const { error } = await Sync.client.auth.updateUser({ password: p });
  if (error) return toast(error.message, 'err');
  toast('Password changed', 'ok');
}

/* ---------- Settings → Staff & security (Owner, personal logins) ---------- */
const CL = { members: null, devices: [], alerts: [], audit: [], hasPin: false, email: '', factors: [], err: '', who: 'all', coll: 'all' };
const ROLE_OPTS = () => CLOUD_ROLES.map(r => [r, ROLES[r].label]);
const agoTxt = iso => { if (!iso) return '—'; const s = (Date.now() - new Date(iso)) / 1000; return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : fmtDate(iso.slice(0, 10)); };
const COLL_LABEL = { invoices: 'Invoice', quotes: 'Quotation', jobs: 'Job', payments: 'Payment', customers: 'Customer', vehicles: 'Vehicle', expenses: 'Expense', incomes: 'Other income', parts: 'Part', settings: 'Settings',
  photos: 'Photo', staff: 'Staff', technicians: 'Technician', renewals: 'Renewal', partners: 'Partner', campaigns: 'Campaign', bookings: 'Booking', suppliers: 'Supplier', purchaseOrders: 'Purchase order', stockAdjustments: 'Stock', labour: 'Labour', packages: 'Package', messages: 'Message', secLog: 'Security log' };

function cloudSecurityHTML() {
  setTimeout(loadCloudSecurity, 0);
  return `<div id="clSec"><div class="card card-pad muted">Loading security from the cloud…</div></div>`;
}
async function loadCloudSecurity() {
  const box = document.getElementById('clSec'); if (!box) return;
  if (!navigator.onLine || !Sync.user) { box.innerHTML = `<div class="card card-pad">📡 The security screens need internet. ${cloudLocalLockHTML()}</div>`; return; }
  try {
    const sb = Sync.client;
    const q = async p => { const { data, error } = await p; if (error) throw new Error(error.message); return data; };
    const [members, devices, alerts, audit, hasPin, email, factors] = await Promise.all([
      Cloud.fn('staff-admin', { action: 'list' }).catch(async e => { CL.err = e.message; return q(sb.from('members').select('*').order('created_at', { ascending: true })); }),
      q(sb.from('devices').select('*').order('last_seen', { ascending: false }).limit(100)),
      q(sb.from('alerts').select('*').order('id', { ascending: false }).limit(150)),
      q(sb.from('audit_log').select('*').order('id', { ascending: false }).limit(400)),
      Cloud.rpc('has_owner_pin'), Cloud.rpc('get_alert_email'),
      sb.auth.mfa.listFactors().then(r => (r.data && r.data.totp) || []).catch(() => [])]);
    if (Array.isArray(members) && !CL.err.startsWith('MFA')) CL.err = CL.err && /404|not found/i.test(CL.err) ? 'The staff-admin function is not deployed yet (setup guide step 4)' : CL.err;
    Object.assign(CL, { members, devices, alerts, audit, hasPin, email: email || '', factors: factors.filter(f => f.status === 'verified') });
    drawCloudSecurity();
  } catch (e) { box.innerHTML = `<div class="card card-pad red">Could not load security: ${esc(e.message)} <button class="btn sm" onclick="loadCloudSecurity()">Try again</button></div>`; }
}
function drawCloudSecurity() {
  const box = document.getElementById('clSec'); if (!box) return;
  const st = S.settings, lb = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), today()) : null;
  const staff = (CL.members || []).filter(m => m.role !== 'owner'), active = staff.filter(m => m.active);
  const unsent = CL.alerts.filter(a => a.level !== 'info' && !a.emailed && Date.now() - new Date(a.at) > 5 * 60000).length;
  const lastMail = CL.alerts.find(a => a.emailed);
  const checks = [
    [CL.factors.length > 0, CL.factors.length ? `Owner login needs the authenticator code (${CL.factors.length} phone${CL.factors.length > 1 ? 's' : ''})` : 'Authenticator app not set up on the Owner login'],
    [CL.hasPin, CL.hasPin ? 'Owner approval PIN is set (checked by the server)' : 'Owner approval PIN not set — staff cannot get approvals'],
    [!!CL.email, CL.email ? `Alerts e-mailed to ${CL.email}` : 'No alert e-mail set'],
    ...(CL.email ? [[!unsent, unsent ? `${unsent} alert(s) were not e-mailed — check the notify function and the Resend key (setup guide step 5)` : lastMail ? `Last alert e-mail sent ${agoTxt(lastMail.at)}` : 'Alert e-mails ready']] : []),
    [active.length > 0, `${active.length} active staff login(s)${staff.length > active.length ? `, ${staff.length - active.length} switched off` : ''}`],
    [lb != null && lb <= 31, lb == null ? 'No backup file downloaded yet' : `Last backup file ${lb} day(s) ago`],
  ];
  const unread = CL.alerts.filter(a => !a.seen && a.level !== 'info').length;
  const ico = { alert: ['var(--redSoft)', '⛔'], warn: ['var(--amberSoft, #fef3c7)', '⚠'], info: ['var(--graySoft)', '•'] };
  const name = uid => { const m = (CL.members || []).find(x => x.user_id === uid); return m ? m.name : '—'; };
  const people = [...new Set(CL.audit.map(a => a.who || 'system'))], colls = [...new Set(CL.audit.map(a => a.coll))];
  const aud = CL.audit.filter(a => (CL.who === 'all' || (a.who || 'system') === CL.who) && (CL.coll === 'all' || a.coll === CL.coll));
  box.innerHTML = `
    <div class="card mb"><div class="card-head"><h3>🛡 Security check</h3><div class="actions"><button class="btn sm" onclick="loadCloudSecurity()">⟳ Refresh</button></div></div>${checks.map(([ok, t]) => secCheckRow(ok, t)).join('')}<div id="secHeaders"></div></div>

    <div class="card mb"><div class="card-head"><h3>🚨 Alerts ${unread ? `<span class="badge">${unread} new</span>` : ''}</h3><div class="actions">${unread ? `<button class="btn sm" onclick="cloudAlertsSeen()">Mark all as read</button>` : ''}</div></div>
      ${CL.alerts.length ? `<div style="max-height:360px;overflow:auto">${CL.alerts.map(a => { const [bg, i] = ico[a.level] || ico.info, isNew = !a.seen && a.level !== 'info';
        return `<div class="alert-row" ${isNew ? 'style="font-weight:600"' : ''}><div class="alert-ico" style="background:${bg}">${i}</div><div class="grow">${esc(a.text)}
          <div class="small faint">${esc(new Date(a.at).toLocaleString('en-GB'))} · ${esc(a.user_name || '—')}${a.device ? ' · ' + esc(a.device) : ''}${a.emailed ? ' · ✉ e-mailed' : ''}</div></div></div>`; }).join('')}</div>`
      : '<div class="card-pad muted">No alerts yet.</div>'}</div>

    <div class="card mb"><div class="card-head"><h3>👥 Staff logins</h3><div class="actions">
        ${S.staff.some(s => s.active !== false && s.role !== 'owner') && !staff.length ? `<button class="btn sm" onclick="importPinStaff()">Copy from old PIN logins</button>` : ''}
        <button class="btn sm primary" onclick="editCloudStaff()">＋ Add login</button></div></div>
      ${CL.err ? `<div class="card-pad small red" style="padding-bottom:0">${esc(CL.err)}</div>` : ''}
      <div class="card-pad muted small" style="padding-bottom:0">Each person signs in with their own <b>username + password</b>. <b>Manager</b>: everything except staff logins, security, cloud and backups. <b>Service Advisor</b>: front desk, quotes, jobs, invoices, payments, stock, follow-ups — no expenses or profit. <b>Technician</b>: only their own jobs, customer name only, no prices. <b>Driver</b>: only their own mobile jobs with customer name, phone and location, no prices.</div>
      ${table([{ h: 'Name', v: m => `<b>${esc(m.name)}</b>${m.title ? `<div class="small faint">${esc(m.title)}</div>` : ''}` }, { h: 'Username', v: m => `<span class="mono">${esc(m.username)}</span>` },
        { h: 'Role', v: m => esc((ROLES[m.role] || {}).label || m.role) }, { h: 'Last seen', v: m => esc(agoTxt(m.last_seen)) },
        { h: 'Status', v: m => m.active ? pill('Active') : pill('Switched off', 'red') }],
        CL.members || [], { click: m => m.role === 'owner' ? '' : `editCloudStaff('${m.user_id}')`, empty: 'No logins yet.' })}</div>

    <div class="card mb"><div class="card-head"><h3>💻 Devices</h3></div>
      <div class="card-pad muted small" style="padding-bottom:0">Every phone and computer that signed in. If one is lost, or you don't recognise it, press <b>Sign out</b>: it loses access at once and its copy of the data is wiped the next time it opens.</div>
      ${table([{ h: 'Person', v: d => `<b>${esc(name(d.user_id))}</b>` }, { h: 'Device', v: d => `${esc(d.label || '')}${d.session_id && Cloud.stored() && d.user_id === Cloud.me.user_id && isThisDevice(d) ? ' ' + pill('this device', 'blue') : ''}` },
        { h: 'Last seen', v: d => esc(agoTxt(d.last_seen)) }, { h: 'Internet address', v: d => `<span class="mono small">${esc(d.ip || '')}</span>` },
        { h: '', v: d => d.revoked ? pill('Signed out', 'red') : `<button class="btn sm danger" onclick="event.stopPropagation();cloudRevoke('${d.id}')">Sign out</button>` }],
        CL.devices.filter(d => !d.revoked || Date.now() - new Date(d.revoked_at || d.last_seen) < 14 * 864e5), { empty: 'No devices yet.' })}</div>

    <div class="grid g2 mb">
      <div class="card"><div class="card-head"><h3>🔑 Owner approval</h3></div>
        <div class="card-pad muted small" style="padding-bottom:0">Staff need your <b>approval PIN</b> to: give a discount above the limit, void or delete an invoice, delete a payment, change a payment link, change bank details or reopen a closed month. It is different from your screen-lock PIN.</div>
        <div class="card-pad row"><button class="btn ${CL.hasPin ? '' : 'primary'}" onclick="setApprovalPin()">${CL.hasPin ? 'Change approval PIN' : 'Set approval PIN'}</button></div>
        <div class="card-pad row" style="padding-top:0"><div class="field"><label>Discount limit without approval (%)</label><input class="inp" type="number" id="s_discountLimit" value="${esc(discountLimit())}" style="width:120px"></div>
          <button class="btn" style="align-self:flex-end" onclick="saveDiscountLimit()">Save</button></div></div>
      <div class="card"><div class="card-head"><h3>✉ Alerts &amp; sign-in</h3></div>
        <div class="card-pad"><div class="small muted mb">Important events are e-mailed at once; everything else comes in a daily summary at 20:00.</div>
          <div class="row"><span class="grow">${CL.email ? esc(CL.email) : '<span class="red">not set</span>'}</span><button class="btn sm" onclick="setAlertEmail()">Change</button></div>
          <hr class="sep"><div class="small muted mb">Authenticator app on your Owner login</div>
          <div class="row"><span class="grow">${CL.factors.length ? CL.factors.map(f => esc(f.friendly_name || 'Phone')).join(', ') : '<span class="red">not set up</span>'}</span>
            <button class="btn sm" onclick="setupAuthenticator(${CL.factors.length ? 'true' : 'false'})">${CL.factors.length ? 'Add a backup phone' : 'Set up'}</button></div></div></div></div>

    <div class="card mb"><div class="card-head"><h3>📜 Audit log</h3><div class="actions">
        <select class="inp sm" onchange="CL.who=this.value;drawCloudSecurity()"><option value="all">Everyone</option>${people.map(p => `<option ${CL.who === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select class="inp sm" onchange="CL.coll=this.value;drawCloudSecurity()"><option value="all">Everything</option>${colls.map(c => `<option value="${esc(c)}" ${CL.coll === c ? 'selected' : ''}>${esc(COLL_LABEL[c] || c)}</option>`).join('')}</select></div></div>
      <div class="card-pad muted small" style="padding-bottom:0">Every change, by whom and when (last ${CL.audit.length}). Nobody can edit or delete this list — not even you.</div>
      ${table([{ h: 'When', v: a => `<span class="small">${esc(new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span>` },
        { h: 'Who', v: a => esc(a.who || 'system') }, { h: 'What', v: a => `${pill(a.action === 'delete' ? 'Deleted' : a.action === 'create' ? 'Added' : 'Changed', a.action === 'delete' ? 'red' : a.action === 'create' ? 'green' : '')} ${esc(COLL_LABEL[a.coll] || a.coll)}` },
        { h: 'Details', v: a => `<span class="small">${esc(a.summary || '')}</span>` }], aud.slice(0, 200), { empty: 'Nothing yet.' })}</div>
    ${cloudLocalLockHTML()}`;
  if (typeof checkSecurityHeaders === 'function') checkSecurityHeaders();
}
function isThisDevice(d) { return (d.label || '') === deviceLabel() && Date.now() - new Date(d.last_seen) < 10 * 60000; }
function cloudLocalLockHTML() {
  return `<div class="card"><div class="card-pad row"><div class="field"><label>Auto-lock after (minutes idle, 0 = never)</label><input class="inp" type="number" id="s_autoLockMinutes" value="${esc(S.settings.autoLockMinutes || 0)}" style="width:120px"></div>
    <button class="btn" style="align-self:flex-end" onclick="saveSettingsForm(['autoLockMinutes'])">Save</button>
    <button class="btn" style="align-self:flex-end" onclick="Auth.lock()">🔒 Lock now</button></div></div>`;
}
async function cloudAlertsSeen() {
  const { error } = await Sync.client.from('alerts').update({ seen: true }).eq('seen', false);
  if (error) return toast(error.message, 'err');
  CL.alerts.forEach(a => a.seen = true); drawCloudSecurity();
}
async function cloudRevoke(id) {
  const d = CL.devices.find(x => x.id === id); if (!d) return;
  if (!(await confirmBox(`Sign out "${d.label || 'this device'}"? It loses access at once and must sign in again with a password.`, 'Sign out device', true))) return;
  try { await Cloud.rpc('revoke_device', { p_id: id }); toast('Device signed out', 'ok'); loadCloudSecurity(); } catch (e) { toast(e.message, 'err'); }
}
function suggestPassword() {
  const words = ['Falcon', 'Desert', 'Piston', 'Engine', 'Garage', 'Turbo', 'Palm', 'Harbor', 'Silver', 'Rocket', 'Spanner', 'Dune'];
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  return `${words[r(words.length)]}-${1000 + r(9000)}-${words[r(words.length)]}`;
}
function editCloudStaff(userId) {
  const m = userId ? (CL.members || []).find(x => x.user_id === userId) : null;
  const techs = S.technicians.filter(t => t.active !== false);
  const d = openModal({
    title: m ? `Login — ${esc(m.name)}` : 'New staff login', size: 'narrow',
    body: `<div class="grid g1" style="gap:10px">
      <div class="field"><label>Name</label><input id="cs_name" value="${esc(m ? m.name : '')}" maxlength="60"></div>
      <div class="field"><label>Job title (optional, e.g. Senior Mechanic)</label><input id="cs_title" value="${esc(m ? m.title || '' : '')}" maxlength="60"></div>
      <div class="field"><label>Role — what they can see and do</label><select id="cs_role">${ROLE_OPTS().map(([k, l]) => `<option value="${k}" ${(m ? m.role : 'advisor') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="field" id="cs_techBox"><label>Same person in Technicians (their jobs)</label><select id="cs_tech"><option value="">—</option>${techs.map(t => `<option value="${t.id}" ${m && m.tech_id === t.id ? 'selected' : ''}>${esc(t.name)}${t.trade ? ' — ' + esc(t.trade) : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Username (letters/numbers, no spaces)</label><input id="cs_user" class="mono" value="${esc(m ? m.username : '')}" maxlength="20" autocapitalize="none" spellcheck="false"></div>
      ${m ? `<label class="row small"><input type="checkbox" id="cs_active" style="width:auto" ${m.active ? 'checked' : ''}> Active (untick to switch this login off everywhere)</label>`
        : `<div class="field"><label>Password (min 8, letters + numbers)</label><div class="row"><input id="cs_pass" class="mono grow" value="${esc(suggestPassword())}"><button class="btn sm" type="button" onclick="document.getElementById('cs_pass').value=suggestPassword()">New</button></div>
          <div class="help">Give it to them privately. They can change it later in Settings → Cloud.</div></div>`}
      <div id="cs_err" class="small red"></div></div>`,
    foot: `${m ? `<button class="btn left" data-pw>Reset password</button><button class="btn left" data-out>Sign out everywhere</button>` : ''}<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>${m ? 'Save' : 'Create login'}</button>`,
  });
  const $e = s => d.el.querySelector(s), err = t => { $e('#cs_err').textContent = t || ''; };
  const techVis = () => { $e('#cs_techBox').style.display = ['technician', 'driver'].includes($e('#cs_role').value) ? '' : 'none'; };
  $e('#cs_role').onchange = techVis; techVis();
  $e('[data-c]').onclick = d.close;
  $e('[data-s]').onclick = async () => {
    const body = { name: $e('#cs_name').value.trim(), title: $e('#cs_title').value.trim(), role: $e('#cs_role').value, tech_id: ['technician', 'driver'].includes($e('#cs_role').value) ? $e('#cs_tech').value : '', username: $e('#cs_user').value.trim().toLowerCase() };
    if (!body.name) return err('Enter the name');
    if (['technician', 'driver'].includes(body.role) && !body.tech_id) return err('Pick the person in Technicians (add them under Setup → Technicians first)');
    try {
      err('Saving…');
      if (m) await Cloud.fn('staff-admin', { action: 'update', user_id: m.user_id, ...body, active: $e('#cs_active').checked });
      else {
        const pass = $e('#cs_pass').value;
        await Cloud.fn('staff-admin', { action: 'create', ...body, password: pass });
        d.close(); await showNewLogin(body.name, body.username, pass); loadCloudSecurity(); return;
      }
      d.close(); toast('Saved', 'ok'); loadCloudSecurity();
    } catch (e) { err(e.message); }
  };
  if (m) {
    $e('[data-pw]').onclick = async () => {
      const pass = suggestPassword();
      if (!(await confirmBox(`Reset ${m.name}'s password? They are signed out everywhere and use the new password: ${pass}`, 'Reset password'))) return;
      try { await Cloud.fn('staff-admin', { action: 'password', user_id: m.user_id, password: pass }); d.close(); await showNewLogin(m.name, m.username, pass); loadCloudSecurity(); } catch (e) { err(e.message); }
    };
    $e('[data-out]').onclick = async () => {
      if (!(await confirmBox(`Sign ${m.name} out of every device?`, 'Sign out'))) return;
      try { const r = await Cloud.fn('staff-admin', { action: 'signout', user_id: m.user_id }); d.close(); toast(`${m.name} signed out of ${r.signed_out} device(s)`, 'ok'); loadCloudSecurity(); } catch (e) { err(e.message); }
    };
  }
}
function showNewLogin(name, username, pass) {
  return new Promise(resolve => {
    const m = openModal({ title: 'Login ready', size: 'narrow',
      body: `<p style="margin-top:0">Give these to <b>${esc(name)}</b> privately (not in a group chat):</p>
        <dl class="kv" style="grid-template-columns:100px 1fr;font-size:16px"><dt>Username</dt><dd class="mono"><b>${esc(username)}</b></dd><dt>Password</dt><dd class="mono"><b>${esc(pass)}</b></dd></dl>
        <p class="small muted">They open the app on their phone or the office PC, sign in, and choose their own screen-lock PIN. This password is not shown again.</p>`,
      foot: `<button class="btn" onclick="navigator.clipboard.writeText('Username: ${esc(username)}\\nPassword: ${esc(pass)}').then(()=>toast('Copied'))">Copy</button><button class="btn primary" data-ok>Done</button>` });
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); resolve(); };
  });
}
/* the old PIN logins (Level 1) → personal logins, one by one */
async function importPinStaff() {
  const old = S.staff.filter(s => s.active !== false && s.role !== 'owner');
  const rows = old.map(s => ({ s, user: s.name.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '').slice(0, 16) || 'staff', pass: suggestPassword() }));
  const m = openModal({ title: 'Create personal logins for your staff', size: 'wide',
    body: `<p class="small muted" style="margin-top:0">One login per person, from your old PIN list. Check the usernames, then press Create. Passwords are shown on the next screen to hand out.</p>
      ${table([{ h: 'Name', v: r => `<b>${esc(r.s.name)}</b>` }, { h: 'Role', v: r => esc((ROLES[r.s.role] || {}).label || r.s.role) },
        { h: 'Username', v: (r, i) => `<input class="inp sm mono" data-u="${rows.indexOf(r)}" value="${esc(r.user)}" style="width:140px">` },
        { h: 'Technician link', v: r => ['technician', 'driver'].includes(r.s.role) ? (r.s.techId && get('technicians', r.s.techId) ? esc(get('technicians', r.s.techId).name) : '<span class="red">missing</span>') : '—' }], rows)}
      <div id="ip_err" class="small red mt-s"></div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Create ${rows.length} login(s)</button>` });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-s]').onclick = async () => {
    const done = [], fails = [];
    m.el.querySelectorAll('[data-u]').forEach(i => rows[+i.dataset.u].user = i.value.trim().toLowerCase());
    for (const r of rows) {
      try { await Cloud.fn('staff-admin', { action: 'create', name: r.s.name, role: r.s.role, tech_id: r.s.techId || '', username: r.user, password: r.pass }); done.push(r); }
      catch (e) { fails.push(`${r.s.name}: ${e.message}`); }
    }
    m.close();
    const s = openModal({ title: `${done.length} login(s) created`, size: 'narrow',
      body: `${done.length ? `<p style="margin-top:0">Hand these out privately:</p>${table([{ h: 'Name', v: r => esc(r.s.name) }, { h: 'Username', v: r => `<b class="mono">${esc(r.user)}</b>` }, { h: 'Password', v: r => `<b class="mono">${esc(r.pass)}</b>` }], done)}` : ''}
        ${fails.length ? `<p class="red small">${fails.map(esc).join('<br>')}</p>` : ''}`,
      foot: `<button class="btn" data-p>🖨 Print</button><button class="btn primary" data-ok>Done</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { s.close(); loadCloudSecurity(); };
    s.el.querySelector('[data-p]').onclick = () => printHTML(`<h2>mendtech. — staff logins</h2>${table([{ h: 'Name', v: r => esc(r.s.name) }, { h: 'Username', v: r => esc(r.user) }, { h: 'Password', v: r => esc(r.pass) }], done)}<p>Cut into strips and hand out privately.</p>`);
  };
}
async function setApprovalPin() {
  const m = openModal({ title: 'Owner approval PIN', size: 'narrow',
    body: `<p style="margin-top:0">Staff ask you to type this PIN when they need your approval. Choose <b>6–8 digits</b> that are not your screen-lock PIN, phone number or birthday.</p>
      <div class="field"><label>Approval PIN</label><input id="ap_1" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div>
      <div class="field"><label>Type it again</label><input id="ap_2" class="inp center" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.3em"></div><div id="ap_err" class="small red"></div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>` });
  const err = t => { m.el.querySelector('#ap_err').textContent = t; };
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-s]').onclick = async () => {
    const p = m.el.querySelector('#ap_1').value, bad = pinProblem(p);
    if (bad) return err(bad);
    if (p !== m.el.querySelector('#ap_2').value) return err('The two PINs are different');
    try { await Cloud.rpc('set_owner_pin', { p_pin: p }); m.close(); toast('Approval PIN saved', 'ok'); refreshSecurityViews(); } catch (e) { err(e.message); }
  };
}
async function setAlertEmail() {
  const cur = CL.email || (await Cloud.rpc('get_alert_email').catch(() => '')) || 'mendtech23@gmail.com';
  const m = openModal({ title: 'Alert e-mail', size: 'narrow',
    body: `<div class="field"><label>Send security alerts and the daily summary to</label><input id="ae_e" type="email" value="${esc(cur)}"></div>
      <p class="small muted">The first e-mails come from “onboarding@resend.dev” — add it to your contacts so they don't land in spam.</p><div id="ae_err" class="small red"></div>`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>` });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-s]').onclick = async () => {
    try { await Cloud.rpc('set_alert_config', { p_email: m.el.querySelector('#ae_e').value.trim(), p_functions_url: Sync.cfg.url + '/functions/v1', p_anon_key: Sync.cfg.key }); m.close(); toast('Saved — a test alert was sent', 'ok'); refreshSecurityViews(); }
    catch (e) { m.el.querySelector('#ae_err').textContent = e.message; }
  };
}
function refreshSecurityViews() { if (document.getElementById('clSec')) loadCloudSecurity(); else if (document.getElementById('l2wiz')) loadLevel2Wizard(); else render(); }

/* authenticator app on the Owner login (the changeover step, and "add a backup phone") */
async function setupAuthenticator(extra) {
  if (!extra && !(await confirmBox('After this, the Owner login needs your password AND a 6-digit code from your phone. Every device still using the shared garage login stops getting data and asks for a personal login — create the staff logins right after (step 4). Best done after closing time.', 'Continue'))) return;
  const mfa = Sync.client.auth.mfa;
  try {
    const { data: list } = await mfa.listFactors();
    for (const f of ((list && list.all) || []).filter(f => f.status !== 'verified')) await mfa.unenroll({ factorId: f.id });
    const { data, error } = await mfa.enroll({ factorType: 'totp', friendlyName: `${extra ? 'Backup phone' : 'Owner phone'} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` });
    if (error) throw error;
    const secret = (data.totp.secret || '').replace(/(.{4})/g, '$1 ').trim();
    const m = openModal({ title: extra ? 'Add a backup phone' : 'Set up the authenticator app', size: 'narrow',
      body: `<ol class="small" style="padding-left:18px;line-height:1.7;margin-top:0">
          <li>On your phone install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> (free).</li>
          <li>In the app tap <b>+</b> → <b>Scan a QR code</b> and scan this:</li></ol>
        <div class="center"><img src="${esc(data.totp.qr_code)}" alt="QR code" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:8px"></div>
        <p class="small muted center">Can't scan? Choose “Enter a setup key” and type:<br><b class="mono">${esc(secret)}</b></p>
        <div class="field"><label>3. Type the 6-digit code the app shows</label><input id="au_c" class="inp center" inputmode="numeric" maxlength="6" style="font-size:22px;letter-spacing:.35em"></div><div id="au_err" class="small red"></div>`,
      foot: `<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Verify</button>` });
    const err = t => { m.el.querySelector('#au_err').textContent = t; };
    m.el.querySelector('[data-c]').onclick = async () => { m.close(); try { await mfa.unenroll({ factorId: data.id }); } catch (e) { } };
    m.el.querySelector('[data-s]').onclick = async () => {
      const code = m.el.querySelector('#au_c').value.replace(/\D/g, '');
      if (code.length !== 6) return err('Type the 6-digit code');
      const { error: e2 } = await mfa.challengeAndVerify({ factorId: data.id, code });
      if (e2) return err('Wrong or expired code — type the newest one');
      m.close();
      await Cloud.refresh();
      if (!extra) {
        lsSet('gp_accounts', '1');
        Auth.user = Cloud.user(); ssSet('gp_unlocked', Auth.user.id);
        await DB.put('meta', { id: 'scope', v: Cloud.scopeOf(Cloud.me) });
        await askLockPin(Auth.user);
        toast('Authenticator on. Now create the staff logins.', 'ok');
        setFilter('settings', 'tab', 'staff'); go('#/settings');
      } else { toast('Backup phone added', 'ok'); loadCloudSecurity(); }
    };
  } catch (e) { toast(e.message || String(e), 'err'); }
}

/* ---------- the changeover (Owner, while the shared garage login is still in use) ---------- */
function level2WizardHTML() {
  setTimeout(loadLevel2Wizard, 0);
  return `<div id="l2wiz" class="card mb"><div class="card-pad muted">Checking Security Level 2…</div></div>`;
}
async function loadLevel2Wizard() {
  const box = document.getElementById('l2wiz'); if (!box) return;
  try {
    await Cloud.rpc('claim_owner');
    const me = await Cloud.refresh(), hasPin = await Cloud.rpc('has_owner_pin'), email = await Cloud.rpc('get_alert_email');
    CL.email = email || '';
    const step = (n, ok, title, text, btn) => `<div class="alert-row"><div class="alert-ico" style="background:${ok ? 'var(--greenSoft, #dcfce7)' : 'var(--graySoft)'}">${ok ? '✓' : n}</div>
      <div class="grow"><b>${title}</b><div class="small muted">${text}</div></div>${btn || ''}</div>`;
    box.innerHTML = `<div class="card-head"><h3>⬆ Switch on Security Level 2 — personal logins</h3></div>
      <div class="card-pad small muted" style="padding-bottom:0">Your cloud is upgraded. Four steps, about 10 minutes — best after closing time. Until step 3, everything keeps working as today.</div>
      ${step(1, hasPin, 'Owner approval PIN', 'Staff type it when they need your OK (checked by the server, not the device).', `<button class="btn sm ${hasPin ? '' : 'primary'}" onclick="setApprovalPin()">${hasPin ? 'Change' : 'Set'}</button>`)}
      ${step(2, !!email, 'Alert e-mail', email ? esc(email) : 'Where security alerts and the daily summary go.', `<button class="btn sm ${email ? '' : 'primary'}" onclick="setAlertEmail()">${email ? 'Change' : 'Set'}</button>`)}
      ${step(3, me && me.mfa_enrolled, 'Authenticator app on your Owner login', 'Your password alone is no longer enough. The shared garage login stops working on other devices.', hasPin && email ? `<button class="btn sm primary" onclick="setupAuthenticator(false)">Set up</button>` : '<span class="small faint">do 1 and 2 first</span>')}
      ${step(4, false, 'Staff logins', 'One username + password per person (made from your PIN list in one click). Then everyone signs in on their devices.', '<span class="small faint">after step 3</span>')}`;
  } catch (e) { box.innerHTML = `<div class="card-pad red">Security Level 2: ${esc(e.message)} <button class="btn sm" onclick="loadLevel2Wizard()">Try again</button></div>`; }
}

/* ---------- Technician & Driver devices: their own jobs only ---------- */
async function crewSync() {
  const st = (await Sync.meta('sync')) || { id: 'sync' };
  const since = st.lastPush || '', started = new Date().toISOString();
  const rows = S.jobs.filter(j => (j.updatedAt || '') > since).map(j => ({ coll: 'jobs', id: j.id, data: j, updated_at: j.updatedAt }));
  const photos = (await DB.all('photos')).filter(p => (p.updatedAt || p.date || '') > since && !p.fromCloud);
  let rejected = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += 50) {
    const batch = rows.slice(i, i + 50); if (!batch.length) break;
    const r = await Cloud.rpc('crew_push', { p_rows: batch }); rejected = rejected.concat(r.rejected || []);
  }
  for (let i = 0; i < photos.length; i += 3) {
    const r = await Cloud.rpc('crew_push', { p_rows: photos.slice(i, i + 3).map(p => ({ coll: 'photos', id: p.id, data: p, updated_at: p.updatedAt || p.date })) });
    rejected = rejected.concat(r.rejected || []);
  }
  st.lastPush = started; await DB.put('meta', st);
  if (rejected.length) toast(`${rejected.length} change(s) not accepted: ${rejected.map(x => x.why).join(', ')}`, 'err');

  const d = await Cloud.rpc('crew_pull');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let changed = 0;
  for (const [coll, list] of [['jobs', d.jobs], ['vehicles', d.vehicles], ['customers', d.customers], ['technicians', d.technicians]]) {
    const keep = coll === 'jobs' ? S.jobs.filter(j => (j.updatedAt || '') > started) : [];   // edited while syncing
    const next = (list || []).map(x => keep.find(k => k.id === x.id) || x);
    if (!same(next, S[coll])) { changed++; S[coll] = next; await DB.clear(coll); for (const x of next) await DB.put(coll, x); }
  }
  if (d.settings && (d.settings.updatedAt || '') !== (S.settings.updatedAt || '')) {
    S.settings = mergeDeep(structuredClone(DEFAULT_SETTINGS), d.settings); await DB.put('meta', S.settings); changed++;
  }
  const want = new Set((d.photos || []).map(p => p.id)), have = await DB.all('photos');
  for (const p of have) if (!want.has(p.id) && p.fromCloud) await DB.del('photos', p.id);
  for (const id of want) if (!have.some(p => p.id === id)) {
    const ph = await Cloud.rpc('crew_photo', { p_id: id });
    if (ph) { ph.fromCloud = true; await DB.put('photos', ph); changed++; }
  }
  return changed;
}
