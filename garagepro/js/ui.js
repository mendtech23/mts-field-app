/* GaragePro — UI framework: router, nav, modal, forms, tables */
'use strict';

const PAGES = {};
const UI = { filters: {} };        // remembered list filters per page
const $ = sel => document.querySelector(sel);
const view = () => document.getElementById('view');

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function currentRoute() { const h = location.hash.replace(/^#\/?/, ''); return h.split('/').map(decodeURIComponent); }

async function render() {
  let [name, ...args] = currentRoute();
  if (typeof Auth !== 'undefined') {
    if (Auth.requireLogin()) return;
    if (!Auth.canPage(name || 'dashboard')) {
      const home = Auth.role().home || 'dashboard';
      if ((name || 'dashboard') !== 'dashboard' || home === 'dashboard') toast('Your login does not have access to that page', 'err');
      name = home; args = []; history.replaceState(null, '', '#/' + home);
    }
  }
  const page = PAGES[name] || PAGES.dashboard;
  document.body.classList.remove('nav-open');
  closeAllModals();   // before any await, so windows opened right after a redraw stay open
  if (typeof edFlush === 'function') await edFlush();
  if (typeof REM_CACHE !== 'undefined') REM_CACHE.length = 0;
  view().classList.remove('locked');
  try { await page(...args); }
  catch (e) { console.error(e); view().innerHTML = `<div class="card card-pad red">Something went wrong: ${esc(e.message)}</div>`; }
  renderNav();
  view().scrollTop = 0;
}

const NAV = [
  { g: null, items: [['dashboard', '▦', 'Dashboard'], ['lookup', '⌕', 'Vehicle Lookup']] },
  { g: 'MendTech Mobile', items: [['dispatch', '🚐', 'Dispatch board', () => S.jobs.filter(j => isMobile(j) && MOBILE_OPEN.includes((j.mobile || {}).status || 'New')).length], ['myjobs', '📱', 'My jobs'], ['requests', '📥', 'Online requests', () => S.requests.filter(r => (r.status || 'New') === 'New').length], ['van', '🚚', 'Van stock']] },
  { g: 'Front desk', items: [['checkin', '＋', 'Check-in'], ['bookings', '📅', 'Bookings', () => S.bookings.filter(b => b.date === today() && ['Booked', 'Confirmed'].includes(b.status || 'Booked')).length], ['quotes', '✎', 'Quotations'], ['jobs', '🔧', 'Job Cards', () => S.jobs.filter(j => OPEN_JOB.includes(j.status)).length], ['invoices', '🧾', 'Invoices'], ['payments', '💳', 'Payments']] },
  { g: 'Customers', items: [['customers', '👤', 'Customers'], ['vehicles', '🚗', 'Vehicles'], ['reminders', '🔔', 'Reminders', () => reminderList().length]] },
  { g: 'Stock', items: [['parts', '📦', 'Parts & Stock', () => stockTable().filter(r => r.low).length], ['pos', '🚚', 'Purchase Orders'], ['suppliers', '🏭', 'Suppliers']] },
  { g: 'Setup', items: [['labour', '⏱', 'Labour Catalogue'], ['packages', '📦', 'Service Packages'], ['technicians', '👷', 'Technicians']] },
  { g: 'Finance', items: [['expenses', '💸', 'Expenses'], ['reports', '📊', 'Reports & P&L'], ['closing', '🔒', 'Month-end closing']] },
  { g: null, items: [['settings', '⚙', 'Settings & Backup']] },
];
const ROUTE_NAV = { vehicle: 'vehicles', customer: 'customers', quote: 'quotes', job: 'jobs', invoice: 'invoices', po: 'pos', search: 'lookup', package: 'packages' };
function activeNavFor(name, args) { if (name === 'job') { const j = get('jobs', args[0]); if (isMobile(j)) return Auth.canPage('dispatch') ? 'dispatch' : 'myjobs'; } return null; }

function renderNav() {
  const [name, ...rargs] = currentRoute();
  const active = activeNavFor(name, rargs) || ROUTE_NAV[name] || name || 'dashboard';
  const pt = document.getElementById('previewTag'); if (pt) pt.hidden = !IS_PREVIEW;
  document.body.classList.toggle('role-driver', !!(typeof Auth !== 'undefined' && Auth.user && Auth.user.role === 'driver'));
  let h = '';
  const allowed = id => typeof Auth === 'undefined' || Auth.canPage(id);
  for (const grp of NAV) {
    const items = grp.items.filter(([id]) => allowed(id));
    if (!items.length) continue;
    if (grp.g) h += `<div class="nav-group">${grp.g}</div>`;
    for (const [id, ico, label, badge] of items) {
      let b = ''; try { const n = badge ? badge() : 0; if (n) b = `<span class="badge">${n}</span>`; } catch (e) { }
      h += `<a class="nav-item ${active === id ? 'active' : ''}" href="#/${id}"><span class="ico">${ico}</span>${label}${b}</a>`;
    }
  }
  $('#nav').innerHTML = h;
  // phone bottom bar
  const bn = [['dashboard', 'home', 'Home'], ['jobs', 'tool', 'Jobs'], ['checkin', 'plus', 'Check-in', 'fab'], [allowed('dispatch') ? 'dispatch' : 'myjobs', 'truck', 'Mobile']].filter(([id]) => allowed(id));
  $('#bottomNav').innerHTML = bn.map(([id, icn, label, cls]) => `<a href="#/${id}" class="${cls || ''} ${active === id ? 'on' : ''}">${ic(icn)}<span>${label}</span></a>`).join('') +
    `<a onclick="document.body.classList.toggle('nav-open')">${ic('menu-2')}<span>More</span></a>`;
  const st = S.settings;
  const lb = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), today()) : null;
  const hasData = S.jobs.length + S.customers.length > 0;
  const cloudOk = typeof Sync !== 'undefined' && Sync.user;
  const tm = typeof Theme !== 'undefined' ? Theme.get() : 'auto';
  $('#backupHint').innerHTML = `<div class="row" style="justify-content:space-between"><div id="syncBadge"></div><button class="theme-btn" onclick="Theme.cycle()" title="Light / dark mode">${ic(tm === 'dark' ? 'moon' : tm === 'light' ? 'sun' : 'sun-moon')}${tm === 'auto' ? 'Auto' : tm === 'dark' ? 'Dark' : 'Light'}</button></div>` +
    (typeof Auth !== 'undefined' && Auth.user ? `<div class="side-user"><span class="av">${esc(Auth.user.name.slice(0, 1).toUpperCase())}</span><span class="grow">${esc(Auth.user.name)}<br><span class="faint">${esc(Auth.role().label)}</span></span><button class="btn sm dark" onclick="Auth.lock()" title="Lock / switch user">🔒</button></div>` : '') +
    (typeof Install !== 'undefined' && Install.prompt ? `<div><a class="warn" onclick="Install.run()">⬇ Install as app</a></div>` : '') +
    (typeof secUnread === 'function' && secCanSee() && secUnread() ? `<div><a class="warn" onclick="setFilter('settings','tab','staff');go('#/settings')">🚨 ${secUnread()} security alert${secUnread() > 1 ? 's' : ''} — click</a></div>` : '') +
    (!hasData || cloudOk ? `<div>v${APP_VERSION}</div>` :
      (lb == null || lb >= 7) ? `<span class="warn" onclick="setFilter('settings','tab','data');go('#/settings')">⚠ Backup ${lb == null ? 'never taken' : lb + ' days old'} — click</span>` :
        `Last backup: ${fmtDate(st.lastBackup)}`);
  if (typeof renderSyncBadge === 'function') renderSyncBadge();
}

/* ---------- Toast ---------- */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 5000 : 2600);
}

/* ---------- Modal ---------- */
function openModal({ title, body, foot = '', size = '', onOpen, sticky = false }) {
  const back = document.createElement('div');
  back.className = 'modal-back' + (sticky ? ' sticky' : '');
  back.innerHTML = `<div class="modal ${size}" role="dialog"><div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => back.remove();
  back.querySelector('[data-close]').onclick = close;
  back.addEventListener('mousedown', e => { if (e.target === back) back._downOnBack = true; });
  back.addEventListener('mouseup', e => { if (e.target === back && back._downOnBack && !sticky) close(); back._downOnBack = false; });
  back._close = close;
  $('#modalRoot').appendChild(back);
  const first = back.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
  if (first) setTimeout(() => first.focus(), 30);
  if (onOpen) onOpen(back);
  return { el: back, close };
}
function closeTopModal() { const all = document.querySelectorAll('.modal-back'); if (all.length && !all[all.length - 1].classList.contains('sticky')) all[all.length - 1].remove(); }
function closeAllModals() { document.querySelectorAll('.modal-back').forEach(m => m.remove()); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTopModal();
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#globalSearch').focus(); }
});

function confirmBox(msg, okLabel = 'Yes, continue', danger = false) {
  return new Promise(resolve => {
    const m = openModal({
      title: 'Please confirm', size: 'narrow', body: `<div style="white-space:pre-wrap">${msg}</div>`,
      foot: `<button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${okLabel}</button>`
    });
    m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
    m.el.querySelector('[data-close]').onclick = () => { m.close(); resolve(false); };
  });
}

/* ---------- Form builder ----------
   field: {k, label, type, options, req, span, help, ph, list, step, readonly} ; {section:'Title'} */
function optionsOf(f) { return typeof f.options === 'function' ? f.options() : (f.options || []); }
function fieldHTML(f, data) {
  if (f.section) return `<div class="fieldset-title">${esc(f.section)}</div>`;
  const v = data[f.k] ?? f.def ?? '';
  const id = 'f_' + f.k;
  const span = f.span === 'all' ? 'spanall' : f.span === 2 ? 'span2' : '';
  const req = f.req ? ' <span class="req">*</span>' : '';
  const ro = f.readonly ? 'readonly' : '';
  let inp;
  if (f.type === 'select') {
    const opts = optionsOf(f).map(o => Array.isArray(o) ? o : [o, o]);
    inp = `<select id="${id}" ${ro}>${f.blank !== false ? '<option value="">—</option>' : ''}${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    inp = `<textarea id="${id}" placeholder="${esc(f.ph || '')}" ${ro}>${esc(v)}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<div class="field ${span}"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px;color:var(--ink)"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>${f.help ? `<div class="help">${f.help}</div>` : ''}</div>`;
  } else {
    const type = f.type === 'plate' ? 'text' : (f.type || 'text');
    const listId = f.list ? id + '_dl' : '';
    const dl = f.list ? `<datalist id="${listId}">${(typeof f.list === 'function' ? f.list() : f.list).map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
    inp = `<input id="${id}" type="${type}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.step ? `step="${f.step}"` : type === 'number' ? 'step="any"' : ''} ${listId ? `list="${listId}"` : ''} class="${f.type === 'plate' ? 'plate-input' : ''}" ${ro} autocomplete="off">${dl}`;
  }
  return `<div class="field ${span}"><label for="${id}">${esc(f.label)}${req}</label>${inp}${f.help ? `<div class="help">${f.help}</div>` : ''}</div>`;
}
function formHTML(fields, data = {}, cols = 2) {
  return `<div class="grid g${cols}">${fields.map(f => fieldHTML(f, data)).join('')}</div>`;
}
function readForm(fields, root, into = {}) {
  for (const f of fields) {
    if (f.section) continue;
    const el = root.querySelector('#f_' + f.k);
    if (!el) continue;
    let v = f.type === 'checkbox' ? el.checked : el.value;
    if (typeof v === 'string') v = v.trim();
    if (f.type === 'number') v = v === '' ? '' : num(v);
    if (f.type === 'plate' && v) v = v.toUpperCase();
    if (f.req && (v === '' || v == null)) { el.focus(); el.style.borderColor = 'var(--red)'; throw new Error(`${f.label} is required`); }
    into[f.k] = v;
  }
  return into;
}
/* Generic add/edit modal */
function openForm({ title, fields, data = {}, onSave, onDelete, size = '', cols = 2, saveLabel = 'Save' }) {
  const m = openModal({
    title, size, body: formHTML(fields, data, cols),
    foot: `${onDelete ? '<button class="btn danger left" data-del>Delete</button>' : ''}<button class="btn" data-close2>Cancel</button><button class="btn primary" data-save>${saveLabel}</button>`
  });
  m.el.querySelector('[data-close2]').onclick = m.close;
  const doSave = async () => {
    try {
      const vals = readForm(fields, m.el, {});
      const res = await onSave(vals);
      if (res !== false) m.close();
    } catch (e) { toast(e.message, 'err'); }
  };
  m.el.querySelector('[data-save]').onclick = doSave;
  m.el.querySelectorAll('input:not([type=checkbox])').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && !i.list) doSave(); }));
  if (onDelete) m.el.querySelector('[data-del]').onclick = async () => { if (await onDelete()) m.close(); };
  return m;
}

/* ---------- Tables ---------- */
function table(cols, rows, opt = {}) {
  if (!rows.length) return `<div class="empty"><div class="big">${opt.emptyIcon || '📭'}</div>${opt.empty || 'Nothing here yet.'}</div>`;
  const head = cols.map(c => `<th class="${c.cls || ''}">${c.h}</th>`).join('');
  const body = rows.map(r => {
    const click = opt.click ? ` class="click" onclick="${esc(opt.click(r))}"` : '';
    return `<tr${click}>${cols.map(c => `<td class="${c.cls || ''}">${c.v(r) ?? ''}</td>`).join('')}</tr>`;
  }).join('');
  const foot = opt.foot ? `<tfoot><tr>${opt.foot.map(f => `<td class="${f.cls || ''}">${f.v ?? ''}</td>`).join('')}</tr></tfoot>` : '';
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
}

const PILL_COLORS = {
  Booked: 'blue', 'In Progress': 'orange', 'Awaiting Parts': 'amber', 'Awaiting Approval': 'violet', Ready: 'green', Delivered: 'gray', Cancelled: 'red',
  Draft: 'gray', Sent: 'blue', Approved: 'green', Declined: 'red', Converted: 'violet', Expired: 'amber',
  Paid: 'green', Partial: 'amber', Unpaid: 'red', Overdue: 'red', Void: 'gray', 'Not invoiced': 'gray',
  Ordered: 'blue', Received: 'green', OK: 'green', 'Due Soon': 'amber', 'No record': 'gray', Attention: 'amber', Replace: 'red',
  Active: 'green', Inactive: 'gray', Sold: 'gray', Low: 'red',
};
function pill(s, color) { return `<span class="pill ${color || PILL_COLORS[s] || ''}">${esc(s)}</span>`; }
function plateTag(v) { return v ? `<span class="plate">${esc(v.plate || '—')}</span>` : '<span class="faint">—</span>'; }
function custLink(c) { return c ? `<a onclick="event.stopPropagation();go('#/customer/${c.id}')">${esc(c.name)}</a>` : '<span class="faint">—</span>'; }
function vehLink(v) { return v ? `<a onclick="event.stopPropagation();go('#/vehicle/${v.id}')">${plateTag(v)}</a>` : '<span class="faint">—</span>'; }

function pageHead(title, sub = '', actions = '', crumb = '') {
  return `${crumb ? `<div class="crumb">${crumb}</div>` : ''}<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
}
function setFilter(page, key, val) { (UI.filters[page] = UI.filters[page] || {})[key] = val; render(); }
function getFilter(page, key, def = '') { return (UI.filters[page] || {})[key] ?? def; }
/* Search box that re-renders only the list area (keeps focus) */
function liveSearch(page, ph, targetFn) {
  return `<input class="inp" style="min-width:260px" type="search" placeholder="${ph}" value="${esc(getFilter(page, 'q'))}"
    oninput="(UI.filters['${page}']=UI.filters['${page}']||{}).q=this.value; ${targetFn}()">`;
}

/* ---------- Generic picker (parts, labour, vehicles...) ---------- */
function pickFrom({ title, items, row, filter, onPick, addNew, size = 'wide' }) {
  const m = openModal({
    title, size,
    body: `<div class="row mb"><input class="inp grow" id="pk_q" placeholder="Type to search…" autocomplete="off">${addNew ? `<button class="btn" id="pk_new">＋ ${addNew.label}</button>` : ''}</div><div id="pk_list"></div>`
  });
  const list = m.el.querySelector('#pk_list');
  const draw = () => {
    const q = m.el.querySelector('#pk_q').value.toLowerCase();
    const res = items().filter(it => !q || filter(it, q)).slice(0, 200);
    list.innerHTML = res.length ? res.map((it, i) => `<div class="dd-item" data-i="${i}">${row(it)}</div>`).join('') : '<div class="empty">No matches</div>';
    list.querySelectorAll('.dd-item').forEach(el => el.onclick = () => { m.close(); onPick(res[+el.dataset.i]); });
  };
  m.el.querySelector('#pk_q').oninput = draw;
  m.el.querySelector('#pk_q').onkeydown = e => { if (e.key === 'Enter') { const f = list.querySelector('.dd-item'); if (f) f.click(); } };
  if (addNew) m.el.querySelector('#pk_new').onclick = () => { m.close(); addNew.fn(m.el.querySelector('#pk_q').value); };
  draw();
  return m;
}

/* Download helper */
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src + ' (internet needed)'));
    document.head.appendChild(s);
  });
}
