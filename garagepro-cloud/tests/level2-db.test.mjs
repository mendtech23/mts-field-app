// Level 2 database tests against the local Supabase stand-in (gateway :8200, GoTrue, Postgres sb)
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(process.env.PG_MODULES || import.meta.url);
const { Client } = require('pg');
const K = JSON.parse(require('fs').readFileSync(process.env.KEYS || '/tmp/pgt/stack/keys.json', 'utf8'));
const B = process.env.GATEWAY || 'http://localhost:8200';
const db = new Client({ connectionString: '' + (process.env.DB_URL || 'postgres://postgres:pgpw@localhost:5432/sb') + '' });
await db.connect();
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
const run = Date.now().toString(36);

async function http(method, path, { token, body, key = K.anon } = {}) {
  const r = await fetch(B + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + (token || key), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation', 'x-forwarded-for': '10.0.0.9' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, data: j };
}
const rpc = (token, fn, args = {}) => http('POST', '/rest/v1/rpc/' + fn, { token, body: args });
const upsert = (token, rows) => http('POST', '/rest/v1/records?on_conflict=owner,coll,id', { token, body: rows });
const read = (token, q = '') => http('GET', '/rest/v1/records?select=*' + q, { token });
async function login(email, password) { const r = await http('POST', '/auth/v1/token?grant_type=password', { body: { email, password } }); if (!r.data.access_token) throw new Error('login ' + email + ' ' + JSON.stringify(r.data)); return r.data; }
async function adminUser(email, password) { const r = await http('POST', '/auth/v1/admin/users', { key: K.service, body: { email, password, email_confirm: true } }); if (!r.data.id) throw new Error(JSON.stringify(r.data)); return r.data.id; }
function totp(secret) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const ch of secret.replace(/=+$/, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(), o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const now = () => new Date().toISOString();
const rec = (coll, id, data, deleted = false) => ({ coll, id, data: { id, ...data, updatedAt: now() }, deleted, updated_at: now() });
const msg = r => (r.data && r.data.message) || '';

console.log('\n1. Garage login (owner, no member row yet)');
const ownerEmail = `owner-${run}@test.local`;
let r = await http('POST', '/auth/v1/signup', { body: { email: ownerEmail, password: 'Owner#12345' } });
let O = (await login(ownerEmail, 'Owner#12345')).access_token;
const G = JSON.parse(Buffer.from(O.split('.')[1], 'base64url')).sub;
r = await rpc(O, 'whoami'); ok(r.data.role === 'owner' && r.data.is_garage_login && r.data.garage_id === G, 'whoami: garage login = owner', r.data);
r = await rpc(O, 'claim_owner'); r = await rpc(O, 'whoami'); ok(r.data.role === 'owner' && !r.data.is_garage_login && r.data.name === 'Owner', 'claim_owner registers the Owner as a member', r.data);
r = await rpc(O, 'device_hello', { p_label: 'Owner PC', p_ua: 'test' }); ok(r.data && r.data.revoked === false, 'owner device registered', r.data);

const settings = { garageName: 'mendtech.', security: { discountLimit: 10 }, bankDetails: 'IBAN AE00 1111', closedMonths: { '2026-08': true }, counters: { invoice: 5 }, vatRate: 5, phone: '0500000000', quoteValidDays: 7, offers: { healthCheckFee: 49, ppiPrice: 299 } };
const items = [{ type: 'labour', desc: 'Service', qty: 1, rate: 1000, cost: 0 }];
const token = crypto.randomBytes(18).toString('base64url');
r = await upsert(O, [
  rec('settings', 'settings', settings), rec('customers', 'c1', { name: 'Ahmed Khan', phone: '0501234567', email: 'a@x.ae' }), rec('customers', 'c2', { name: 'Sara Ali', phone: '0507654321' }),
  rec('vehicles', 'v1', { plate: 'A 12345', make: 'Toyota', model: 'Camry', customerId: 'c1' }), rec('vehicles', 'v2', { plate: 'B 999', make: 'Nissan', customerId: 'c2' }),
  rec('jobs', 'j1', { number: 'J-1', vehicleId: 'v1', customerId: 'c1', technicianId: 't1', status: 'In Progress', items, discount: 0 }),
  rec('jobs', 'j2', { number: 'J-2', vehicleId: 'v2', customerId: 'c2', technicianId: 't2', status: 'Booked', items }),
  rec('jobs', 'j3', { number: 'J-3', vehicleId: 'v2', customerId: 'c2', line: 'mobile', mobile: { driverId: 'd1', status: 'Assigned' }, status: 'Booked', items }),
  rec('invoices', 'i1', { number: 'INV-1', customerId: 'c1', items, discount: 0 }), rec('invoices', 'i2', { number: 'INV-2', customerId: 'c1', items, discount: 0 }),
  rec('payments', 'p1', { number: 'PAY-1', amount: 1050, invoiceId: 'i1' }), rec('quotes', 'q1', { number: 'Q-1', vehicleId: 'v1', customerId: 'c1', items, discount: 0, status: 'Sent', shareToken: token, validUntil: '2099-01-01' }),
  rec('quotes', 'q2', { number: 'Q-2', items, discount: 0 }), rec('expenses', 'e1', { amount: 50, category: 'Rent' }), rec('incomes', 'o1', { amount: 400, category: 'Scrap sale' }), rec('staff', 's1', { name: 'Ravi', pinHash: 'x' }), rec('secLog', 'x1', { text: 'hi' }),
  rec('technicians', 't1', { name: 'Ravi', trade: 'Mechanic', active: true }), rec('photos', 'ph1', { jobId: 'j1', data: 'img1' }), rec('photos', 'ph2', { jobId: 'j2', data: 'img2' })]);
ok(r.status === 200 && r.data.length === 20 && r.data.every(x => x.owner === G), 'owner uploads 20 records into its own garage', r.data);

console.log('\n2. Staff logins');
const mk = async (u, role, tech) => { const email = `${u}-${run}@g.test.local`; const id = await adminUser(email, 'Staff#12345');
  await db.query('insert into public.members (user_id, garage_id, username, name, role, tech_id, created_by) values ($1,$2,$3,$4,$5,$6,$2)', [id, G, u + run, u, role, tech || null]);
  const t = (await login(email, 'Staff#12345')).access_token; await rpc(t, 'device_hello', { p_label: u + ' phone', p_ua: 'test' }); return { id, t, email }; };
const M = await mk('manager', 'manager'), A = await mk('advisor', 'advisor'), T = await mk('tech', 'technician', 't1'), D = await mk('driver', 'driver', 'd1');
r = await rpc(A.t, 'whoami'); ok(r.data.role === 'advisor' && r.data.garage_id === G, 'advisor belongs to the garage', r.data);

console.log('\n3. Who sees what');
const colls = async t => [...new Set((await read(t)).data.map(x => x.coll))].sort();
let c = await colls(O); ok(c.includes('staff') && c.includes('secLog') && c.includes('expenses'), 'owner sees everything', c);
c = await colls(M.t); ok(!c.includes('staff') && !c.includes('secLog') && c.includes('expenses') && c.includes('invoices'), 'manager: all but staff logins & security log', c);
c = await colls(A.t); ok(!c.includes('staff') && !c.includes('secLog') && !c.includes('expenses') && c.includes('invoices'), 'advisor: no expenses / staff / security log', c);
ok(!c.includes('incomes') && (await colls(M.t)).includes('incomes'), 'other income: manager yes, advisor no');
r = await read(T.t); ok(r.status === 200 && r.data.length === 0, 'technician reads nothing directly', r.data.length);
r = await read(D.t); ok(r.data.length === 0, 'driver reads nothing directly');
r = await read(null); ok(r.data.length === 0, 'anonymous reads nothing');
r = await upsert(A.t, [rec('staff', 's9', { name: 'hack' })]); ok(r.status >= 400, 'advisor cannot write staff logins', r.data);
r = await upsert(A.t, [rec('expenses', 'e9', { amount: 1 })]); ok(r.status >= 400, 'advisor cannot write expenses', r.data);
r = await upsert(T.t, [rec('customers', 'c9', { name: 'x' })]); ok(r.status >= 400, 'technician cannot write records directly', r.data);
r = await http('POST', '/rest/v1/records', { token: A.t, body: [{ coll: 'customers', id: 'c5', data: { name: 'New' }, deleted: false, updated_at: now() }] });
ok(r.status === 200 && r.data[0].owner === G, 'advisor insert without owner lands in the garage (default)', r.data);
r = await http('POST', '/rest/v1/records', { token: A.t, body: [{ owner: A.id, coll: 'customers', id: 'c6', data: {}, deleted: false }] }); ok(r.status >= 400, 'cannot write into another garage', r.data);
r = await http('DELETE', '/rest/v1/records?coll=eq.customers&id=eq.c5', { token: O }); ok(r.status >= 400, 'hard delete blocked even for the owner (soft delete only)', r.data);

console.log('\n4. Protected actions + Owner approval PIN');
const inv = (await read(O, '&coll=eq.invoices&id=eq.i1')).data[0];
r = await upsert(A.t, [{ ...inv, data: { ...inv.data, void: true } }]); ok(r.status >= 400 && /APPROVAL_NEEDED/.test(msg(r)), 'advisor void without approval → blocked', r.data);
r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i1', p_detail: 'Void INV-1', p_pin: '123456' }); ok(r.data.error === 'PIN_NOT_SET', 'no approval PIN yet → clear message', r.data);
r = await rpc(A.t, 'set_owner_pin', { p_pin: '246810' }); ok(r.status >= 400, 'advisor cannot set the Owner PIN', r.data);
r = await rpc(O, 'set_owner_pin', { p_pin: '12ab' }); ok(r.status >= 400, 'PIN must be 6-8 digits', r.data);
r = await rpc(O, 'set_owner_pin', { p_pin: '246810' }); ok(r.status === 200, 'owner sets approval PIN', r.data);
r = await rpc(A.t, 'has_owner_pin'); ok(r.data === true, 'staff can see a PIN exists');
r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i1', p_detail: 'Void INV-1', p_pin: '111111' }); ok(r.data.error === 'PIN_WRONG' && r.data.left === 4, 'wrong PIN → 4 tries left', r.data);
r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i1', p_detail: 'Void INV-1', p_pin: '246810' }); ok(r.data.ok && /^[0-9a-f-]{36}$/.test(r.data.approval_id), 'right PIN → approval issued', r.data);
r = await upsert(A.t, [{ ...inv, data: { ...inv.data, void: true } }]); ok(r.status === 200 && r.data[0].data.void === true, 'void now goes through', r.data);
const inv2 = (await read(O, '&coll=eq.invoices&id=eq.i2')).data[0];
r = await upsert(A.t, [{ ...inv2, data: { ...inv2.data, void: true } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'approval is for that invoice only (i2 still blocked)', r.data);
r = await upsert(M.t, [{ ...inv2, deleted: true }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'manager delete invoice → needs approval', r.data);
r = await upsert(M.t, [{ ...inv2, data: { ...inv2.data, payLink: 'https://evil.example/pay' } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'changing a payment link → needs approval', r.data);
const pay = (await read(O, '&coll=eq.payments')).data[0];
r = await upsert(A.t, [{ ...pay, deleted: true }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'delete payment → needs approval', r.data);
const q2 = (await read(O, '&coll=eq.quotes&id=eq.q2')).data[0];
r = await upsert(A.t, [{ ...q2, data: { ...q2.data, discount: 8 } }]); ok(r.status === 200, 'advisor 8 % discount (under limit) → fine', r.data);
r = await upsert(A.t, [{ ...q2, data: { ...q2.data, discount: 15 } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'advisor 15 % discount → needs approval', r.data);
r = await upsert(A.t, [{ ...q2, data: { ...q2.data, discount: 200, discountType: 'amt' } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'advisor AED 200 off 1000 (20 %) → needs approval', r.data);
r = await upsert(M.t, [{ ...q2, data: { ...q2.data, discount: 15 } }]); ok(r.status === 200, 'manager 15 % discount → allowed (no limit)', r.data);
r = await upsert(A.t, [rec('quotes', 'q3', { number: 'Q-3', items, discount: 30 })]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'new quote with 30 % → needs approval', r.data);
const q2m = (await read(O, '&coll=eq.quotes&id=eq.q2')).data[0].data;
r = await upsert(A.t, [rec('jobs', 'j9', { number: 'J-9', quoteId: 'q2', items, discount: 15 })]); ok(r.status === 200, 'job made from the approved 15 % quote keeps its discount', r.data);
r = await upsert(A.t, [rec('invoices', 'i9', { number: 'INV-9', jobId: 'j9', items, discount: 15 })]); ok(r.status === 200, '… and so does its invoice', r.data);
r = await upsert(A.t, [rec('invoices', 'i10', { number: 'INV-10', jobId: 'j9', items, discount: 25 })]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'but a bigger discount still needs approval', r.data);
const st = (await read(O, '&coll=eq.settings')).data[0];
r = await upsert(A.t, [{ ...st, data: { ...st.data, phone: '0509999999' } }]); ok(r.status >= 400 && /Advisors cannot/.test(msg(r)), 'advisor cannot change settings', r.data);
r = await upsert(A.t, [{ ...st, data: { ...st.data, counters: { invoice: 6 }, updatedAt: now() } }]); ok(r.status === 200, 'advisor can bump document counters', r.data);
const st2 = (await read(O, '&coll=eq.settings')).data[0];
r = await upsert(M.t, [{ ...st2, data: { ...st2.data, phone: '0501111111' } }]); ok(r.status === 200, 'manager can change normal settings', r.data);
const st3 = (await read(O, '&coll=eq.settings')).data[0];
r = await upsert(M.t, [{ ...st3, data: { ...st3.data, bankDetails: 'IBAN AE66 EVIL' } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'manager bank details → needs approval', r.data);
r = await upsert(M.t, [{ ...st3, data: { ...st3.data, closedMonths: {} } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'reopen closed month → needs approval', r.data);
r = await upsert(M.t, [{ ...st3, data: { ...st3.data, security: { discountLimit: 90 } } }]); ok(/APPROVAL_NEEDED/.test(msg(r)), 'raise discount limit → needs approval', r.data);
r = await upsert(O, [{ ...st3, data: { ...st3.data, bankDetails: 'IBAN AE77 NEW' } }]); ok(r.status === 200, 'owner changes bank details directly', r.data);
r = await rpc(M.t, 'approve_with_pin', { p_action: 'bank_details', p_target: 'settings', p_detail: 'x', p_pin: '246810' });
const st4 = (await read(O, '&coll=eq.settings')).data[0];
r = await upsert(A.t, [{ ...st4, data: { ...st4.data, bankDetails: 'IBAN AE66 EVIL' } }]); ok(r.status >= 400, "manager's approval can't be used by the advisor", r.data);

console.log('\n5. PIN lockout');
for (let i = 0; i < 4; i++) r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i2', p_detail: 'Void INV-2', p_pin: '000000' });
r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i2', p_detail: 'Void INV-2', p_pin: '000000' }); ok(r.data.error === 'PIN_LOCKED' && r.data.minutes === 15, '5th wrong PIN → locked 15 min', r.data);
r = await rpc(A.t, 'approve_with_pin', { p_action: 'void_invoice', p_target: 'i2', p_detail: 'Void INV-2', p_pin: '246810' }); ok(r.data.error === 'PIN_LOCKED', 'even the right PIN is refused while locked', r.data);
let al = (await db.query("select level, kind, text from public.alerts where garage_id=$1 order by id", [G])).rows;
ok(al.some(a => a.kind === 'lockout' && a.level === 'alert'), 'lockout raised an ALERT', al.map(a => a.kind));
ok(al.some(a => a.kind === 'pin-fail'), '3 wrong PINs raised a warning');
await db.query('delete from app.pin_fails where garage_id=$1', [G]);

console.log('\n6. Technician & driver: own jobs only, trimmed');
r = await rpc(T.t, 'crew_pull'); const cp = r.data;
ok(cp.jobs.length === 1 && cp.jobs[0].id === 'j1', 'technician gets only their job', cp.jobs && cp.jobs.map(j => j.id));
ok(cp.jobs[0] && !('items' in cp.jobs[0]) && !('discount' in cp.jobs[0]), 'no prices / items in the job', cp.jobs[0]);
ok(cp.customers.length === 1 && cp.customers[0].name === 'Ahmed Khan' && !cp.customers[0].phone, 'customer: name only', cp.customers);
ok(cp.vehicles.length === 1 && cp.vehicles[0].plate === 'A 12345', 'their vehicle only');
ok(cp.photos.length === 1 && cp.photos[0].id === 'ph1' && !cp.photos[0].data, 'photo list for own job (no image data)', cp.photos);
ok(!('bankDetails' in cp.settings) && !('security' in cp.settings) && cp.settings.garageName, 'settings trimmed', Object.keys(cp.settings));
r = await rpc(T.t, 'crew_photo', { p_id: 'ph1' }); ok(r.data && r.data.data === 'img1', 'can open own job photo');
r = await rpc(T.t, 'crew_photo', { p_id: 'ph2' }); ok(r.data === null, "cannot open another job's photo", r.data);
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'jobs', id: 'j1', data: { status: 'Ready', diagnosis: 'Worn pads', items: [{ desc: 'free', rate: 0 }], discount: 100, customerId: 'c2' } }, { coll: 'jobs', id: 'j2', data: { status: 'Ready' } }, { coll: 'invoices', id: 'i1', data: {} }, { coll: 'jobs', id: 'j1x', data: {} }] });
ok(r.data.ok === 1 && r.data.rejected.length === 3, 'push: 1 accepted, 3 rejected', r.data);
let j1 = (await read(O, '&coll=eq.jobs&id=eq.j1')).data[0].data;
ok(j1.status === 'Ready' && j1.diagnosis === 'Worn pads' && j1.items[0].rate === 1000 && j1.discount === 0 && j1.customerId === 'c1', 'only allowed fields changed (prices untouched)', j1);
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'jobs', id: 'j1', data: { inspectionType: 'health20', items: [{ type: 'labour', desc: 'x', qty: 1, rate: 0, hc: true }, { desc: 'free stuff', rate: 1 }] } }] });
j1 = (await read(O, '&coll=eq.jobs&id=eq.j1')).data[0].data;
ok(j1.items.length === 2 && j1.items[1].hc && j1.items[1].rate === 49 && j1.inspectionType === 'health20', 'health check line added at the garage price (not the phone\'s)', j1.items);
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'jobs', id: 'j1', data: { items: [{ hc: true, rate: 0 }] } }] });
ok((await read(O, '&coll=eq.jobs&id=eq.j1')).data[0].data.items.length === 2, 'added only once');
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'jobs', id: 'j1', data: { status: 'Delivered' } }] }); ok(r.data.rejected.length === 1, 'technician cannot mark Delivered', r.data);
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'photos', id: 'ph3', data: { id: 'ph3', jobId: 'j1', data: 'img3' } }, { coll: 'photos', id: 'ph4', data: { id: 'ph4', jobId: 'j2', data: 'x' } }] });
ok(r.data.ok === 1 && r.data.rejected.length === 1, 'photo only on own job', r.data);
r = await rpc(T.t, 'crew_push', { p_rows: [{ coll: 'photos', id: 'ph1', data: { id: 'ph1', jobId: 'j1', data: 'overwrite' } }] });
ok((await read(O, '&coll=eq.photos&id=eq.ph1')).data[0].data.data === 'img1', 'existing photos cannot be overwritten');
r = await rpc(D.t, 'crew_pull'); ok(r.data.jobs.length === 1 && r.data.jobs[0].id === 'j3' && r.data.customers[0].phone === '0507654321', 'driver: own mobile job + customer phone', r.data.jobs && r.data.customers);
r = await rpc(D.t, 'crew_push', { p_rows: [{ coll: 'jobs', id: 'j3', data: { mobile: { status: 'On the way', driverId: 'd9', fee: 0 }, status: 'In Progress' } }] });
const j3 = (await read(O, '&coll=eq.jobs&id=eq.j3')).data[0].data; ok(j3.mobile.status === 'On the way' && j3.mobile.driverId === 'd1', 'driver updates trip status, cannot reassign', j3.mobile);
r = await rpc(A.t, 'crew_pull'); ok(r.status >= 400, 'crew_pull is only for technicians / drivers');

console.log('\n7. Audit log');
r = await http('GET', '/rest/v1/audit_log?select=*&order=id.asc', { token: O }); const audit = r.data;
ok(Array.isArray(audit) && audit.length > 20, 'owner reads the audit log', audit.length);
ok(audit.some(a => a.coll === 'invoices' && /void/.test(a.summary) && /advisor/.test(a.who)), 'void recorded with who', audit.filter(a => a.coll === 'invoices'));
ok(audit.some(a => a.coll === 'jobs' && /tech \(technician\)/.test(a.who) && /status/.test(a.summary)), 'technician change recorded');
ok(audit.every(a => a.garage_id === G), 'only own garage');
r = await http('GET', '/rest/v1/audit_log?select=*', { token: M.t }); ok(r.data.length === 0, 'manager cannot read the audit log');
r = await http('PATCH', '/rest/v1/audit_log?id=eq.' + audit[0].id, { token: O, body: { who: 'nobody' } }); ok(r.status >= 400, 'owner cannot edit the audit log', r.data);
r = await http('DELETE', '/rest/v1/audit_log?id=eq.' + audit[0].id, { token: O }); ok(r.status >= 400, 'owner cannot delete the audit log');
r = await http('DELETE', '/rest/v1/audit_log?id=eq.' + audit[0].id, { key: K.service }); ok(r.status >= 400, 'service key cannot delete it either', r.data);
try { await db.query('delete from public.audit_log where id=$1', [audit[0].id]); ok(false, 'db admin delete'); } catch (e) { ok(/cannot be changed/.test(e.message), 'even the database admin is stopped by the trigger'); }
const n0 = audit.length; const cu = (await read(O, '&coll=eq.customers&id=eq.c1')).data[0];
await upsert(O, [{ ...cu, data: { ...cu.data, updatedAt: now() } }]);
ok((await http('GET', '/rest/v1/audit_log?select=id', { token: O })).data.length === n0, 'timestamp-only re-sync does not spam the log');

console.log('\n8. Alerts, e-mail hook');
r = await rpc(O, 'set_alert_config', { p_email: 'mendtech23@gmail.com', p_functions_url: 'http://localhost:8200/functions/v1', p_anon_key: K.anon }); ok(r.status === 200, 'owner sets alert e-mail', r.data);
r = await rpc(A.t, 'set_alert_config', { p_email: 'evil@x.com', p_functions_url: null, p_anon_key: null }); ok(r.status >= 400, 'advisor cannot change the alert e-mail');
r = await rpc(A.t, 'get_alert_email'); ok(r.data === null, 'advisor cannot see the alert e-mail');
const calls0 = (await db.query('select count(*)::int n from net.calls')).rows[0].n;
const p2 = (await read(O, '&coll=eq.payments')).data[0]; await upsert(O, [{ ...p2, deleted: true }]);
const calls1 = (await db.query('select body from net.calls order by id desc limit 1')).rows;
ok((await db.query('select count(*)::int n from net.calls')).rows[0].n === calls0 + 1 && calls1[0].body.alert_id, 'deleted payment → instant e-mail request queued', calls1);
r = await http('GET', '/rest/v1/alerts?select=*&order=id.desc', { token: O }); ok(r.data.length > 5 && r.data.some(a => a.kind === 'payment'), 'owner sees alerts in the app', r.data.length);
r = await http('GET', '/rest/v1/alerts?select=*', { token: M.t }); ok(r.data.length === 0, 'manager does not see security alerts');
r = await http('PATCH', '/rest/v1/alerts?id=eq.' + calls1[0].body.alert_id, { token: O, body: { text: 'edited' } }); ok(r.status >= 400, 'alert text cannot be edited');
r = await http('PATCH', '/rest/v1/alerts?id=eq.' + calls1[0].body.alert_id, { token: O, body: { seen: true } }); ok(r.status === 200 && r.data[0].seen, 'owner can mark seen');
r = await rpc(O, 'srv_alert_get', { p_id: calls1[0].body.alert_id }); ok(r.status >= 400, 'server helpers are blocked for app users');
r = await rpc(K.anon, 'srv_daily', {}); ok(r.status >= 400, '… and for anonymous');
r = await http('POST', '/rest/v1/rpc/srv_alert_get', { key: K.service, body: { p_id: calls1[0].body.alert_id } }); ok(r.data && r.data.email === 'mendtech23@gmail.com' && /Payment PAY-1/.test(r.data.text), 'service role reads alert + e-mail', r.data);
r = await http('POST', '/rest/v1/rpc/srv_daily', { key: K.service, body: {} }); const mine = (r.data || []).find(x => x.garage_id === G);
ok(mine && mine.alerts.length > 3 && mine.changes.length > 3, 'daily summary built', mine && { a: mine.alerts.length, c: mine.changes.length });
r = await http('POST', '/rest/v1/rpc/srv_daily', { key: K.service, body: {} }); ok(!(r.data || []).find(x => x.garage_id === G), 'daily summary only once per day');

console.log('\n9. Customer quote link');
r = await rpc(K.anon, 'public_quote', { p_token: token }); const pq = r.data;
ok(pq && pq.number === 'Q-1' && pq.customer === 'Ahmed' && pq.vehicle.plate === 'A 12345' && pq.items.length === 1, 'link shows the quotation', pq);
ok(pq && !JSON.stringify(pq).includes('0501234567') && !JSON.stringify(pq).includes('IBAN') && !('cost' in pq.items[0]), 'no phone, bank or cost prices exposed');
r = await rpc(K.anon, 'public_quote', { p_token: 'x'.repeat(24) }); ok(r.data === null, 'wrong token → nothing');
r = await rpc(K.anon, 'public_quote_decide', { p_token: token, p_decision: 'approve', p_name: '', p_note: '' }); ok(r.status >= 400, 'name required');
r = await rpc(K.anon, 'public_quote_decide', { p_token: token, p_decision: 'approve', p_name: 'Ahmed Khan', p_note: 'Go ahead' }); ok(r.data && r.data.status === 'Approved', 'customer approves', r.data);
r = await rpc(K.anon, 'public_quote_decide', { p_token: token, p_decision: 'decline', p_name: 'Ahmed', p_note: '' }); ok(r.data && r.data.already && r.data.status === 'Approved', 'second click does not change it');
const q1 = (await read(O, '&coll=eq.quotes&id=eq.q1')).data[0].data; ok(q1.status === 'Approved' && q1.approval.name === 'Ahmed Khan' && q1.approval.ip === '10.0.0.9', 'quote saved with name, time, IP', q1.approval);
ok((await db.query("select who from public.audit_log where garage_id=$1 and rec_id='q1' order by id desc limit 1", [G])).rows[0].who === 'Customer (quote link)', 'audit shows "Customer (quote link)"');
r = await http('POST', '/rest/v1/rpc/public_quote_decide', { body: { p_token: token.slice(0, 10), p_decision: 'approve', p_name: 'X Y', p_note: '' } }); ok(r.status >= 400, 'short token refused');

console.log('\n10. Devices: remote sign-out');
r = await http('GET', '/rest/v1/devices?select=*', { token: O }); const devs = r.data; ok(devs.length === 5, 'owner sees all 5 devices', devs.length);
r = await http('GET', '/rest/v1/devices?select=*', { token: A.t }); ok(r.data.length === 1, 'advisor sees only own device');
const tdev = devs.find(d => d.user_id === T.id);
r = await rpc(A.t, 'revoke_device', { p_id: tdev.id }); ok(r.status >= 400, 'advisor cannot sign devices out');
r = await rpc(O, 'revoke_device', { p_id: tdev.id }); ok(r.status === 200, 'owner signs the technician phone out', r.data);
r = await rpc(T.t, 'crew_pull'); ok(r.status >= 400, 'that phone is cut off immediately', r.data);
r = await rpc(T.t, 'device_hello', { p_label: 'tech phone', p_ua: 'x' }); ok(r.data.revoked === true, 'app is told it was signed out', r.data);
const Tl = await login(T.email, 'Staff#12345'); r = await rpc(Tl.access_token, 'crew_pull'); ok(r.status === 200, 'signing in again (new session) works — deactivate the login to block for good');
r = await http('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: 'x' } });

console.log('\n11. Deactivated login');
await db.query('update public.members set active=false where user_id=$1', [A.id]);
r = await read(A.t); ok(r.data.length === 0, 'deactivated advisor sees nothing');
r = await rpc(A.t, 'whoami'); ok(r.data.garage_id === null && r.data.role === null, 'whoami: no garage, no role', r.data);
r = await http('POST', '/rest/v1/records', { token: A.t, body: [{ coll: 'customers', id: 'c7', data: {}, deleted: false }] }); ok(r.status >= 400, 'deactivated advisor cannot write');
await db.query('update public.members set active=true where user_id=$1', [A.id]);

console.log('\n12. Owner authenticator app (MFA)');
r = await http('POST', '/auth/v1/factors', { token: O, body: { factor_type: 'totp', friendly_name: 'Owner phone' } }); const fac = r.data; ok(fac.id && fac.totp && fac.totp.secret, 'owner starts authenticator setup', r.data);
r = await rpc(O, 'whoami'); ok(r.data.mfa_ok === true, 'unverified factor does not lock anything yet');
let ch = (await http('POST', `/auth/v1/factors/${fac.id}/challenge`, { token: O })).data;
r = await http('POST', `/auth/v1/factors/${fac.id}/verify`, { token: O, body: { challenge_id: ch.id, code: totp(fac.totp.secret) } }); const O2 = r.data.access_token; ok(!!O2, 'code accepted', r.data);
r = await read(O); ok(r.data.length === 0, 'old password-only session now sees nothing');
r = await rpc(O, 'set_owner_pin', { p_pin: '135790' }); ok(r.status >= 400, 'password-only session cannot change the PIN');
const O3 = (await login(ownerEmail, 'Owner#12345')).access_token; r = await read(O3); ok(r.data.length === 0, 'password alone is not enough any more');
r = await rpc(O3, 'whoami'); ok(r.data.mfa_enrolled && !r.data.mfa_ok && r.data.aal === 'aal1', 'whoami says: code needed', r.data);
ch = (await http('POST', `/auth/v1/factors/${fac.id}/challenge`, { token: O3 })).data;
await new Promise(res => setTimeout(res, 100));
r = await http('POST', `/auth/v1/factors/${fac.id}/verify`, { token: O3, body: { challenge_id: ch.id, code: '000000' } }); ok(!r.data.access_token, 'wrong code refused');
r = await read(O2); ok(r.data.length > 15, 'with password + code: full access', r.data.length);
r = await read(M.t); ok(r.data.length > 10, 'staff are not affected by the owner MFA');

console.log(`\n${pass} passed, ${fail} failed`);
await db.end(); process.exit(fail ? 1 : 0);
