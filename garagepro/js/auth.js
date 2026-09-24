/* GaragePro — staff logins with PIN and roles */
'use strict';

const ROLES = {
  owner: { label: 'Owner / Manager', pages: '*', finance: true },
  advisor: { label: 'Service Advisor', pages: ['dashboard', 'lookup', 'search', 'checkin', 'bookings', 'quotes', 'quote', 'jobs', 'job', 'invoices', 'invoice', 'payments', 'customers', 'customer', 'vehicles', 'vehicle', 'reminders', 'parts', 'pos', 'po', 'suppliers', 'labour', 'packages', 'package', 'technicians', 'dispatch', 'myjobs', 'requests', 'van'], finance: false },
  technician: { label: 'Technician', pages: ['dashboard', 'lookup', 'search', 'checkin', 'bookings', 'jobs', 'job', 'vehicles', 'vehicle', 'parts', 'myjobs', 'dispatch', 'van'], finance: false },
  driver: { label: 'Driver', pages: ['myjobs', 'job', 'vehicle', 'lookup', 'search', 'van'], finance: false, home: 'myjobs' },
};

async function hashPin(pin) {
  const txt = 'garagepro:' + pin;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { let h = 0; for (const ch of txt) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'x' + h; }
}

const Auth = {
  user: null, idle: null,
  get active() { return S.staff.some(s => s.active !== false); },
  role() { if (!this.active) return ROLES.owner; return this.user ? ROLES[this.user.role] || ROLES.technician : ROLES.technician; },
  canPage(p) { if (!this.active) return true; const r = this.role(); return r.pages === '*' || r.pages.includes(p); },
  can(perm) { if (!this.active) return true; return !!this.role()[perm]; },
  restore() { try { const id = sessionStorage.getItem('gp_user'); this.user = id ? get('staff', id) : null; } catch (e) { } },
  requireLogin() { if (!this.active) { this.user = null; return false; } if (this.user && this.user.active !== false) return false; this.showLock(); return true; },
  showLock() {
    if (document.getElementById('lockScreen')) return;   // already showing — don't reset a login in progress
    document.body.classList.add('locked-screen');
    const staff = S.staff.filter(s => s.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    const st = S.settings;
    let el = $('#lockScreen'); if (!el) { el = document.createElement('div'); el.id = 'lockScreen'; document.body.appendChild(el); }
    el.innerHTML = `<div class="lock-card">
      <div class="brand-logo" style="width:64px;height:64px;margin:0 auto 10px;font-size:22px">${st.logo ? `<img src="${st.logo}" alt="">` : esc((st.garageName || 'GP').slice(0, 2).toUpperCase())}</div>
      <h2 style="text-align:center">${esc(st.garageName)}</h2><p class="muted center" style="margin:4px 0 16px">Who's working?</p>
      <div class="lock-users">${staff.map(s => `<button class="lock-user" data-id="${s.id}"><span class="av">${esc(s.name.slice(0, 1).toUpperCase())}</span>${esc(s.name)}<span class="small faint">${esc((ROLES[s.role] || {}).label || '')}</span></button>`).join('')}</div>
      <div id="pinBox" style="display:none;margin-top:14px"><input id="pinIn" class="inp center" type="password" inputmode="numeric" maxlength="8" placeholder="Enter PIN" style="font-size:22px;letter-spacing:.3em">
        <div class="row mt-s" style="justify-content:center"><button class="btn" id="pinBack">Back</button><button class="btn primary" id="pinGo">Unlock</button></div></div>
      <p class="small faint center" style="margin-top:16px">GaragePro v${APP_VERSION}</p></div>`;
    let chosen = null;
    el.querySelectorAll('.lock-user').forEach(b => b.onclick = () => { chosen = get('staff', b.dataset.id); el.querySelector('.lock-users').style.display = 'none'; el.querySelector('#pinBox').style.display = ''; el.querySelector('#pinIn').focus(); });
    el.querySelector('#pinBack').onclick = () => { el.querySelector('.lock-users').style.display = ''; el.querySelector('#pinBox').style.display = 'none'; el.querySelector('#pinIn').value = ''; };
    const tryPin = async () => {
      const pin = el.querySelector('#pinIn').value;
      if (chosen && (await hashPin(pin)) === chosen.pinHash) {
        this.user = chosen; try { sessionStorage.setItem('gp_user', chosen.id); } catch (e) { }
        el.remove(); document.body.classList.remove('locked-screen'); this.armIdle();
        if (!this.canPage(currentRoute()[0] || 'dashboard')) location.hash = '#/' + (this.role().home || 'dashboard');
        render(); toast(`Welcome, ${chosen.name}`, 'ok');
      } else { toast('Wrong PIN', 'err'); el.querySelector('#pinIn').value = ''; }
    };
    el.querySelector('#pinGo').onclick = tryPin;
    el.querySelector('#pinIn').onkeydown = e => { if (e.key === 'Enter') tryPin(); };
  },
  lock() { this.user = null; try { sessionStorage.removeItem('gp_user'); } catch (e) { } closeAllModals(); this.showLock(); },
  armIdle() {
    const mins = num(S.settings.autoLockMinutes); if (!mins || !this.active) return;
    const reset = () => { clearTimeout(this.idle); this.idle = setTimeout(() => { if (this.user) this.lock(); }, mins * 60000); };
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(ev => document.addEventListener(ev, reset, { passive: true }));
    reset();
  },
};

/* ---------- Staff management (Settings → Staff & security) ---------- */
function staffSettingsHTML() {
  const st = S.settings, owners = S.staff.filter(s => s.role === 'owner' && s.active !== false).length;
  const lb = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), today()) : null;
  const checks = [
    [owners > 0, owners ? `${S.staff.filter(s => s.active !== false).length} active login(s), ${owners} Owner` : 'No staff logins — anyone who opens the app has full access. Add an Owner login first.'],
    [num(st.autoLockMinutes) > 0, num(st.autoLockMinutes) > 0 ? `Auto-lock after ${st.autoLockMinutes} minutes` : 'Auto-lock is off — set 5–10 minutes below'],
    [IS_PREVIEW || !!(typeof Sync !== 'undefined' && Sync.user), IS_PREVIEW ? 'Preview copy — not connected to the cloud (by design)' : (typeof Sync !== 'undefined' && Sync.user) ? `Cloud backup on — signed in as ${Sync.user.email}` : 'Cloud sync is not signed in on this device'],
    [lb != null && lb <= 31, lb == null ? 'No backup file downloaded yet' : `Last backup file ${lb} day(s) ago`],
  ];
  return `<div class="card mb"><div class="card-head"><h3>🛡 Security check</h3></div>${checks.map(([ok, t]) => `<div class="alert-row"><div class="alert-ico" style="background:${ok ? 'var(--greenSoft)' : 'var(--redSoft)'}">${ok ? '✔' : '⚠'}</div><div class="grow">${esc(t)}</div></div>`).join('')}</div>
    <div class="card"><div class="card-head"><h3>👥 Staff logins</h3><div class="actions"><button class="btn sm primary" onclick="editStaff()">＋ Add staff</button></div></div>
    <div class="card-pad muted small" style="padding-bottom:0">Once you add staff, the app asks “Who's working?” and a PIN every time it opens. Everything created is stamped with the person's name.
      <b>Owner</b> sees everything. <b>Service Advisor</b>: front desk, MendTech Mobile dispatch, quotes, jobs, invoices, payments, stock — no profit reports, expenses, closing or settings. <b>Technician</b>: job cards, My jobs, dispatch, vehicles, stock, bookings. <b>Driver</b>: My jobs and van stock only, no prices.</div>
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
      { k: 'pin', label: s ? 'New PIN (leave blank to keep)' : 'PIN (4–8 digits)', type: 'password', req: !s },
      { k: 'techId', label: 'Same person in Technicians (shows their jobs in “My jobs”)', type: 'select', options: () => S.technicians.map(t => [t.id, t.name]) },
      { k: 'active', label: 'Active', type: 'checkbox', def: true }],
    data: s ? { name: s.name, role: s.role, active: s.active !== false, techId: s.techId } : { active: true },
    onSave: async vals => {
      if (vals.pin && !/^\d{4,8}$/.test(vals.pin)) throw new Error('PIN must be 4–8 digits');
      const o = s || {};
      const owners = S.staff.filter(x => x.role === 'owner' && x.active !== false && x.id !== o.id).length;
      if ((vals.role !== 'owner' || !vals.active) && !owners) throw new Error('Keep at least one active Owner login');
      Object.assign(o, { name: vals.name, role: vals.role, active: vals.active, techId: vals.techId || '' });
      if (vals.pin) o.pinHash = await hashPin(vals.pin);
      await save('staff', o);
      if (!Auth.user) { Auth.user = o; try { sessionStorage.setItem('gp_user', o.id); } catch (e) { } }
      toast('Staff saved', 'ok'); render();
    },
    onDelete: s ? async () => {
      if (s.role === 'owner' && S.staff.filter(x => x.role === 'owner' && x.active !== false).length <= 1) { toast('This is the only Owner login', 'err'); return false; }
      if (!(await confirmBox(`Delete login for ${s.name}?`, 'Delete', true))) return false;
      await remove('staff', s.id); render(); return true;
    } : null,
  });
}
