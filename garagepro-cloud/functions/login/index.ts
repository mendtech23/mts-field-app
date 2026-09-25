// mendtech. — sign-in with username (staff) or e-mail (Owner), with lockout + alerts.
// Deploy: Supabase → Edge Functions → new function "login" → paste this file → turn OFF "Verify JWT".
// POST { login, password }  →  200 { session }  |  401 { error: 'WRONG', left }  |  429 { error: 'LOCKED', minutes }

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('PUBLISHABLE_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
// new-style keys (sb_...) go in apikey only; legacy JWT keys also as Bearer
const hdr = (key: string) => ({ apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }) });
async function srv(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: hdr(SERVICE), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  try {
    const { login, password } = await req.json().catch(() => ({}));
    const name = String(login || '').trim().toLowerCase();
    if (!name || !password || name.length > 200 || String(password).length > 200) return reply(400, { error: 'MISSING', message: 'Enter your username and password' });
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;

    const who = await srv('srv_login_lookup', { p_login: name });
    const key = who ? 'id:' + who.user_id : 'u:' + name;
    const chk = await srv('srv_login_check', { p_key: key });
    if (chk.locked_min > 0) return reply(429, { error: 'LOCKED', minutes: chk.locked_min, message: `Too many wrong tries — this login is locked for ${chk.locked_min} min. The Owner has been alerted.` });

    let session: Record<string, unknown> | null = null;
    if (who && who.active) {
      const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: hdr(ANON), body: JSON.stringify({ email: who.email, password }) });
      if (r.ok) session = await r.json();
    }
    if (who && !who.active && session === null) {
      await srv('srv_login_result', { p_key: key, p_ok: false, p_garage: who.garage_id, p_who: who.who + ' (switched off)', p_ip: ip });
      return reply(403, { error: 'OFF', message: 'This login is switched off. Ask the Owner.' });
    }
    const res = await srv('srv_login_result', { p_key: key, p_ok: !!session, p_garage: who ? who.garage_id : null, p_who: who ? who.who : name, p_ip: ip });
    if (!session) {
      if (res.locked_min) return reply(429, { error: 'LOCKED', minutes: res.locked_min, message: `Too many wrong tries — this login is locked for ${res.locked_min} min. The Owner has been alerted.` });
      return reply(401, { error: 'WRONG', left: res.left, message: `Wrong username or password${res.left <= 2 ? ` — ${res.left} ${res.left === 1 ? 'try' : 'tries'} left` : ''}` });
    }
    return reply(200, { session, role: who.role });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'SERVER', message: 'Sign-in is not available right now. Try again in a minute.' });
  }
});
