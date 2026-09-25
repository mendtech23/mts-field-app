/* GaragePro — optional cloud sync (Supabase). Offline-first: the app always works from the
   local database; when signed in and online, changes are pushed/pulled in the background. */
'use strict';

const SYNC_SQL = `-- GaragePro cloud table (run once in Supabase → SQL Editor)
create table if not exists public.records (
  owner      uuid not null default auth.uid(),
  coll       text not null,
  id         text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz,
  server_ts  timestamptz not null default now(),
  primary key (owner, coll, id)
);
create index if not exists records_owner_ts on public.records (owner, server_ts);
alter table public.records enable row level security;
drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records for all
  using (owner = auth.uid()) with check (owner = auth.uid());
create or replace function public.records_touch() returns trigger
  language plpgsql as $$ begin new.server_ts = clock_timestamp(); return new; end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();`;

const Sync = {
  cfg: {}, client: null, user: null, status: 'off', lastSync: null, busy: false, again: false, timer: null, interval: null,

  loadCfg() {
    try { this.cfg = JSON.parse(localStorage.getItem('gp_sync') || '{}'); } catch (e) { this.cfg = {}; }
    if (!this.cfg.url && CFG.supabaseUrl) { this.cfg.url = CFG.supabaseUrl; this.cfg.key = CFG.supabaseKey; }   // new devices: only need to sign in
  },
  saveCfg() { try { localStorage.setItem('gp_sync', JSON.stringify(this.cfg)); } catch (e) { } },
  get enabled() { return !!(this.cfg.url && this.cfg.key && this.cfg.enabled); },

  async init() {
    // preview never touches the real cloud; it may use its own test project (config: previewCloud: true)
    if (IS_PREVIEW && !CFG.previewCloud) { this.cfg = {}; this.setStatus('preview'); return; }
    this.loadCfg();
    if (Cloud.accounts && this.cfg.url && this.cfg.key) this.cfg.enabled = true;
    const probe = !this.enabled && !!(this.cfg.url && this.cfg.key && CFG.garageId);   // new device of a known garage
    if (!this.enabled && !probe) { this.setStatus('off'); return; }
    try {
      await this.connect();
      const { data } = await this.client.auth.getSession();
      this.user = data && data.session ? data.session.user : null;
      if (!this.user && !Cloud.accounts && CFG.garageId) {   // a new device: has the garage switched personal logins on?
        try { const { data: mode } = await this.client.rpc('garage_mode', { p_garage: CFG.garageId }); if (mode === 'accounts') { lsSet('gp_accounts', '1'); this.cfg.enabled = true; this.saveCfg(); } } catch (e) { }
      }
      if (!this.user) { this.setStatus(this.enabled || Cloud.accounts ? 'signed-out' : 'off'); if (Cloud.accounts) { Cloud.me = null; Cloud.keep(); Auth.user = null; render(); } return; }
      // Security Level 2: who am I on the server?
      const wasAccounts = Cloud.accounts;
      try { await Cloud.refresh(); } catch (e) { console.warn('whoami', e.message); }   // offline: keep the cached answer
      if (Cloud.accounts) {
        if (Cloud.me && !Cloud.me.role) return Cloud.revoked('Your login was switched off by the Owner.');
        if (Cloud.me && Cloud.me.session_ok === false) return Cloud.revoked('This device was signed out by the Owner.');
        if (!wasAccounts || Cloud.needsCode()) { Auth.user = null; ssDel('gp_unlocked'); document.getElementById('lockScreen')?.remove(); render(); if (Cloud.needsCode()) return; }   // the changeover just happened here
        if (await Cloud.ensureScope()) render();
        if (!Auth.user) return;   // start after the person unlocks / signs in (Cloud.begin)
        Cloud.hello();
      }
      this.start();
    } catch (e) { this.setStatus('error', e.message); }
  },
  async connect() {
    if (!window.supabase) await loadScript('lib/supabase.js');
    this.client = window.supabase.createClient(this.cfg.url, this.cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gp_sb_auth' } });
  },
  start() {
    this.setStatus('ready');
    this.syncNow();
    clearInterval(this.interval); clearInterval(this.beat);
    this.interval = setInterval(() => this.syncNow(), 60000);
    if (Cloud.accounts) this.beat = setInterval(() => Cloud.heartbeat(), 5 * 60000);
    if (!this.listening) {
      this.listening = true;
      window.addEventListener('online', () => this.syncNow());
      window.addEventListener('offline', () => this.setStatus('offline'));
    }
  },
  stop() { clearInterval(this.interval); clearInterval(this.beat); clearTimeout(this.timer); this.interval = this.beat = null; this.setStatus('signed-out'); },
  async signIn(email, password, create) {
    if (!this.client) await this.connect();
    const fn = create ? this.client.auth.signUp.bind(this.client.auth) : this.client.auth.signInWithPassword.bind(this.client.auth);
    const { data, error } = await fn({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Account created — confirm the email Supabase sent you (or switch off “Confirm email” in Supabase → Authentication → Providers → Email), then sign in.');
    this.user = data.session.user; this.cfg.email = email; this.cfg.enabled = true; this.saveCfg();
    try { await Cloud.refresh(); } catch (e) { }   // is the cloud ready for Security Level 2?
    if (Cloud.accounts) return this.init();
    this.start();
  },
  async signOut() {
    try { if (this.client) await this.client.auth.signOut(); } catch (e) { }
    this.user = null; clearInterval(this.interval); this.setStatus('signed-out');
  },
  markDirty() {
    if (!this.enabled || !this.user || !this.interval) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), 2500);
  },
  setStatus(s, detail = '') { this.status = s; this.detail = detail; if (typeof renderSyncBadge === 'function') renderSyncBadge(); },

  async meta(id) { return (await DB.all('meta')).find(m => m.id === id); },

  async syncNow() {
    if (!this.enabled || !this.user) return;
    if (!navigator.onLine) return this.setStatus('offline');
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.setStatus('syncing');
    try {
      // still on the shared garage login: notice the moment the Owner switches personal logins on
      if (!Cloud.accounts && Cloud.level2) { await Cloud.refresh().catch(() => null); if (Cloud.accounts) { this.busy = false; Auth.user = null; ssDel('gp_user'); return this.init(); } }
      if (Cloud.crew) { const n = await crewSync(); this.lastSync = new Date(); this.setStatus('synced'); if (n) this.afterPull(); return; }
      const changed = await this.pull();
      await this.push();
      if (typeof pullOnlineRequests === 'function') await pullOnlineRequests();
      this.lastSync = new Date(); this.setStatus('synced');
      if (changed) this.afterPull();
    } catch (e) {
      console.warn('sync', e);
      if (/JWT|refresh token|not authenticated|session/i.test(e.message || '') && Cloud.accounts) { const { data } = await this.client.auth.getSession(); if (!data || !data.session) { await Cloud.forget(); showCloudLogin('Please sign in again.'); return; } }
      this.setStatus('error', e.message || String(e));
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; setTimeout(() => this.syncNow(), 500); }
    }
  },

  /* ---- download changes made on other devices ---- */
  async pull() {
    const st = (await this.meta('sync')) || { id: 'sync' };
    let since = st.lastPull || '1970-01-01T00:00:00Z', changed = 0;
    for (; ;) {
      const { data, error } = await this.client.from('records').select('coll,id,data,deleted,updated_at,server_ts')
        .gt('server_ts', since).order('server_ts', { ascending: true }).limit(400);
      if (error) throw error;
      for (const row of data) { if (await this.apply(row)) changed++; since = row.server_ts; }
      st.lastPull = since; await DB.put('meta', st);
      if (data.length < 400) break;
    }
    return changed;
  },
  async apply(row) {
    const { coll, id, data, deleted } = row;
    const rts = row.updated_at || (data && data.updatedAt) || '';
    if (coll === 'settings') {
      if (deleted || !data) return false;
      if ((S.settings.updatedAt || '') >= (data.updatedAt || '')) return false;
      S.settings = mergeDeep(structuredClone(DEFAULT_SETTINGS), data);
      await DB.put('meta', S.settings);
      await DB.put('meta', { id: 'settingsBase', data });
      if ((S.settings.schema || 0) < 21) setTimeout(migrateSettings, 0);   // settings came from an older version
      return true;
    }
    if (coll === 'photos') {
      if (deleted) { await DB.del('photos', id); return true; }
      await DB.put('photos', data); return true;
    }
    if (!COLLECTIONS.includes(coll)) return false;
    if (typeof ED !== 'undefined' && ED.doc && ED.doc.id === id) return false;   // being edited here — local wins
    const local = get(coll, id);
    if (deleted) {
      if (!local || (local.updatedAt || '') > rts) return false;
      S[coll] = S[coll].filter(x => x.id !== id); await DB.del(coll, id); return true;
    }
    if (local && (local.updatedAt || '') >= (data.updatedAt || '')) return false;
    if (coll === 'quotes' && local && data.approval && data.approval.via === 'link' && local.status !== data.status)
      setTimeout(() => toast(`Quotation ${data.number} ${data.status === 'Approved' ? 'APPROVED' : 'declined'} by ${data.approval.name} (online)`, data.status === 'Approved' ? 'ok' : 'err'), 300);
    const i = S[coll].findIndex(x => x.id === id);
    if (i >= 0) S[coll][i] = data; else S[coll].push(data);
    await DB.put(coll, data); return true;
  },

  /* ---- upload changes made on this device ---- */
  /* the garage's rows (Level 2: every login writes into the garage, not its own account) */
  get owner() { return (Cloud.me && Cloud.me.garage_id) || this.user.id; },
  /* collections this login may upload (the database refuses the rest anyway) */
  canPush(c) {
    const r = Cloud.accounts ? Cloud.role : 'owner';
    if (r === 'owner') return true;
    if (['staff', 'secLog'].includes(c)) return false;
    return !(r === 'advisor' && ['expenses', 'incomes'].includes(c));
  },
  async pendingCount() {
    const since = ((await this.meta('sync')) || {}).lastPush || '';
    let n = 0; for (const c of COLLECTIONS) if (this.canPush(c)) n += S[c].filter(r => (r.updatedAt || '') > since).length;
    return n + (((await this.meta('tombs')) || {}).list || []).length;
  },
  async push() {
    const st = (await this.meta('sync')) || { id: 'sync' };
    const since = st.lastPush || '';
    const started = new Date().toISOString();
    const rows = [];
    const owner = this.owner;
    for (const c of COLLECTIONS) if (this.canPush(c)) for (const r of S[c]) if ((r.updatedAt || '') > since) rows.push({ owner, coll: c, id: r.id, data: r, deleted: false, updated_at: r.updatedAt });
    if ((S.settings.updatedAt || '') > since) await this.pushSettings(owner);
    const tombs = (await this.meta('tombs')) || { id: 'tombs', list: [] };
    for (const t of tombs.list) if (this.canPush(t.coll)) rows.push({ owner, coll: t.coll, id: t.id, data: null, deleted: true, updated_at: t.at });
    for (let i = 0; i < rows.length; i += 200) await this.upsert(rows.slice(i, i + 200));
    // photos: larger, send in small batches
    const photos = (await DB.all('photos')).filter(p => (p.updatedAt || p.date || '') > since);
    for (let i = 0; i < photos.length; i += 4)
      await this.upsert(photos.slice(i, i + 4).map(p => ({ owner, coll: 'photos', id: p.id, data: p, deleted: false, updated_at: p.updatedAt || p.date })));
    const sentTombs = new Set(tombs.list.map(t => t.coll + '|' + t.id + '|' + t.at));
    const fresh = (await this.meta('tombs')) || { id: 'tombs', list: [] };
    fresh.list = fresh.list.filter(t => !sentTombs.has(t.coll + '|' + t.id + '|' + t.at));
    await DB.put('meta', fresh);
    const st2 = (await this.meta('sync')) || { id: 'sync' };
    st2.lastPush = started; await DB.put('meta', st2);
  },
  async upsert(rows) {
    if (!rows.length) return;
    const { error } = await this.client.from('records').upsert(rows, { onConflict: 'owner,coll,id' });
    if (!error) return;
    if (!isRefusal(error)) throw error;
    // the server refused something (e.g. a void without the Owner's approval): send one by one, undo only the refused ones
    if (rows.length === 1) return this.refused(rows[0], error);
    for (const r of rows) {
      const { error: e } = await this.client.from('records').upsert([r], { onConflict: 'owner,coll,id' });
      if (e) { if (isRefusal(e)) await this.refused(r, e); else throw e; }
    }
  },
  /* a refused change is undone on this device: the cloud copy comes back (or a refused new record goes away) */
  async refused(row, err) {
    console.warn('refused', row.coll, row.id, err.message);
    const { data } = await this.client.from('records').select('coll,id,data,deleted,updated_at').eq('owner', row.owner).eq('coll', row.coll).eq('id', row.id).limit(1);
    const srv = data && data[0], local = row.coll === 'photos' ? null : get(row.coll, row.id);
    if (row.coll !== 'photos' && COLLECTIONS.includes(row.coll)) {
      if (srv && !srv.deleted && srv.data) { const i = S[row.coll].findIndex(x => x.id === row.id); if (i >= 0) S[row.coll][i] = srv.data; else S[row.coll].push(srv.data); await DB.put(row.coll, srv.data); }
      else { S[row.coll] = S[row.coll].filter(x => x.id !== row.id); await DB.del(row.coll, row.id); }
      if (typeof ED !== 'undefined' && ED.doc && ED.doc.id === row.id) ED.doc = get(row.coll, row.id);
    }
    const what = `${(COLL_LABEL[row.coll] || row.coll).toLowerCase()} ${(local || (srv && srv.data) || {}).number || (local || (srv && srv.data) || {}).name || ''}`.trim();
    const why = /APPROVAL_NEEDED/.test(err.message) ? 'it needs the Owner\'s approval' : /row-level|permission/i.test(err.message) ? 'your login is not allowed to change it' : err.message.replace(/^[A-Z_]+: /, '');
    toast(`Not saved: ${what} — ${why}. Undone on this device.`, 'err');
    this.refusedAny = true;
  },
  /* settings are one shared record: send only what this device changed, on top of the latest cloud copy.
     Staff other than the Manager only move the document numbers forward. */
  async pushSettings(owner) {
    const base = ((await this.meta('settingsBase')) || {}).data || null;
    const { data: rows, error } = await this.client.from('records').select('data').eq('owner', owner).eq('coll', 'settings').eq('id', 'settings').limit(1);
    if (error) throw error;
    const server = rows && rows[0] && rows[0].data, local = S.settings, J = JSON.stringify;
    const role = Cloud.accounts ? Cloud.role : 'owner', full = role === 'owner' || role === 'manager';
    let merged;
    if (!server) merged = structuredClone(local);
    else {
      merged = structuredClone(server);
      if (full) for (const k of Object.keys(local)) {
        if (k === 'counters' || k === 'updatedAt' || k === 'id') continue;
        const mine = base ? J(local[k]) !== J(base[k]) : (local.updatedAt || '') > (server.updatedAt || '');
        if (mine && J(local[k]) !== J(server[k])) merged[k] = structuredClone(local[k]);
      }
      merged.counters = { ...(server.counters || {}) };
      for (const [k, v] of Object.entries(local.counters || {})) merged.counters[k] = Math.max(num(v), num(merged.counters[k]));
    }
    const changed = !server || J({ ...merged, updatedAt: 0 }) !== J({ ...server, updatedAt: 0 });
    if (changed) {
      merged.updatedAt = new Date().toISOString();
      const { error: e } = await this.client.from('records').upsert([{ owner, coll: 'settings', id: 'settings', data: merged, deleted: false, updated_at: merged.updatedAt }], { onConflict: 'owner,coll,id' });
      if (e) {
        if (!isRefusal(e)) throw e;
        const why = /APPROVAL_NEEDED/.test(e.message) ? 'needs the Owner\'s approval' : e.message.replace(/^[A-Z_]+: /, '');
        toast(`Settings change not saved — ${why}. Undone on this device.`, 'err');
        merged = structuredClone(server); merged.counters = { ...(server.counters || {}) };
        for (const [k, v] of Object.entries(local.counters || {})) merged.counters[k] = Math.max(num(v), num(merged.counters[k]));
        if (J(merged.counters) !== J(server.counters || {})) {
          merged.updatedAt = new Date().toISOString();
          const { error: e2 } = await this.client.from('records').upsert([{ owner, coll: 'settings', id: 'settings', data: merged, deleted: false, updated_at: merged.updatedAt }], { onConflict: 'owner,coll,id' });
          if (e2) throw e2;
        } else merged = server;
      }
    }
    S.settings = mergeDeep(structuredClone(DEFAULT_SETTINGS), merged);
    await DB.put('meta', S.settings);
    await DB.put('meta', { id: 'settingsBase', data: merged });
  },
  afterPull() {
    const [name] = currentRoute();
    if (['quote', 'job', 'invoice'].includes(name)) { toast('Updated from another device', ''); renderNav(); return; }
    render();
  },
  /* start again from scratch on this device (download everything) */
  async resetCursor() { await DB.put('meta', { id: 'sync' }); },
};

function renderSyncBadge() {
  const el = document.getElementById('syncBadge'); if (!el) return;
  const s = Sync.status;
  const map = {
    off: ['☁ Local only', 'faint', 'Cloud sync is off — data is on this computer only'],
    preview: ['🧪 Preview — not synced', 'warn', 'Preview mode: separate test data, cloud sync switched off'],
    'signed-out': ['☁ Sign in to sync', 'warn', 'Cloud sync is set up but not signed in'],
    ready: ['☁ Connecting…', '', ''], syncing: ['⟳ Syncing…', '', ''],
    synced: ['☁ Synced ' + (Sync.lastSync ? Sync.lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''), 'ok', 'All changes saved to the cloud'],
    offline: ['⚡ Offline — will sync later', 'warn', 'No internet. Keep working — changes upload automatically when back online.'],
    error: ['⚠ Sync problem', 'warn', Sync.detail || ''],
  };
  const [t, cls, title] = map[s] || map.off;
  el.innerHTML = `<span class="sync ${cls}" title="${esc(title)}" onclick="setFilter('settings','tab','cloud');go('#/settings')">${t}</span>`;
}

const isRefusal = e => ['P0001', '42501'].includes(e.code) || /APPROVAL_NEEDED|row-level security|permission denied|Only the Owner|Advisors cannot/i.test(e.message || '');

/* ---------- Settings → Cloud & devices tab ---------- */
function cloudSettingsHTML() {
  if (Cloud.accounts) return cloudAccountHTML();
  if (IS_PREVIEW && !CFG.previewCloud) return `<div class="card card-pad"><h3>🧪 Preview mode</h3><p class="muted">This is the MendTech Mobile preview. It uses its own test database and never connects to your real cloud data, so you can try anything safely.</p>
    <p class="muted">To test with a copy of your real data: in the live app download a backup, then here use <b>Backup & data → Restore from backup</b>. Nothing is sent back to the live app.</p>
    <p class="muted">When you're happy, the live version (same app, cloud sync on) is published over your current site.</p></div>`;
  const c = Sync.cfg;
  const onHttp = location.protocol.startsWith('http');
  return `<div class="grid g2">
    <div class="card card-pad"><h3>☁ Cloud sync — use the app on several devices</h3>
      <p class="muted">Keep the same live data on the office PC, your phone and a workshop tablet, with an automatic cloud backup. The app still works offline and catches up when the internet comes back. Uses <b>Supabase</b> (free plan is enough for a garage).</p>
      <div class="grid g1" style="gap:10px">
        <div class="field"><label>Supabase Project URL</label><input id="sy_url" value="${esc(c.url || '')}" placeholder="https://xxxxxxxx.supabase.co"></div>
        <div class="field"><label>Supabase anon / public key</label><input id="sy_key" value="${esc(c.key || '')}" placeholder="eyJhbGciOi…"></div>
        <div class="row"><button class="btn" onclick="saveCloudCfg()">Save connection</button></div>
        <hr class="sep">
        ${Sync.user ? `<div>Signed in as <b>${esc(Sync.user.email)}</b> — status: <span id="syStatus">${esc(Sync.status)}</span> ${Sync.detail ? `<div class="small red">${esc(Sync.detail)}</div>` : ''}</div>
          <div class="row"><button class="btn primary" onclick="Sync.syncNow().then(render)">⟳ Sync now</button><button class="btn" onclick="Sync.signOut().then(render)">Sign out</button>
          <button class="btn" onclick="resyncAll()">Download everything again</button></div>` :
      `<div class="field"><label>Garage login email</label><input id="sy_email" value="${esc(c.email || '')}"></div>
          <div class="field"><label>Password (min 6 characters)</label><input id="sy_pass" type="password"></div>
          <div class="row"><button class="btn primary" onclick="cloudSignIn(false)">Sign in</button><button class="btn" onclick="cloudSignIn(true)">Create garage account</button></div>
          <div class="help">Use ONE garage login on all your devices. Staff then sign in with their own PIN inside the app.</div>`}
      </div></div>
    <div class="card card-pad"><h3>🛠 One-time setup (10 minutes)</h3>
      <ol style="line-height:1.8;padding-left:18px;margin:6px 0">
        <li>Create a free account at <b>supabase.com</b> (use your personal email) → <b>New project</b> (region: close to UAE, e.g. Mumbai or Frankfurt).</li>
        <li>Open <b>SQL Editor</b> → paste the script below → <b>Run</b>.</li>
        <li><b>Authentication → Providers → Email</b>: turn off “Confirm email” (or confirm the email when asked).</li>
        <li><b>Project Settings → API</b>: copy the <b>Project URL</b> and the <b>anon public</b> key into the boxes here → Save.</li>
        <li>Click <b>Create garage account</b>. Your existing data uploads automatically.</li>
        <li>On other devices open the app, paste the same URL + key and <b>Sign in</b>.</li></ol>
      <div class="row mb"><button class="btn sm" onclick="navigator.clipboard.writeText(SYNC_SQL).then(()=>toast('SQL copied'))">📋 Copy SQL script</button></div>
      <pre class="mono small" style="background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;max-height:200px;overflow:auto;white-space:pre-wrap">${esc(SYNC_SQL)}</pre></div>
    <div class="card card-pad spanall"><h3>📱 Open it online / on your phone</h3>
      <p class="muted" style="margin-top:0">${onHttp ? `You're using the online version (${esc(location.host)}). ${Install.prompt ? '' : 'To install: browser menu → “Install app” / “Add to Home screen”.'}` : 'You are using the offline copy on this PC. To use GaragePro on your phone or any computer:'}</p>
      <ol style="line-height:1.8;padding-left:18px;margin:6px 0">
        <li>Go to <b>app.netlify.com/drop</b> (free, sign up with your personal email) and drag the whole <b>GaragePro</b> folder onto the page. You get a private https web address.</li>
        <li>Open that address on your phone → browser menu → <b>Add to Home screen</b>. It then opens like a normal app and works offline too.</li>
        <li>Connect cloud sync (left) on every device so they all share the same data.</li></ol>
      ${Install.prompt ? '<button class="btn primary" onclick="Install.run()">⬇ Install GaragePro on this device</button>' : ''}</div>
  </div>`;
}
async function saveCloudCfg() {
  Sync.cfg.url = $('#sy_url').value.trim().replace(/\/$/, ''); Sync.cfg.key = $('#sy_key').value.trim();
  Sync.cfg.enabled = !!(Sync.cfg.url && Sync.cfg.key); Sync.client = null; Sync.saveCfg();
  toast('Connection saved', 'ok'); await Sync.init(); render();
}
async function cloudSignIn(create) {
  try {
    if (!Sync.cfg.url || !Sync.cfg.key) throw new Error('Save the Supabase URL and key first');
    Sync.cfg.enabled = true; Sync.saveCfg();
    await Sync.signIn($('#sy_email').value.trim(), $('#sy_pass').value, create);
    toast(create ? 'Garage account created — syncing' : 'Signed in — syncing', 'ok'); render();
  } catch (e) { toast(e.message, 'err'); }
}
async function resyncAll() {
  if (!(await confirmBox('Download all data from the cloud again? Local changes that are newer are kept.'))) return;
  await Sync.resetCursor(); await Sync.syncNow(); render();
}

/* ---------- Install as an app (PWA) ---------- */
const Install = {
  prompt: null,
  init() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); Install.prompt = e; renderNav(); });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  },
  async run() { if (!Install.prompt) return; Install.prompt.prompt(); await Install.prompt.userChoice; Install.prompt = null; renderNav(); },
};
