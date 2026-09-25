// mendtech. — e-mails security alerts (instantly) and a daily summary (20:00 Dubai) through Resend.
// Deploy: Supabase → Edge Functions → new function "notify" → paste this file → turn OFF "Verify JWT".
// Secrets (Edge Functions → Secrets): RESEND_API_KEY. Optional: ALERT_FROM (default "mendtech. alerts <onboarding@resend.dev>").
// POST { alert_id }  → e-mails that alert once (called by the database)
// POST { daily: true } with header x-cron-secret → e-mails the summary since the last one (called by pg_cron)

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_KEY')!;
const RESEND = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_URL = Deno.env.get('RESEND_URL') || 'https://api.resend.com/emails';
const FROM = Deno.env.get('ALERT_FROM') || 'mendtech. alerts <onboarding@resend.dev>';
const APP_LINK = Deno.env.get('APP_URL') || '';

const hdr = (key: string) => ({ apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }) });
async function srv(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: hdr(SERVICE), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dubai = (d: string | Date) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const DOT: Record<string, string> = { alert: '#C62828', warn: '#D97A2B', info: '#6C7488' };
const COLL: Record<string, string> = { invoices: 'Invoices', quotes: 'Quotations', jobs: 'Jobs', payments: 'Payments', customers: 'Customers', vehicles: 'Vehicles',
  expenses: 'Expenses', incomes: 'Other income', parts: 'Parts', settings: 'Settings', photos: 'Photos', staff: 'PIN logins', technicians: 'Technicians', renewals: 'Renewals', partners: 'Partners', campaigns: 'Campaigns',
  stockAdjustments: 'Stock movements', labour: 'Labour items', packages: 'Service packages', bookings: 'Bookings', suppliers: 'Suppliers', purchaseOrders: 'Purchase orders', messages: 'Messages', secLog: 'Security log' };
const ACT: Record<string, string> = { create: 'added', update: 'changed', delete: 'deleted' };

function frame(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#F3F5F8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#122036">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#122036;color:#fff;border-radius:12px 12px 0 0;padding:18px 22px;font:700 22px 'Space Grotesk',Arial,sans-serif">mendtech<span style="color:#D97A2B">.</span>
      <div style="font:500 11px Inter,Arial,sans-serif;letter-spacing:.18em;color:#9AA3B5;margin-top:2px">AUTO · MOBILE — SECURITY</div></div>
    <div style="background:#fff;border:1px solid #DEE3E9;border-top:0;border-radius:0 0 12px 12px;padding:22px">
      <h2 style="margin:0 0 14px;font-size:17px">${esc(title)}</h2>${inner}
      ${APP_LINK ? `<p style="margin:22px 0 0"><a href="${esc(APP_LINK)}" style="background:#122036;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px">Open the app</a></p>` : ''}
      <p style="color:#6C7488;font-size:12px;margin:22px 0 0">You get this because this address is set in Settings → Staff &amp; security → Alert e-mail. If something here was not you or your team, open the app → Settings → Staff &amp; security and sign that device out.</p>
    </div></div></body></html>`;
}
async function send(to: string, subject: string, html: string) {
  if (!RESEND) throw new Error('RESEND_API_KEY is not set');
  const r = await fetch(RESEND_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }) });
  if (!r.ok) throw new Error('Resend ' + r.status + ' ' + await r.text());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.alert_id) {
      const a = await srv('srv_alert_get', { p_id: Number(body.alert_id) });
      if (!a || a.emailed || !a.email || a.level === 'info') return Response.json({ skipped: true });
      const icon = a.level === 'alert' ? '🔴' : '🟠';
      await send(a.email, `${icon} ${a.text}`.slice(0, 150), frame(a.level === 'alert' ? 'Security alert' : 'Heads-up', `
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6C7488;width:90px">What</td><td style="padding:6px 0;font-weight:600">${esc(a.text)}</td></tr>
          <tr><td style="padding:6px 0;color:#6C7488">Who</td><td style="padding:6px 0">${esc(a.user_name || '—')}</td></tr>
          ${a.device ? `<tr><td style="padding:6px 0;color:#6C7488">Device</td><td style="padding:6px 0">${esc(a.device)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6C7488">When</td><td style="padding:6px 0">${esc(dubai(a.at))} (Dubai)</td></tr></table>`));
      await srv('srv_alert_emailed', { p_id: a.id });
      return Response.json({ sent: true });
    }
    if (body.daily) {
      const secret = await srv('srv_cron_secret', {});
      if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('Forbidden', { status: 403 });
      const list = await srv('srv_daily', {}) || [];
      let sent = 0;
      for (const g of list) {
        if (!g.email) continue;
        const alerts = g.alerts || [], changes = g.changes || [];
        const serious = alerts.filter((a: any) => a.level === 'alert').length;
        const byWho: Record<string, any[]> = {};
        for (const c of changes) (byWho[c.who || 'system'] ||= []).push(c);
        const inner = `
          <p style="margin:0 0 6px;font-size:12px;color:#6C7488">${esc(dubai(g.from))} → ${esc(dubai(g.to))} (Dubai)</p>
          <p style="margin:0 0 14px;font-size:14px">${alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}${serious ? ` — <b style="color:#C62828">${serious} serious</b>` : ''}` : 'No alerts.'}
            · ${changes.reduce((n: number, c: any) => n + Number(c.n), 0)} changes by your team.</p>
          ${alerts.length ? `<h3 style="font-size:14px;margin:18px 0 6px">Alerts</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${alerts.map((a: any) => `
            <tr><td style="padding:5px 8px 5px 0;vertical-align:top;white-space:nowrap;color:#6C7488">${esc(dubai(a.at).split(', ')[1] || '')}</td>
                <td style="padding:5px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DOT[a.level] || '#6C7488'};margin-right:6px"></span>${esc(a.text)}</td></tr>`).join('')}</table>` : ''}
          ${changes.length ? `<h3 style="font-size:14px;margin:18px 0 6px">Who changed what</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${Object.entries(byWho).map(([who, cs]) => `
            <tr><td style="padding:6px 8px 6px 0;vertical-align:top;font-weight:600;white-space:nowrap">${esc(who)}</td>
                <td style="padding:6px 0;color:#4B5265">${cs.map((c: any) => `${esc(COLL[c.coll] || c.coll)} ${esc(ACT[c.action] || c.action)} ×${esc(c.n)}`).join(' · ')}</td></tr>`).join('')}</table>` : ''}`;
        await send(g.email, `${serious ? '🔴 ' : ''}mendtech. daily summary — ${new Date(g.to).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })}`,
          frame('Daily summary', inner));
        sent++;
      }
      return Response.json({ sent });
    }
    return new Response('Nothing to do', { status: 400 });
  } catch (e) {
    console.error(e);
    return new Response('Error: ' + (e as Error).message, { status: 500 });
  }
});
