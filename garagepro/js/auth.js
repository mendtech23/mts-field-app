/* GaragePro — staff logins with PIN and roles */
'use strict';

const ROLES = {
  owner: { label: 'Owner', pages: '*', finance: true },
  /* Manager: everything the Owner does except security, bank details, staff logins, backups and deleting data */
  manager: { label: 'Manager', pages: '*', finance: true, hideTabs: ['staff', 'cloud', 'data'], noDiscountLimit: true },
  advisor: { label: 'Service Advisor', pages: ['dashboard', 'lookup', 'search', 'checkin', 'bookings', 'quotes', 'quote', 'jobs', 'job', 'invoices', 'invoice', 'payments', 'customers', 'customer', 'vehicles', 'vehicle', 'reminders', 'parts', 'pos', 'po', 'suppliers', 'labour', 'packages', 'package', 'technicians', 'dispatch', 'myjobs', 'requests', 'van', 'followups', 'renewals', 'partners', 'partner'], finance: false },
  /* Technician: own jobs only, customer name only, findings / check-in / inspection / photos — no parts, labour or prices */
  technician: { label: 'Technician', pages: ['myjobs', 'job'], finance: false, home: 'myjobs', restricted: true, customerDetail: 'name' },
  /* Driver: own mobile jobs only, customer name + phone + location, no prices */
  driver: { label: 'Driver', pages: ['myjobs', 'job', 'van'], finance: false, home: 'myjobs', restricted: true, customerDetail: 'contact' },
};

/* PIN hashing, lockout and approvals live in security.js */

const Auth = {
  user: null, idle: null,
  /* Level 2 (personal cloud logins) or Level 1 (PIN logins on the device) */
  get active() { return Cloud.accounts || S.staff.some(s => s.active !== false); },
  role() { if (!this.active) return ROLES.owner; return this.user ? ROLES[this.user.role] || ROLES.technician : ROLES.technician; },
  canPage(p) { if (!this.active) return true; const r = this.role(); return r.pages === '*' || r.pages.includes(p); },
  can(perm) { if (!this.active) return true; return !!this.role()[perm]; },
  restore() {
    if (Cloud.accounts) { const u = Cloud.user(); this.user = u && Cloud.signedIn() && !Cloud.needsCode() && ssGet('gp_unlocked') === u.id ? u : null; return; }
    try { const id = sessionStorage.getItem('gp_user'); this.user = id ? get('staff', id) : null; } catch (e) { }
  },
  requireLogin() {
    if (Cloud.accounts) {
      if (document.getElementById('lockScreen')) return true;
      if (!Cloud.signedIn()) { this.user = null; showCloudLogin(); return true; }
      if (Cloud.needsCode()) { this.user = null; showCodeScreen(); return true; }
      if (!this.user) { showCloudLock(); return true; }
      return false;
    }
    if (!this.active) { this.user = null; return false; } if (this.user && this.user.active !== false) return false; this.showLock(); return true;
  },
  showLock() {
    if (Cloud.accounts) return showCloudLock();
    if (document.getElementById('lockScreen')) return;   // already showing — don't reset a login in progress
    document.body.classList.add('locked-screen');
    const staff = S.staff.filter(s => s.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    const st = S.settings;
    let el = $('#lockScreen'); if (!el) { el = document.createElement('div'); el.id = 'lockScreen'; document.body.appendChild(el); }
    el.innerHTML = `<div class="lock-card">
      <img class="lock-logo light" src="img/brand/logo.svg" alt="mendtech. auto · mobile"><img class="lock-logo dark" src="img/brand/logo-reverse.svg" alt="">
      <p class="muted center" style="margin:0 0 16px">Who's working?</p>
      <div class="lock-users">${staff.map(s => `<button class="lock-user" data-id="${s.id}"><span class="av">${esc(s.name.slice(0, 1).toUpperCase())}</span>${esc(s.name)}<span class="small faint">${esc((ROLES[s.role] || {}).label || '')}</span></button>`).join('')}</div>
      <div id="pinBox" style="display:none;margin-top:14px"><input id="pinIn" class="inp center" type="password" inputmode="numeric" maxlength="8" placeholder="Enter PIN" autocomplete="off" style="font-size:22px;letter-spacing:.3em">
        <div id="pinErr" class="small center" style="color:#fecaca;min-height:18px;margin-top:6px"></div>
        <div class="row mt-s" style="justify-content:center"><button class="btn" id="pinBack">Back</button><button class="btn primary" id="pinGo">Unlock</button></div></div>
      <p class="small faint center" style="margin-top:16px">mendtech. workshop app v${APP_VERSION}</p></div>`;
    let chosen = null;
    const pinErr = t => { el.querySelector('#pinErr').textContent = t || ''; };
    el.querySelectorAll('.lock-user').forEach(b => b.onclick = () => {
      chosen = get('staff', b.dataset.id); el.querySelector('.lock-users').style.display = 'none'; el.querySelector('#pinBox').style.display = '';
      const wait = PinGuard.lockedFor(chosen.id); pinErr(wait ? `Locked after too many wrong PINs — try again in ${fmtMins(wait)}` : '');
      el.querySelector('#pinIn').focus();
    });
    el.querySelector('#pinBack').onclick = () => { el.querySelector('.lock-users').style.display = ''; el.querySelector('#pinBox').style.display = 'none'; el.querySelector('#pinIn').value = ''; pinErr(''); };
    let busy = false;
    const tryPin = async () => {
      if (busy || !chosen) return; busy = true;
      const pin = el.querySelector('#pinIn').value;
      try {
        const r = await PinGuard.check(chosen, pin);
        if (!r.ok) { pinErr(r.msg); el.querySelector('#pinIn').value = ''; return; }
        if (!isStrongPinHash(chosen.pinHash)) await askNewPin(chosen);   // old 4-digit PIN from v3.0
        this.user = chosen; try { sessionStorage.setItem('gp_user', chosen.id); } catch (e) { }
        el.remove(); document.body.classList.remove('locked-screen'); this.armIdle();
        if (!this.canPage(currentRoute()[0] || 'dashboard')) location.hash = '#/' + (this.role().home || 'dashboard');
        render(); toast(`Welcome, ${chosen.name}`, 'ok');
        if (chosen.role === 'owner' && secUnread()) setTimeout(() => toast(`🚨 ${secUnread()} new security alert(s) — Settings → Staff & security`, 'err'), 800);
      } finally { busy = false; }
    };
    el.querySelector('#pinGo').onclick = tryPin;
    el.querySelector('#pinIn').onkeydown = e => { if (e.key === 'Enter') tryPin(); };
  },
  lock() { this.user = null; ssDel('gp_user'); ssDel('gp_unlocked'); closeAllModals(); this.showLock(); },
  armIdle() {
    const mins = num(S.settings.autoLockMinutes); if (!mins || !this.active) return;
    const reset = () => { clearTimeout(this.idle); this.idle = setTimeout(() => { if (this.user) this.lock(); }, mins * 60000); };
    if (!this.idleOn) { this.idleOn = true; ['mousemove', 'keydown', 'touchstart', 'click'].forEach(ev => document.addEventListener(ev, reset, { passive: true })); }
    reset();
  },
};

/* ---------- Staff management (Settings → Staff & security) ---------- */
function staffSettingsHTML() {
  if (Cloud.accounts) return cloudSecurityHTML();
  const l2 = Cloud.level2 && Sync.user && (!Auth.active || (Auth.user && Auth.user.role === 'owner')) ? level2WizardHTML() : '';
  return l2 + pinStaffSettingsHTML();
}
function pinStaffSettingsHTML() {
  const st = S.settings, owners = S.staff.filter(s => s.role === 'owner' && s.active !== false).length;
  const lb = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), today()) : null;
  const checks = [
    [owners > 0, owners ? `${S.staff.filter(s => s.active !== false).length} active login(s), ${owners} Owner` : 'No staff logins — anyone who opens the app has full access. Add an Owner login first.'],
    [num(st.autoLockMinutes) > 0, num(st.autoLockMinutes) > 0 ? `Auto-lock after ${st.autoLockMinutes} minutes` : 'Auto-lock is off — set 5–10 minutes below'],
    [(IS_PREVIEW && !CFG.previewCloud) || !!(typeof Sync !== 'undefined' && Sync.user), IS_PREVIEW && !CFG.previewCloud ? 'Preview copy — not connected to the cloud (by design)' : (typeof Sync !== 'undefined' && Sync.user) ? `Cloud backup on — signed in as ${Sync.user.email}` : 'Cloud sync is not signed in on this device'],
    [lb != null && lb <= 31, lb == null ? 'No backup file downloaded yet' : `Last backup file ${lb} day(s) ago`],
    ...(lb == null ? [] : [[!!st.lastBackupEncrypted, st.lastBackupEncrypted ? 'Backup files are password-protected' : 'Last backup file was not password-protected — download a new one']]),
    ...(() => { const weak = S.staff.filter(s => s.active !== false && !isStrongPinHash(s.pinHash)); return weak.length ? [[false, `${weak.length} login(s) still on an old 4-digit PIN (${weak.map(s => s.name).join(', ')}) — they must choose a 6-digit PIN at next sign-in`]] : S.staff.length ? [[true, 'All PINs are 6+ digits with strong hashing; 5 wrong tries lock the login']] : []; })(),
  ];
  return `<div class="card mb"><div class="card-head"><h3>🛡 Security check</h3></div>${checks.map(([ok, t]) => secCheckRow(ok, t)).join('')}<div id="secHeaders"></div></div>
    ${secAlertsHTML()}
    <div class="card mb"><div class="card-head"><h3>🔑 Owner approval</h3></div>
      <div class="card-pad muted small" style="padding-bottom:0">Staff need the Owner's PIN to: give a discount above the limit below, void or delete an invoice, delete a payment, change an invoice's payment link, or reopen a closed month. Changing bank / Stripe details, restoring a backup and erasing data always ask for the Owner PIN again.</div>
      <div class="card-pad row"><div class="field"><label>Discount limit without approval (%)</label><input class="inp" type="number" id="s_discountLimit" value="${esc(discountLimit())}" style="width:120px"></div>
        <button class="btn" style="align-self:flex-end" onclick="saveDiscountLimit()">Save</button></div></div>
    <div class="card"><div class="card-head"><h3>👥 Staff logins</h3><div class="actions"><button class="btn sm primary" onclick="editStaff()">＋ Add staff</button></div></div>
    <div class="card-pad muted small" style="padding-bottom:0">Once you add staff, the app asks “Who's working?” and a PIN every time it opens. Everything created is stamped with the person's name.
      <b>Owner</b> sees everything. <b>Manager</b>: everything except staff logins, security, cloud, backups, bank details and deleting data. <b>Service Advisor</b>: front desk, MendTech Mobile dispatch, quotes, jobs, invoices, payments, stock, follow-ups — no profit reports, expenses, closing or settings. <b>Technician</b>: only their own job cards, customer name only, findings / check-in / inspection / photos — no parts, labour or prices. <b>Driver</b>: only their own mobile jobs (name, phone, location) and van stock, no prices.</div>
    ${table([{ h: 'Name', v: s => `<b>${esc(s.name)}</b>` }, { h: 'Role', v: s => esc((ROLES[s.role] || {}).label || s.role) }, { h: 'Status', v: s => s.active === false ? pill('Inactive') : pill('Active') }, { h: '', v: s => Auth.user && Auth.user.id === s.id ? pill('you', 'blue') : '' }],
      S.staff, { click: s => `editStaff('${s.id}')`, empty: 'No staff logins — anyone who opens the app has full access.' })}
    <div class="card-pad row"><div class="field"><label>Auto-lock after (minutes idle, 0 = never)</label><input class="inp" type="number" id="s_autoLockMinutes" value="${esc(S.settings.autoLockMinutes || 0)}" style="width:120px"></div>
      <button class="btn" style="align-self:flex-end" onclick="saveSettingsForm(['autoLockMinutes'])">Save</button>
      ${Auth.active ? `<button class="btn" style="align-self:flex-end" onclick="Auth.lock()">🔒 Lock now</button>` : ''}</div></div>`;
}
function editStaff(id) {
  const s = get('staff', id);
  openForm({
    title: s ? 'Edit staff login' : 'New staff login', size: 'narrow', cols: 1,
    fields: [{ k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role', type: 'select', options: Object.entries(ROLES).map(([k, r]) => [k, r.label]), def: S.staff.length ? 'technician' : 'owner', blank: false },
      { k: 'pin', label: s ? 'New PIN (6–8 digits, leave blank to keep)' : 'PIN (6–8 digits)', type: 'password', req: !s },
      { k: 'techId', label: 'Same person in Technicians (shows their jobs in “My jobs”)', type: 'select', options: () => S.technicians.map(t => [t.id, t.name]) },
      { k: 'active', label: 'Active', type: 'checkbox', def: true }],
    data: s ? { name: s.name, role: s.role, active: s.active !== false, techId: s.techId } : { active: true },
    onSave: async vals => {
      if (vals.pin && pinProblem(vals.pin)) throw new Error(pinProblem(vals.pin));
      const o = s || {};
      const before = s ? { role: s.role, active: s.active !== false } : null;
      const owners = S.staff.filter(x => x.role === 'owner' && x.active !== false && x.id !== o.id).length;
      if ((vals.role !== 'owner' || !vals.active) && !owners) throw new Error('Keep at least one active Owner login');
      Object.assign(o, { name: vals.name, role: vals.role, active: vals.active, techId: vals.techId || '' });
      if (vals.pin) o.pinHash = await hashPinStrong(vals.pin);
      await save('staff', o);
      if (o.id) PinGuard.clear(o.id);   // saving a login also lifts a lockout on this device
      const rl = r => (ROLES[r] || {}).label || r;
      if (!before) secLog('staff', `New login: ${o.name} (${rl(o.role)})`, 'warn');
      else {
        if (before.role !== o.role) secLog('staff', `${o.name}'s role changed: ${rl(before.role)} → ${rl(o.role)}`, 'warn');
        if (before.active !== o.active) secLog('staff', `${o.name}'s login ${o.active ? 're-activated' : 'deactivated'}`, 'warn');
        if (vals.pin) secLog('pin-change', `${o.name}'s PIN was changed`, 'info');
      }
      if (!Auth.user) { Auth.user = o; try { sessionStorage.setItem('gp_user', o.id); } catch (e) { } }
      toast('Staff saved', 'ok'); render();
    },
    onDelete: s ? async () => {
      if (s.role === 'owner' && S.staff.filter(x => x.role === 'owner' && x.active !== false).length <= 1) { toast('This is the only Owner login', 'err'); return false; }
      if (!(await confirmBox(`Delete login for ${s.name}?`, 'Delete', true))) return false;
      await remove('staff', s.id); secLog('staff', `Login deleted: ${s.name}`, 'warn'); render(); return true;
    } : null,
  });
}
async function saveDiscountLimit() {
  const v = num($('#s_discountLimit').value);
  if (v < 0 || v > 100) return toast('Enter 0–100', 'err');
  if (v === discountLimit()) return toast('No change');
  if (!(await ownerApprove(`Change the discount limit from ${discountLimit()}% to ${v}%`, { always: true, action: 'security', target: 'settings' }))) return;
  S.settings.security = Object.assign({}, S.settings.security, { discountLimit: v });
  await saveSettings(); toast('Saved', 'ok'); render();
}
