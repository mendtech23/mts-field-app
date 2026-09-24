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
    if (IS_PREVIEW) { this.cfg = {}; this.setStatus('preview'); return; }   // preview never touches the real cloud
    this.loadCfg();
    if (!this.enabled) { this.setStatus('off'); return; }
    try {
      await this.connect();
      const { data } = await this.client.auth.getSession();
      this.user = data && data.session ? data.session.user : null;
      if (!this.user) { this.setStatus('signed-out'); return; }
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
    clearInterval(this.interval);
    this.interval = setInterval(() => this.syncNow(), 60000);
    window.addEventListener('online', () => this.syncNow());
    window.addEventListener('offline', () => this.setStatus('offline'));
  },
  async signIn(email, password, create) {
    if (!this.client) await this.connect();
    const fn = create ? this.client.auth.signUp.bind(this.client.auth) : this.client.auth.signInWithPassword.bind(this.client.auth);
    const { data, error } = await fn({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Account created — confirm the email Supabase sent you (or switch off “Confirm email” in Supabase → Authentication → Providers → Email), then sign in.');
    this.user = data.session.user; this.cfg.email = email; this.cfg.enabled = true; this.saveCfg();
    this.start();
  },
  async signOut() {
    try { if (this.client) await this.client.auth.signOut(); } catch (e) { }
    this.user = null; clearInterval(this.interval); this.setStatus('signed-out');
  },
  markDirty() {
    if (!this.enabled || !this.user) return;
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
      const changed = await this.pull();
      await this.push();
      if (typeof pullOnlineRequests === 'function') await pullOnlineRequests();
      this.lastSync = new Date(); this.setStatus('synced');
      if (changed) this.afterPull();
    } catch (e) {
      console.warn('sync', e);
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
    const i = S[coll].findIndex(x => x.id === id);
    if (i >= 0) S[coll][i] = data; else S[coll].push(data);
    await DB.put(coll, data); return true;
  },

  /* ---- upload changes made on this device ---- */
  async push() {
    const st = (await this.meta('sync')) || { id: 'sync' };
    const since = st.lastPush || '';
    const started = new Date().toISOString();
    const rows = [];
    const owner = this.user.id;
    for (const c of COLLECTIONS) for (const r of S[c]) if ((r.updatedAt || '') > since) rows.push({ owner, coll: c, id: r.id, data: r, deleted: false, updated_at: r.updatedAt });
    if ((S.settings.updatedAt || '') > since) rows.push({ owner, coll: 'settings', id: 'settings', data: S.settings, deleted: false, updated_at: S.settings.updatedAt });
    const tombs = (await this.meta('tombs')) || { id: 'tombs', list: [] };
    for (const t of tombs.list) rows.push({ owner, coll: t.coll, id: t.id, data: null, deleted: true, updated_at: t.at });
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
    if (error) throw error;
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

/* ---------- Settings → Cloud & devices tab ---------- */
function cloudSettingsHTML() {
  if (IS_PREVIEW) return `<div class="card card-pad"><h3>🧪 Preview mode</h3><p class="muted">This is the MendTech Mobile preview. It uses its own test database and never connects to your real cloud data, so you can try anything safely.</p>
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
