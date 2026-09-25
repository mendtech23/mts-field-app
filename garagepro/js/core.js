/* GaragePro — core: storage, data model, calculations */
'use strict';

const APP_VERSION = '3.3.0';
const CFG = Object.assign({ mode: 'live', dbName: 'garagepro', supabaseUrl: '', supabaseKey: '', garageId: '' }, window.GP_CONFIG || {});
const IS_PREVIEW = CFG.mode === 'preview';
const COLLECTIONS = ['customers', 'vehicles', 'quotes', 'jobs', 'invoices', 'payments', 'parts',
  'purchaseOrders', 'suppliers', 'labour', 'technicians', 'expenses', 'messages', 'stockAdjustments',
  'bookings', 'packages', 'staff', 'requests', 'secLog', 'campaigns', 'partners', 'renewals'];

/* ---------- IndexedDB wrapper ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CFG.dbName, 6);   // v5: secLog · v6: campaigns, partners, renewals
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const c of [...COLLECTIONS, 'meta']) if (!d.objectStoreNames.contains(c)) d.createObjectStore(c, { keyPath: 'id' });
        if (!d.objectStoreNames.contains('photos')) {
          const ps = d.createObjectStore('photos', { keyPath: 'id' });   // photos kept separate so the app stays fast
          ps.createIndex('jobId', 'jobId'); ps.createIndex('vehicleId', 'vehicleId');
        }
      };
      req.onsuccess = () => {
        DB.db = req.result;
        DB.db.onversionchange = () => { DB.db.close(); location.reload(); };   // a newer GaragePro opened in another tab
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => { const v = document.getElementById('view'); if (v) v.innerHTML = '<div class="card card-pad" style="margin:20px">GaragePro is being updated. <b>Close every other GaragePro tab or window</b> on this computer — this page continues by itself.</div>'; };
    });
  },
  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = DB.db.transaction(store, mode);
      const r = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  all(store) { return DB._tx(store, 'readonly', s => s.getAll()); },
  put(store, obj) { return DB._tx(store, 'readwrite', s => s.put(obj)); },
  del(store, id) { return DB._tx(store, 'readwrite', s => s.delete(id)); },
  clear(store) { return DB._tx(store, 'readwrite', s => s.clear()); },
  putMany(store, arr) { return DB._tx(store, 'readwrite', s => { arr.forEach(o => s.put(o)); }); },
  byIndex(store, index, key) { return DB._tx(store, 'readonly', s => s.index(index).getAll(key)); },
  count(store) { return DB._tx(store, 'readonly', s => s.count()); },
};

/* Closed accounting periods (month-end closing) */
function isClosedPeriod(iso) { return !!(iso && S.settings.closedMonths && S.settings.closedMonths[monthKey(iso)]); }

/* ---------- Defaults ---------- */
const DEFAULT_SETTINGS = {
  id: 'settings',
  garageName: 'MendTech Auto',
  brandMobile: 'MendTech Mobile',
  legalName: '',
  mob: {
    hoursStart: '08:00', hoursEnd: '20:00', allDay: false, weekendDays: [],
    zones: [
      { name: 'Dubai — Central (Downtown, Business Bay, DIFC, Jumeirah)', emirate: 'Dubai', fee: '' },
      { name: 'Dubai — New Dubai (Marina, JLT, JVC, Al Barsha)', emirate: 'Dubai', fee: '' },
      { name: 'Dubai — Deira, Qusais, Mirdif', emirate: 'Dubai', fee: '' },
      { name: 'Dubai — South (DIP, Dubai South, Silicon Oasis)', emirate: 'Dubai', fee: '' },
      { name: 'Sharjah — City (Al Nahda, Al Majaz, Al Taawun)', emirate: 'Sharjah', fee: '' },
      { name: 'Sharjah — Industrial & Muwaileh', emirate: 'Sharjah', fee: '' },
    ],
    urgentFee: '', afterHoursFee: '', weekendFee: '', freeCalloutAbove: '',
    vans: [{ id: 'van1', name: 'Van 1', plate: '' }],
    services: ['Battery test / replacement', 'Jump start', 'Flat tyre / puncture', 'Minor service at your location', 'AC gas top-up', 'Bulbs, wipers & fuses', 'Brake pads', 'Diagnostics (warning light)', 'Car won\'t start', 'Other / not sure'],
    workshopServices: ['Periodic service', 'Brakes', 'AC repair', 'Electrical', 'Suspension & steering', 'Diagnostics', 'Tyres & alignment', 'Bodywork & paint', 'Other / not sure'],
    alertSound: true,
  },
  payStripeLink: '',
  wioName: '',
  wioIban: '',
  wioBank: 'Wio Bank',
  wioLink: '',
  tagline: 'Auto Repair & Service Centre',
  address: 'Industrial Area 2, Sharjah, UAE',
  phone: '+971 55 957 4148',        // calls
  whatsapp: '+971 52 233 8499',     // all WhatsApp enquiries and app messages
  mobile: '',
  email: 'mendtech23@gmail.com',
  website: '',
  trn: '',
  logo: '',
  currency: 'AED',
  vatRate: 5,
  labourRate: 120,
  countryCode: '971',
  quoteValidDays: 7,
  invoiceDueDays: 0,
  bankDetails: 'Bank: \nAccount Name: \nIBAN: ',
  quoteTerms: 'Prices in AED. Quote valid for {validDays} days.\nWork starts only after customer approval.\nAny extra work found during repair will be quoted separately before we proceed.\nParts warranty as per manufacturer; labour warranty 30 days.',
  invoiceTerms: 'Labour warranty 30 days from invoice date. Keep this invoice for warranty claims.',
  docFooter: 'Workshop & Mobile 08:00–20:00 · 24/7 emergency (extra charge) · Sharjah',   // bottom-right line on every document
  prefixes: { quote: 'QT-', job: 'JC-', mjob: 'MJ-', invoice: 'INV-', receipt: 'RC-', po: 'PO-', customer: 'C-', vehicle: 'V-', part: 'P-', supplier: 'S-', labour: 'L-', tech: 'T-' },
  counters: { quote: 0, job: 0, mjob: 0, invoice: 0, receipt: 0, po: 0, customer: 0, vehicle: 0, part: 0, supplier: 0, labour: 0, tech: 0 },
  lists: {
    jobType: ['Periodic Service', 'Mobile service', 'Mechanical Repair', 'Electrical Repair', 'AC Service', 'Bodywork & Paint', 'Tyres & Alignment', 'Diagnostics', 'Full Inspection', 'Pre-Purchase Inspection', 'Warranty / Comeback', 'Other'],
    fuel: ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'CNG'],
    transmission: ['Automatic', 'Manual', 'CVT', 'DCT'],
    drive: ['FWD', 'RWD', 'AWD', '4WD'],
    emirate: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Other'],
    customerType: ['Individual', 'Company', 'Fleet', 'Walk-in', 'Insurance'],
    paymentMethod: ['Cash', 'Card – Stripe', 'Bank transfer – WIO', 'Card (machine)', 'Cheque', 'Credit'],
    partCategory: ['Filters', 'Fluids & Lubricants', 'Brakes', 'Tyres & Wheels', 'Battery & Electrical', 'Suspension & Steering', 'Engine', 'Cooling', 'AC', 'Transmission', 'Body & Glass', 'Consumables', 'Other'],
    expenseCategory: ['Rent', 'Salaries & Wages', 'Utilities', 'Tools & Equipment', 'Workshop Consumables', 'Marketing', 'Licences & Fees', 'Insurance', 'Fuel', 'Salik / tolls', 'Parking', 'Van maintenance', 'Maintenance', 'Bank & card charges', 'Other'],
    trade: ['General Mechanic', 'Auto Electrician', 'AC Technician', 'Denter / Painter', 'Tyre & Alignment', 'Mobile Technician', 'Driver', 'Service Advisor', 'Helper'],
  },
  serviceItems: [
    { name: 'Engine Oil & Filter', km: 10000, months: 6 },
    { name: 'Air Filter', km: 20000, months: 12 },
    { name: 'Cabin / AC Filter', km: 15000, months: 12 },
    { name: 'Fuel Filter', km: 40000, months: 24 },
    { name: 'Spark Plugs', km: 40000, months: 36 },
    { name: 'Brake Pads - Front', km: 30000, months: 24 },
    { name: 'Brake Pads - Rear', km: 50000, months: 36 },
    { name: 'Brake Fluid', km: 40000, months: 24 },
    { name: 'Coolant', km: 40000, months: 24 },
    { name: 'Transmission Fluid', km: 60000, months: 48 },
    { name: 'Battery', km: 0, months: 30 },
    { name: 'Tyres', km: 50000, months: 48 },
    { name: 'Wheel Alignment', km: 10000, months: 12 },
    { name: 'AC Service & Gas', km: 0, months: 12 },
    { name: 'Timing Belt', km: 100000, months: 72 },
  ],
  inspectionTemplate: [
    ['Engine', 'Engine oil level & condition'], ['Engine', 'Coolant level & condition'], ['Engine', 'Drive belts'], ['Engine', 'Hoses & clamps'], ['Engine', 'Oil / fluid leaks'], ['Engine', 'Engine mounts'], ['Engine', 'Air filter'],
    ['Brakes', 'Front brake pads'], ['Brakes', 'Rear brake pads / shoes'], ['Brakes', 'Brake discs / drums'], ['Brakes', 'Brake fluid level'], ['Brakes', 'Handbrake operation'],
    ['Tyres & Wheels', 'Front tyres tread & condition'], ['Tyres & Wheels', 'Rear tyres tread & condition'], ['Tyres & Wheels', 'Tyre pressures'], ['Tyres & Wheels', 'Spare tyre & tools'], ['Tyres & Wheels', 'Wheel alignment (visual / drive)'],
    ['Suspension & Steering', 'Front shock absorbers'], ['Suspension & Steering', 'Rear shock absorbers'], ['Suspension & Steering', 'Ball joints & bushes'], ['Suspension & Steering', 'Steering rack & tie rods'], ['Suspension & Steering', 'CV boots & axles'],
    ['Electrical', 'Battery health test'], ['Electrical', 'Charging system'], ['Electrical', 'Headlights & indicators'], ['Electrical', 'Brake & reverse lights'], ['Electrical', 'Horn & wipers'], ['Electrical', 'Warning lights on dash'],
    ['AC & Cooling', 'AC outlet temperature'], ['AC & Cooling', 'Cabin filter'], ['AC & Cooling', 'Radiator & fan'],
    ['Transmission', 'Gearbox operation'], ['Transmission', 'Transmission fluid'], ['Transmission', 'Differential / transfer case'],
    ['Body & Interior', 'Windscreen & glass'], ['Body & Interior', 'Body damage / scratches'], ['Body & Interior', 'Seat belts'], ['Body & Interior', 'Exhaust system'],
  ],
  templates: {
    quote: 'Dear {customer},\n\nPlease find your quotation {number} for {vehicle} ({plate}).\nTotal: {amount} (incl. VAT)\nValid until: {validUntil}\n\n{items}\n\nReply YES to approve and we will start the work.\n\n{garage}\n{garagePhone}',
    invoice: 'Dear {customer},\n\nYour invoice {number} for {vehicle} ({plate}) is ready.\nTotal: {amount}\nPaid: {paid}\nBalance due: {balance}\n\n{payInfo}\n\nThank you for choosing {garage}.\n{garagePhone}',
    receipt: 'Dear {customer},\n\nWe have received your payment of {amount} ({method}) against invoice {number}. Receipt no. {receipt}.\nRemaining balance: {balance}\n\nThank you!\n{garage}',
    ready: 'Dear {customer},\n\nGood news! Your {vehicle} ({plate}) is ready for collection.\nAmount due: {balance}\n\nOpening hours: 8am - 7pm.\n{garage}\n{garagePhone}',
    jobUpdate: 'Dear {customer},\n\nUpdate on your {vehicle} ({plate}), job {number}: status is now "{status}".\n\n{garage}\n{garagePhone}',
    serviceDue: 'Dear {customer},\n\nYour {vehicle} ({plate}) is due for: {item}.\nLast recorded odometer: {odometer} km.\n\nReply to book a slot that suits you.\n{garage}\n{garagePhone}',
    regExpiry: 'Dear {customer},\n\nReminder: the registration of your {vehicle} ({plate}) expires on {date}. We can do the pre-registration test and service for you.\n\n{garage}\n{garagePhone}',
    insExpiry: 'Dear {customer},\n\nReminder: the insurance of your {vehicle} ({plate}) expires on {date}.\n\n{garage}\n{garagePhone}',
    payment: 'Dear {customer},\n\nA friendly reminder that invoice {number} for {vehicle} ({plate}) has an outstanding balance of {balance}.\n\n{payInfo}\n\nThank you.\n{garage}\n{garagePhone}',
    inspection: 'Dear {customer},\n\nInspection results for your {vehicle} ({plate}):\n\n{items}\n\nWe will send a quotation for the recommended work.\n{garage}\n{garagePhone}',
    thanks: 'Dear {customer},\n\nThank you for visiting {garage}. We hope you are happy with the work on your {vehicle}. We would love your feedback!\n\n{garagePhone}',
    booking: 'Dear {customer},\n\nYour appointment at {garage} is confirmed:\n📅 {date} at {time}\n🚗 {vehicle} {plate}\n🔧 {item}\n\nLocation: {address}\nSee you then!\n{garagePhone}',
    bookingReminder: 'Dear {customer},\n\nReminder: your appointment at {garage} is tomorrow, {date} at {time}, for your {vehicle} {plate}.\n\nReply if you need to change the time.\n{garagePhone}',
    mobileReceived: 'Dear {customer},\n\nThank you for contacting {brand}. We have received your request ({number}) for your {vehicle} {plate}: {item}.\n\nLocation: {location}\nWhen: {when}\n\nWe will confirm the technician and arrival time shortly.\n{garagePhone}',
    mobileOnWay: 'Dear {customer},\n\nOur {brand} technician {tech} is on the way to you now.\nEstimated arrival: {eta}\nLocation: {location}\n\nIf anything changes, just reply to this message.\n{garagePhone}',
    mobileArrived: 'Dear {customer},\n\nOur {brand} technician {tech} has arrived at your location. See you shortly!\n{garagePhone}',
    mobileCompleted: 'Dear {customer},\n\nThe work on your {vehicle} {plate} is complete ({number}).\nTotal: {amount}\n\n{payInfo}\n\nThank you for choosing {brand}!\n{garagePhone}',
    needsWorkshop: 'Dear {customer},\n\nOur technician has checked your {vehicle} {plate}. This repair needs our workshop equipment, so we have booked it in at {garage}: {date} {time}.\n\nAddress: {address}\nWe can arrange recovery if needed — just reply.\n{garagePhone}',
    followUp: 'Dear {customer},\n\nWhen we checked your {vehicle} ({plate}) on {date}, we recommended:\n{item}\n\nWould you like us to book this in? We can also come to you.\n{garagePhone}',
    review: 'Dear {customer},\n\nThank you for choosing {garage}! If you are happy with the work on your {vehicle}, a quick Google review would help us a lot:\n{reviewLink}\n\nThank you!\n{garagePhone}',
    requestDeclined: 'Dear {customer},\n\nThank you for your request to {brand}. Unfortunately we cannot take this job at the requested time. Please reply with another time that suits you, or call us on {garagePhone}.\n\nSorry for the inconvenience.',
  },
  lastBackup: null,
  closedMonths: {},
  autoLockMinutes: 0,
  security: { discountLimit: 10 },   // % discount staff may give without the Owner PIN
  secSeenAt: '',                     // security alerts read up to this time
  lastBackupEncrypted: false,
  /* v3.3 services & offers — prices are placeholders until the Owner confirms them */
  offers: { healthCheckFee: 49, ppiPrice: 299, renewalFee: 150, googleReviewLink: '', reviewAfterDays: 1, followUpDays: [7, 30, 90], reviewEveryMonths: 6 },
};

const JOB_STATUSES = ['Booked', 'In Progress', 'Awaiting Parts', 'Awaiting Approval', 'Ready', 'Delivered', 'Cancelled'];
const OPEN_JOB = ['Booked', 'In Progress', 'Awaiting Parts', 'Awaiting Approval'];
const DONE_JOB = ['Ready', 'Delivered'];
const QUOTE_STATUSES = ['Draft', 'Sent', 'Approved', 'Declined', 'Converted', 'Expired'];
const PO_STATUSES = ['Ordered', 'Received', 'Cancelled'];

/* ---------- In-memory state ---------- */
const S = { settings: null };
COLLECTIONS.forEach(c => S[c] = []);

async function loadAll() {
  await DB.open();
  for (const c of COLLECTIONS) S[c] = await DB.all(c);
  const meta = await DB.all('meta');
  const saved = meta.find(m => m.id === 'settings');
  S.settings = mergeDeep(structuredClone(DEFAULT_SETTINGS), saved || {});
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}

function mergeDeep(base, over) {
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], v);
    else base[k] = v;
  }
  return base;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const syncDirty = () => { if (typeof Sync !== 'undefined') Sync.markDirty(); };
const currentUserName = () => (typeof Auth !== 'undefined' && Auth.user) ? Auth.user.name : '';

async function saveSettings() { S.settings.updatedAt = new Date().toISOString(); await DB.put('meta', S.settings); syncDirty(); }

async function save(coll, obj) {
  const now = new Date().toISOString();
  if (!obj.id) { obj.id = uid(); obj.createdAt = now; if (currentUserName()) obj.createdBy = currentUserName(); }
  obj.updatedAt = now;
  if (currentUserName()) obj.updatedBy = currentUserName();
  const i = S[coll].findIndex(x => x.id === obj.id);
  if (i >= 0) S[coll][i] = obj; else S[coll].push(obj);
  await DB.put(coll, obj);
  syncDirty();
  return obj;
}
/* deletions are remembered (tombstones) so they can be synced to other devices */
async function addTombstone(coll, id) {
  const meta = (await DB.all('meta')).find(m => m.id === 'tombs') || { id: 'tombs', list: [] };
  meta.list.push({ coll, id, at: new Date().toISOString() });
  await DB.put('meta', meta);
  syncDirty();
}
/* Wipe whole collections everywhere: records a deletion for every record so synced devices and the cloud delete them too */
async function wipeCollections(colls, withPhotos = true) {
  const meta = (await DB.all('meta')).find(m => m.id === 'tombs') || { id: 'tombs', list: [] };
  const at = new Date().toISOString();
  for (const c of colls) { for (const r of S[c]) meta.list.push({ coll: c, id: r.id, at }); await DB.clear(c); S[c] = []; }
  if (withPhotos) { for (const p of await DB.all('photos')) meta.list.push({ coll: 'photos', id: p.id, at }); await DB.clear('photos'); }
  await DB.put('meta', meta);
  syncDirty();
}
async function remove(coll, id) {
  S[coll] = S[coll].filter(x => x.id !== id);
  await DB.del(coll, id);
  await addTombstone(coll, id);
}
function get(coll, id) { return id ? S[coll].find(x => x.id === id) : null; }

const NO_COLL = { quote: 'quotes', job: 'jobs', mjob: 'jobs', invoice: 'invoices', receipt: 'payments', po: 'purchaseOrders', customer: 'customers', vehicle: 'vehicles', part: 'parts', supplier: 'suppliers', labour: 'labour', tech: 'technicians' };
async function nextNo(kind) {
  const st = S.settings, pre = st.prefixes[kind] || '';
  // never reuse a number already on file (important when several devices sync)
  let max = st.counters[kind] || 0;
  for (const r of S[NO_COLL[kind]] || []) {
    const c = r.number || r.code || '';
    if (c.startsWith(pre)) { const n = parseInt(c.slice(pre.length), 10); if (n > max) max = n; }
  }
  st.counters[kind] = max + 1;
  await saveSettings();
  return pre + String(st.counters[kind]).padStart(4, '0');
}

/* ---------- Utils ---------- */
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const today = () => toISODate(new Date());
function toISODate(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISODate(d); }
function addMonths(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return toISODate(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
function daysLeft(iso) { return iso ? daysBetween(today(), iso) : null; }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function money(n, withCur = true) {
  const s = num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withCur ? `${S.settings.currency} ${s}` : s;
}
const fmtNum = n => num(n).toLocaleString('en-US');
function monthKey(iso) { return (iso || '').slice(0, 7); }

/* Phone -> WhatsApp international digits (UAE default) */
function waNumber(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  const cc = S.settings.countryCode || '971';
  if (d.startsWith(cc) && d.length > 10) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return cc + d;
}

/* ---------- Lookups ---------- */
function customerOf(x) { return get('customers', x && x.customerId); }
function vehicleOf(x) { return get('vehicles', x && x.vehicleId); }
function vehicleLabel(v) { return v ? [v.make, v.model, v.year].filter(Boolean).join(' ') : ''; }
function techName(id) { const t = get('technicians', id); return t ? t.name : ''; }

function findVehicles(q) {
  const n = norm(q);
  if (!n) return [];
  return S.vehicles.filter(v => (v.plateNorm || '').includes(n) || (v.vinNorm || '').includes(n));
}
function exactVehicle(q) {
  const n = norm(q);
  if (!n) return null;
  return S.vehicles.find(v => v.plateNorm === n || v.vinNorm === n) ||
    (n.length >= 6 ? S.vehicles.find(v => v.vinNorm && v.vinNorm.endsWith(n)) : null);
}
function globalSearch(q) {
  const n = norm(q), low = String(q || '').toLowerCase().trim();
  if (!low) return { vehicles: [], customers: [], docs: [] };
  const digits = low.replace(/\D/g, '');
  const vehicles = S.vehicles.filter(v => (n && ((v.plateNorm || '').includes(n) || (v.vinNorm || '').includes(n))) ||
    vehicleLabel(v).toLowerCase().includes(low));
  const customers = S.customers.filter(c => (c.name || '').toLowerCase().includes(low) ||
    (digits.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(digits)) ||
    (c.email || '').toLowerCase().includes(low) || (c.code || '').toLowerCase() === low);
  const docs = [];
  for (const [coll, kind] of [['quotes', 'quote'], ['jobs', 'job'], ['invoices', 'invoice']])
    for (const d of S[coll]) if (norm(d.number) === n || (n.length >= 3 && norm(d.number).endsWith(n) && /\d/.test(n))) docs.push({ kind, d });
  return { vehicles, customers, docs };
}

/* ---------- Document maths ---------- */
function lineTotal(it) { return r2(num(it.qty) * num(it.rate)); }
function calcDoc(doc) {
  let parts = 0, labour = 0, other = 0, cost = 0, hours = 0;
  for (const it of doc.items || []) {
    const lt = lineTotal(it);
    if (it.type === 'part') { parts += lt; cost += num(it.qty) * num(it.cost); }
    else if (it.type === 'labour') { labour += lt; hours += num(it.qty); }
    else { other += lt; cost += num(it.qty) * num(it.cost); }
  }
  const subtotal = r2(parts + labour + other);
  const discount = r2(doc.discountType === 'amt' ? num(doc.discount) : subtotal * num(doc.discount) / 100);
  const net = r2(subtotal - discount);
  const vatRate = doc.vatRate ?? S.settings.vatRate;
  const vat = r2(net * num(vatRate) / 100);
  const total = r2(net + vat);
  return { parts: r2(parts), labour: r2(labour), other: r2(other), subtotal, discount, net, vatRate, vat, total, cost: r2(cost), profit: r2(net - cost), hours };
}
function invoicePaid(inv) { return r2(S.payments.filter(p => p.invoiceId === inv.id).reduce((a, p) => a + num(p.amount), 0)); }
function invoiceState(inv) {
  const t = calcDoc(inv), paid = invoicePaid(inv), balance = r2(t.total - paid);
  let status = inv.void ? 'Void' : balance <= 0.005 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
  if ((status === 'Unpaid' || status === 'Partial') && inv.dueDate && inv.dueDate < today()) status = 'Overdue';
  return { ...t, paid, balance: inv.void ? 0 : balance, status };
}
function customerBalance(cid) {
  return r2(S.invoices.filter(i => i.customerId === cid && !i.void).reduce((a, i) => a + invoiceState(i).balance, 0));
}
function jobInvoice(job) { return job.invoiceId ? get('invoices', job.invoiceId) : S.invoices.find(i => i.jobId === job.id); }
function jobTotals(job) { const inv = jobInvoice(job); return inv && !inv.void ? invoiceState(inv) : { ...calcDoc(job), paid: 0, balance: 0, status: 'Not invoiced' }; }
function quoteState(q) {
  let status = q.status || 'Draft';
  if ((status === 'Draft' || status === 'Sent') && q.validUntil && q.validUntil < today()) status = 'Expired';
  return status;
}

/* ---------- Stock (computed, never typed) ---------- */
/* Stock lives in locations: 'workshop' plus one per van. Opening stock and purchase orders land in the
   workshop; workshop jobs use workshop stock; mobile jobs use their van's stock; "Load van" moves stock
   between locations (a pair of adjustments with the same transferId). */
const WORKSHOP = 'workshop';
function stockLocations() { return [{ id: WORKSHOP, name: 'Workshop' }, ...((S.settings.mob && S.settings.mob.vans) || []).map(v => ({ id: v.id, name: v.name || 'Van' }))]; }
function jobLocation(job) { return job && job.line === 'mobile' ? ((job.mobile && job.mobile.vanId) || (S.settings.mob.vans[0] || {}).id || WORKSHOP) : WORKSHOP; }
function stockMovements() {
  const consumed = {}, received = {}, adjusted = {}, byLoc = {};
  const add = (m, id, q) => { if (id) m[id] = (m[id] || 0) + num(q); };
  const addLoc = (loc, id, q) => { if (!id) return; const k = loc || WORKSHOP; byLoc[k] = byLoc[k] || {}; byLoc[k][id] = (byLoc[k][id] || 0) + num(q); };
  for (const job of S.jobs) {
    if (job.status === 'Cancelled') continue;
    const inv = jobInvoice(job);
    const items = inv && !inv.void ? inv.items : job.items;
    const loc = jobLocation(job);
    for (const it of items || []) if (it.type === 'part') { add(consumed, it.partId, it.qty); addLoc(loc, it.partId, -num(it.qty)); }
  }
  for (const inv of S.invoices) {
    if (inv.jobId || inv.void) continue;
    for (const it of inv.items || []) if (it.type === 'part') { add(consumed, it.partId, it.qty); addLoc(WORKSHOP, it.partId, -num(it.qty)); }
  }
  for (const po of S.purchaseOrders) if (po.status === 'Received') for (const it of po.items || []) { add(received, it.partId, it.qty); addLoc(WORKSHOP, it.partId, it.qty); }
  for (const a of S.stockAdjustments) { if (!a.transferId) add(adjusted, a.partId, a.qty); addLoc(a.location, a.partId, a.qty); }
  return { consumed, received, adjusted, byLoc };
}
function stockTable() {
  const m = stockMovements();
  return S.parts.map(p => {
    const consumed = m.consumed[p.id] || 0, received = m.received[p.id] || 0, adjusted = m.adjusted[p.id] || 0;
    const onHand = r2(num(p.openingStock) + received - consumed + adjusted);
    const loc = {};
    for (const l of stockLocations()) loc[l.id] = r2((m.byLoc[l.id] || {})[p.id] || 0);
    loc[WORKSHOP] = r2(loc[WORKSHOP] + num(p.openingStock));
    return { p, consumed, received, adjusted, onHand, loc, value: r2(onHand * num(p.cost)), low: onHand <= num(p.reorderLevel) };
  });
}
function onHandOf(partId, location) { const row = stockTable().find(r => r.p.id === partId); return row ? (location ? (row.loc[location] || 0) : row.onHand) : 0; }

/* ---------- Mobile service ---------- */
const MOBILE_STATUSES = ['New', 'Assigned', 'On the way', 'Arrived', 'Working', 'Completed', 'Needs workshop', 'Cancelled'];
const MOBILE_OPEN = ['New', 'Assigned', 'On the way', 'Arrived', 'Working'];
const MOBILE_TO_JOB = { New: 'Booked', Assigned: 'Booked', 'On the way': 'In Progress', Arrived: 'In Progress', Working: 'In Progress', Completed: 'Delivered', Cancelled: 'Cancelled' };
const isMobile = j => j && j.line === 'mobile';
function lineOf(doc) {
  if (!doc) return 'auto'; if (doc.line) return doc.line;
  const j = doc.jobId && get('jobs', doc.jobId); if (j) return j.line || 'auto';
  const inv = doc.invoiceId && get('invoices', doc.invoiceId); if (inv) return lineOf(inv);
  return 'auto';
}
function brandFor(doc) { return lineOf(doc) === 'mobile' ? (S.settings.brandMobile || 'MendTech Mobile') : S.settings.garageName; }
function zoneOf(name) { return (S.settings.mob.zones || []).find(z => z.name === name); }
/* Is a date+time outside working hours (or on a weekend day)? */
function isAfterHours(dateISO, timeHHMM) {
  const m = S.settings.mob; if (m.allDay) return false;
  const t = timeHHMM || new Date().toTimeString().slice(0, 5);
  return t < (m.hoursStart || '08:00') || t >= (m.hoursEnd || '20:00');
}
function isWeekendDay(dateISO) { const d = new Date((dateISO || today()) + 'T00:00:00').getDay(); return (S.settings.mob.weekendDays || []).includes(d); }
function minutesBetween(a, b) { return a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null; }
function responseMinutes(job) { const t = (job.mobile || {}).times || {}; return minutesBetween(t.requested, t.arrived); }
function fmtMins(m) { if (m == null) return '—'; if (m < 60) return m + ' min'; return Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
function mapsLink(mob) {
  if (!mob) return '';
  if (mob.mapLink) return mob.mapLink;
  if (mob.lat && mob.lng) return `https://www.google.com/maps/search/?api=1&query=${mob.lat},${mob.lng}`;
  const q = [mob.address, mob.area, mob.zone && zoneOf(mob.zone) ? zoneOf(mob.zone).emirate : '', 'UAE'].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
}
function locationText(mob) { return mob ? [mob.address, mob.area, mob.zone && zoneOf(mob.zone) ? zoneOf(mob.zone).emirate : ''].filter(Boolean).join(', ') : ''; }
function crewOf(job) { const m = job.mobile || {}; return [techName(job.technicianId), techName(m.driverId)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); }

/* ---------- Vehicle intelligence ---------- */
function vehicleJobs(vid) { return S.jobs.filter(j => j.vehicleId === vid).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
function currentOdo(v) {
  let m = num(v.odometer);
  for (const j of S.jobs) if (j.vehicleId === v.id) m = Math.max(m, num(j.odometer), num(j.odometerOut));
  for (const q of S.quotes) if (q.vehicleId === v.id) m = Math.max(m, num(q.odometer));
  return m;
}
function serviceSchedule(v) {
  const odo = currentOdo(v);
  const done = {};
  const consider = (item, date, o) => {
    if (!item) return;
    const cur = done[item];
    if (!cur || date > cur.date || (date === cur.date && o > cur.odo)) done[item] = { date, odo: o };
  };
  for (const j of S.jobs) {
    if (j.vehicleId !== v.id || j.status === 'Cancelled') continue;
    if (!DONE_JOB.includes(j.status) && !jobInvoice(j)) continue;
    const inv = jobInvoice(j);
    const items = inv && !inv.void ? inv.items : j.items;
    for (const it of items || []) consider(it.serviceItem, j.completed || j.date, num(j.odometer));
  }
  for (const [item, o] of Object.entries(v.serviceOverrides || {})) if (o && o.date) consider(item, o.date, num(o.odo));
  return S.settings.serviceItems.map(si => {
    const d = done[si.name];
    if (!d) return { ...si, status: 'No record' };
    const nextOdo = si.km ? d.odo + num(si.km) : null;
    const nextDate = si.months ? addMonths(d.date, num(si.months)) : null;
    const kmLeft = nextOdo != null ? nextOdo - odo : null;
    const dLeft = nextDate ? daysLeft(nextDate) : null;
    let status = 'OK';
    if ((kmLeft != null && kmLeft <= 0) || (dLeft != null && dLeft <= 0)) status = 'Overdue';
    else if ((kmLeft != null && kmLeft <= 1000) || (dLeft != null && dLeft <= 30)) status = 'Due Soon';
    return { ...si, lastDate: d.date, lastOdo: d.odo, nextOdo, nextDate, kmLeft, dLeft, status };
  });
}

/* Everything that ever happened to a vehicle, newest first */
function vehicleTimeline(v) {
  const ev = [];
  for (const j of S.jobs.filter(x => x.vehicleId === v.id)) ev.push({ date: j.date, type: 'job', ref: j });
  for (const q of S.quotes.filter(x => x.vehicleId === v.id)) ev.push({ date: q.date, type: 'quote', ref: q });
  for (const i of S.invoices.filter(x => x.vehicleId === v.id)) ev.push({ date: i.date, type: 'invoice', ref: i });
  const invIds = new Set(S.invoices.filter(x => x.vehicleId === v.id).map(i => i.id));
  for (const p of S.payments.filter(x => invIds.has(x.invoiceId))) ev.push({ date: p.date, type: 'payment', ref: p });
  for (const m of S.messages.filter(x => x.vehicleId === v.id)) ev.push({ date: (m.date || '').slice(0, 10), type: 'message', ref: m });
  for (const o of v.ownerHistory || []) ev.push({ date: o.date, type: 'owner', ref: o });
  if (v.createdAt) ev.push({ date: v.createdAt.slice(0, 10), type: 'registered', ref: v });
  const order = { registered: 0, owner: 1, quote: 2, job: 3, invoice: 4, payment: 5, message: 6 };
  return ev.sort((a, b) => (b.date || '').localeCompare(a.date || '') || order[b.type] - order[a.type]);
}
function vehicleStats(v) {
  const invs = S.invoices.filter(i => i.vehicleId === v.id && !i.void);
  const spent = r2(invs.reduce((a, i) => a + invoiceState(i).total, 0));
  const balance = r2(invs.reduce((a, i) => a + invoiceState(i).balance, 0));
  const jobs = S.jobs.filter(j => j.vehicleId === v.id && j.status !== 'Cancelled');
  const dates = jobs.map(j => j.date).sort();
  return { spent, balance, visits: jobs.length, first: dates[0], last: dates[dates.length - 1], odo: currentOdo(v) };
}

/* ---------- Message templates ---------- */
function fillTemplate(tpl, ctx) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] ?? '')).replace(/\n{3,}/g, '\n\n');
}
function baseCtx(v, c) {
  const st = S.settings;
  return {
    customer: c ? c.name : 'Customer', plate: v ? v.plate : '', vehicle: vehicleLabel(v), vin: v ? v.vin : '',
    odometer: v ? fmtNum(currentOdo(v)) : '', garage: st.garageName, garagePhone: contactLine(), whatsapp: st.whatsapp || '', phone: st.phone || '',
    bank: st.bankDetails || '', payInfo: payInfoText(null, ''), payLink: st.payStripeLink || '', brand: st.garageName, reviewLink: (st.offers || {}).googleReviewLink || '',
  };
}
/* Contact line used in messages and documents: calls + WhatsApp */
function contactLine(sep = ' · ') {
  const st = S.settings;
  return [st.phone ? 'Call ' + st.phone : '', st.whatsapp ? 'WhatsApp ' + st.whatsapp : '', st.mobile && st.mobile !== st.whatsapp ? st.mobile : ''].filter(Boolean).join(sep);
}
function waGarage() { return waNumber(S.settings.whatsapp || S.settings.mobile || S.settings.phone); }
/* Pasted bank details (the free-text box) count only when they hold real details */
function pastedBankDetails() { const b = (S.settings.bankDetails || '').trim(); return b && !/^Bank:\s*\nAccount Name:\s*\nIBAN:\s*$/.test(b) && /\d{6,}|IBAN\s*\S|AE\d/i.test(b) ? b : ''; }
/* "How to pay" text for messages: Stripe card link + WIO bank details */
function payLinkFor(inv) { return (inv && inv.payLink) || S.settings.payStripeLink || ''; }
function hasPaymentDetails(inv) { const st = S.settings; return !!(payLinkFor(inv) || st.wioIban || st.wioLink || pastedBankDetails()); }
function payInfoText(inv, amountText) {
  const st = S.settings, lines = [];
  const link = payLinkFor(inv), ref = inv && inv.number ? inv.number : '';
  if (link) lines.push(`💳 Pay by card / Apple Pay${amountText ? ' (' + amountText + ')' : ''}: ${link}`);
  if (st.wioIban) lines.push(`🏦 Bank transfer: ${st.wioName || st.legalName || st.garageName}, ${st.wioBank || 'Wio Bank'}, IBAN ${st.wioIban}${ref ? ', reference ' + ref : ''}`);
  const pasted = pastedBankDetails();
  if (pasted && !(st.wioIban && pasted.replace(/\s/g, '').includes(st.wioIban.replace(/\s/g, '')))) lines.push(`🏦 Bank transfer:\n${pasted}${ref ? '\nReference: ' + ref : ''}`);
  if (st.wioLink) lines.push(`🔗 Pay with WIO: ${st.wioLink}`);
  return lines.join('\n');
}
/* Settings upgrades for existing garages (runs once per version, syncs to all devices) */
async function migrateSettings() {
  const st = S.settings; let changed = false;
  if (!st.updatedAt) return;   // fresh device: wait for the real settings to arrive from the cloud
  if ((st.schema || 0) < 21) {
    if (!st.garageName || st.garageName === 'My Auto Garage') { st.garageName = 'MendTech Auto'; changed = true; }
    for (const k of ['invoice', 'payment']) if (st.templates[k] && st.templates[k].includes('{bank}') && !st.templates[k].includes('{payInfo}')) { st.templates[k] = st.templates[k].replace('{bank}', '{payInfo}'); changed = true; }
    const pm = st.lists.paymentMethod;
    for (const m of ['Bank transfer – WIO', 'Card – Stripe']) if (!pm.includes(m)) { pm.splice(1, 0, m); changed = true; }
    st.schema = 21; changed = true;
  }
  if (st.schema < 30) {   // v3: MendTech Mobile
    const add = (list, items, before) => { for (const it of items) if (!list.includes(it)) { const i = before ? list.indexOf(before) : -1; i >= 0 ? list.splice(i, 0, it) : list.push(it); } };
    add(st.lists.expenseCategory, ['Fuel', 'Salik / tolls', 'Parking', 'Van maintenance', 'Bank & card charges'], 'Other');
    add(st.lists.trade, ['Mobile Technician', 'Driver'], 'Service Advisor');
    add(st.lists.jobType, ['Mobile service'], 'Mechanical Repair');
    st.prefixes.mjob = st.prefixes.mjob || 'MJ-'; st.counters.mjob = st.counters.mjob || 0;
    st.schema = 30; changed = true;
  }
  if (st.schema < 31) {   // v3.0.1: MendTech contact numbers (only fills in placeholders, never overwrites your own)
    if (!st.phone || st.phone === '04-000 0000') st.phone = '+971 55 957 4148';
    if (!st.whatsapp) st.whatsapp = '+971 52 233 8499';
    st.schema = 31; changed = true;
  }
  if (st.schema < 32) {   // v3.1: Security Level 1 (defaults come from DEFAULT_SETTINGS; nothing to convert)
    st.schema = 32; changed = true;
  }
  if (st.schema < 33) {   // v3.2: mendtech. branding — brand terms replace the old defaults only if you never edited them
    if (st.quoteTerms === 'Prices valid for the period shown. Additional work found during repair will be quoted separately before proceeding.') st.quoteTerms = DEFAULT_SETTINGS.quoteTerms;
    if (st.invoiceTerms === 'Thank you for your business. Parts warranty as per manufacturer. Labour warranty 30 days / 1,000 km.') st.invoiceTerms = DEFAULT_SETTINGS.invoiceTerms;
    st.schema = 33; changed = true;
  }
  if (st.schema < 34) {   // v3.2: owner's answers — Sharjah address, quotes valid 7 days, 08:00–20:00 + paid 24/7 emergency
    if (!st.address || /Al Quoz/i.test(st.address)) st.address = DEFAULT_SETTINGS.address;
    if (num(st.quoteValidDays) === 14) st.quoteValidDays = 7;
    if (!st.docFooter || st.docFooter === 'Workshop 08:00–20:00 · Mobile 24/7 · Sharjah') st.docFooter = DEFAULT_SETTINGS.docFooter;
    st.mob.allDay = false;
    st.schema = 34; changed = true;
  }
  if (st.schema < 35) {   // v3.3: partner payments are recorded as expenses
    if (!st.lists.expenseCategory.includes('Partner payments')) st.lists.expenseCategory.splice(Math.max(0, st.lists.expenseCategory.indexOf('Other')), 0, 'Partner payments');
    st.schema = 35; changed = true;
  }
  if (changed) await saveSettings();
}
function itemsSummary(items, max = 12) {
  const lines = (items || []).slice(0, max).map(it => `• ${it.desc}${num(it.qty) !== 1 ? ' x' + num(it.qty) : ''} — ${money(lineTotal(it))}`);
  if ((items || []).length > max) lines.push(`• …and ${items.length - max} more`);
  return lines.join('\n');
}
