// mendtech. — the Owner manages staff logins (only from a session signed in with password + authenticator code).
// Deploy: Supabase → Edge Functions → new function "staff-admin" → paste this file.
// POST { action: 'list' | 'create' | 'update' | 'password' | 'signout', ... } with the Owner's access token.

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('PUBLISHABLE_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_KEY')!;
const ROLES = ['manager', 'advisor', 'technician', 'driver'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const hdr = (key: string, bearer?: string) => ({
  apikey: key, 'Content-Type': 'application/json',
  ...(bearer ? { Authorization: 'Bearer ' + bearer } : key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }),
});
class Bad extends Error { constructor(public status: number, msg: string) { super(msg); } }
async function call(path: string, init: RequestInit & { key?: string; bearer?: string } = {}) {
  const r = await fetch(URL_ + path, { ...init, headers: hdr(init.key || SERVICE, init.bearer) });
  const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Bad(r.status >= 500 ? 500 : 400, (j && (j.msg || j.message || j.error_description)) || `Error ${r.status}`);
  return j;
}
const srv = (fn: string, args: Record<string, unknown>) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
const clean = (s: unknown, n = 60) => String(s ?? '').trim().slice(0, n);
function checkPassword(p: string) {
  if (typeof p !== 'string' || p.length < 8) throw new Bad(400, 'Password must be at least 8 characters');
  if (p.length > 72) throw new Bad(400, 'Password is too long');
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) throw new Bad(400, 'Password needs letters and numbers');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new Bad(401, 'Sign in first');
    // who is calling — the database answers with the caller's own token, so nothing here can be faked
    const me = await call('/rest/v1/rpc/whoami', { method: 'POST', key: ANON, bearer: token, body: '{}' });
    if (!me || me.role !== 'owner' || !me.session_ok) throw new Bad(403, 'Only the Owner can manage staff logins');
    if (me.aal !== 'aal2') throw new Bad(403, 'MFA_REQUIRED: Set up the authenticator app on the Owner login first (Settings → Staff & security)');
    const G = me.garage_id as string;
    const body = await req.json().catch(() => ({}));
    const members = async () => await call(`/rest/v1/members?select=*&garage_id=eq.${G}&order=created_at.asc`, { method: 'GET' }) as any[];
    const target = async (id: string) => {
      const m = (await members()).find((x) => x.user_id === id);
      if (!m) throw new Bad(404, 'Login not found');
      if (m.role === 'owner') throw new Bad(400, 'The Owner login is changed from Settings → Staff & security');
      return m;
    };
    const alert = (level: string, text: string) => srv('srv_alert', { p_garage: G, p_level: level, p_kind: 'staff', p_text: text });

    switch (body.action) {
      case 'list': {
        const ms = await members();
        const devs = await call(`/rest/v1/devices?select=user_id,label,last_seen,revoked&garage_id=eq.${G}&order=last_seen.desc`, { method: 'GET' }) as any[];
        return reply(200, ms.map((m) => ({ ...m, last_seen: (devs.find((d) => d.user_id === m.user_id && !d.revoked) || {}).last_seen || null })));
      }
      case 'create': {
        const username = clean(body.username, 20).toLowerCase(), name = clean(body.name), role = clean(body.role, 20);
        if (!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(username)) throw new Bad(400, 'Username: 3-20 letters/numbers (dot, dash, underscore allowed), no spaces');
        if (username === 'owner') throw new Bad(400, 'That username is reserved');
        if (!name) throw new Bad(400, 'Enter the person\'s name');
        if (!ROLES.includes(role)) throw new Bad(400, 'Choose a role');
        if ((role === 'technician' || role === 'driver') && !clean(body.tech_id)) throw new Bad(400, 'Link a Technician / Driver to this login');
        checkPassword(body.password);
        if (await srv('srv_login_lookup', { p_login: username })) throw new Bad(400, 'That username is already taken');
        const u = await call('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({
          email: `${crypto.randomUUID()}@staff.mendtech.invalid`, password: body.password, email_confirm: true,
          user_metadata: { kind: 'staff', garage: G } }) });
        try {
          const m = await srv('srv_member_upsert', { p_user: u.id, p_garage: G, p_username: username, p_name: name, p_role: role, p_tech: clean(body.tech_id), p_active: true, p_by: me.user_id });
          await alert('warn', `New ${role} login created: ${name} (${username})`);
          return reply(200, m);
        } catch (e) { await call(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }).catch(() => {}); throw e; }
      }
      case 'update': {
        const m = await target(body.user_id);
        const role = body.role !== undefined ? clean(body.role, 20) : m.role;
        if (!ROLES.includes(role)) throw new Bad(400, 'Choose a role');
        const username = body.username !== undefined ? clean(body.username, 20).toLowerCase() : m.username;
        if (!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(username) || username === 'owner') throw new Bad(400, 'Username: 3-20 letters/numbers, no spaces');
        if (username !== m.username && await srv('srv_login_lookup', { p_login: username })) throw new Bad(400, 'That username is already taken');
        const active = body.active !== undefined ? !!body.active : m.active;
        const next = await srv('srv_member_upsert', { p_user: m.user_id, p_garage: G, p_username: username, p_name: body.name !== undefined ? clean(body.name) || m.name : m.name,
          p_role: role, p_tech: body.tech_id !== undefined ? clean(body.tech_id) : m.tech_id, p_active: active, p_by: me.user_id });
        if (active !== m.active) {
          await call(`/auth/v1/admin/users/${m.user_id}`, { method: 'PUT', body: JSON.stringify({ ban_duration: active ? 'none' : '876000h' }) });
          if (!active) await srv('srv_kill_sessions', { p_user: m.user_id });
          await alert(active ? 'warn' : 'alert', `${m.name} (${m.username}) login ${active ? 'switched back on' : 'switched OFF and signed out everywhere'}`);
        }
        const changed = [role !== m.role && `role ${m.role} → ${role}`, username !== m.username && `username ${m.username} → ${username}`,
          next.name !== m.name && `name → ${next.name}`, (next.tech_id || '') !== (m.tech_id || '') && 'linked technician'].filter(Boolean);
        if (changed.length) await alert('warn', `${m.name} login changed: ${changed.join(', ')}`);
        return reply(200, next);
      }
      case 'password': {
        const m = await target(body.user_id);
        checkPassword(body.password);
        await call(`/auth/v1/admin/users/${m.user_id}`, { method: 'PUT', body: JSON.stringify({ password: body.password }) });
        const n = await srv('srv_kill_sessions', { p_user: m.user_id });
        await alert('warn', `Password reset for ${m.name} (${m.username}) — signed out of ${n} device(s)`);
        return reply(200, { ok: true, signed_out: n });
      }
      case 'signout': {
        const m = await target(body.user_id);
        const n = await srv('srv_kill_sessions', { p_user: m.user_id });
        await alert('warn', `${m.name} (${m.username}) signed out of all devices (${n})`);
        return reply(200, { ok: true, signed_out: n });
      }
      default: throw new Bad(400, 'Unknown action');
    }
  } catch (e) {
    if (e instanceof Bad) return reply(e.status, { error: e.message });
    console.error(e);
    return reply(500, { error: 'Something went wrong — try again' });
  }
});
