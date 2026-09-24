/* GaragePro — boot + demo example */
'use strict';

/* One complete demo story (one customer, one car) — every record is tagged demo:true
   so it can be removed in one click before going live. */
let DEMO_MODE = false;
const _saveCore = save;
save = async function (coll, obj) { if (DEMO_MODE && !obj.id) obj.demo = true; return _saveCore(coll, obj); };   // eslint-disable-line no-global-assign

async function loadDemoData(skipConfirm) {
  if (!skipConfirm && S.demoLoaded && !(await confirmBox('The demo example is already loaded. Add it again?'))) return;
  DEMO_MODE = true;
  try {
    const d = n => addDays(today(), -n), rate = S.settings.labourRate;
    const sup = await save('suppliers', { code: await nextNo('supplier'), name: 'DEMO — Al Quoz Auto Spares', contact: 'Faisal', phone: '04-3391122', email: 'sales@example.ae', category: 'Filters, brakes, batteries', terms: '30 days credit' });
    const t1 = await save('technicians', { code: await nextNo('tech'), name: 'Demo Mechanic', trade: 'General Mechanic', phone: '050-0000001', costRate: 35, active: true });
    const t2 = await save('technicians', { code: await nextNo('tech'), name: 'Demo Electrician', trade: 'Auto Electrician', phone: '050-0000002', costRate: 38, active: true });
    const part = {};
    for (const [k, name, cat, pn, unit, open, cost, price, reorder, svc] of [
      ['of', 'Oil Filter - Toyota', 'Filters', '90915-YZZD4', 'pcs', 10, 32, 45, 3, 'Engine Oil & Filter'],
      ['oil', 'Engine Oil 5W-30 Full Synthetic', 'Fluids & Lubricants', 'OIL-5W30', 'L', 40, 22, 38, 10, ''],
      ['af', 'Air Filter - Toyota Camry', 'Filters', '17801-0V020', 'pcs', 4, 42, 70, 2, 'Air Filter'],
      ['bp', 'Brake Pads Front - Toyota Camry', 'Brakes', '04465-33480', 'set', 3, 145, 260, 1, 'Brake Pads - Front'],
      ['bat', 'Battery 70Ah AGM', 'Battery & Electrical', 'AGM-70', 'pcs', 2, 320, 520, 1, 'Battery']])
      part[k] = await save('parts', { code: await nextNo('part'), name, category: cat, partNumber: pn, fits: 'Toyota Camry', unit, openingStock: open, cost, price, reorderLevel: reorder, supplierId: sup.id, serviceItem: svc });
    const lab = {};
    for (const [k, name, cat, hrs, svc] of [['oil', 'Engine oil & filter change', 'Service', 1, 'Engine Oil & Filter'], ['bpf', 'Brake pads replacement - front axle', 'Brakes', 1.2, 'Brake Pads - Front'],
      ['bat', 'Battery test & replacement', 'Electrical', 0.5, 'Battery'], ['insp', 'Full multi-point inspection', 'Diagnostics', 1, ''], ['af', 'Air filter replacement', 'Service', 0.3, 'Air Filter']])
      lab[k] = await save('labour', { code: await nextNo('labour'), name, category: cat, hours: hrs, rate, serviceItem: svc });
    const P = (k, q = 1) => ({ type: 'part', partId: part[k].id, partNo: part[k].partNumber, desc: part[k].name, qty: q, rate: part[k].price, cost: part[k].cost, serviceItem: part[k].serviceItem || '' });
    const L = (k, t, h) => ({ type: 'labour', labourId: lab[k].id, desc: lab[k].name, qty: h ?? lab[k].hours, rate, cost: 0, serviceItem: lab[k].serviceItem || '', technicianId: t.id });
    await save('packages', { name: 'Minor service — sedan (demo)', description: 'Oil & filter, air filter', items: [P('of'), P('oil', 4.4), P('af'), L('oil', t1), L('af', t1)], discount: 0, discountType: 'pct', vatRate: S.settings.vatRate });

    const c = await save('customers', { code: await nextNo('customer'), name: 'DEMO — Ahmed Al Farsi', type: 'Individual', phone: '050-1234567', email: 'demo@example.ae', address: 'Jumeirah, Dubai' });
    const v = await save('vehicles', { code: await nextNo('vehicle'), customerId: c.id, plate: 'DEMO 12345', plateNorm: norm('DEMO 12345'), emirate: 'Dubai', make: 'Toyota', model: 'Camry', year: 2020, color: 'White', vin: 'JTNBE46K703012345', vinNorm: norm('JTNBE46K703012345'), fuel: 'Petrol', transmission: 'Automatic', oilGrade: '5W-30 Synthetic', tyreSize: '215/55 R17', battery: '70Ah AGM', odometer: 38000, regExpiry: addDays(today(), 20), insExpiry: addDays(today(), 120), status: 'Active' });
    const base = { vehicleId: v.id, customerId: c.id, discount: 0, discountType: 'pct', vatRate: S.settings.vatRate };

    // Visit 1 — six months ago: service, invoiced and paid
    const j1 = await save('jobs', { ...base, number: await nextNo('job'), date: d(185), odometer: 38200, status: 'Delivered', technicianId: t1.id, type: 'Periodic Service', complaint: 'Routine service', diagnosis: 'Oil & filter and air filter changed. Car checked, all OK.', items: [P('of'), P('oil', 4.4), P('af'), L('oil', t1), L('af', t1)], promised: d(185), completed: d(184) });
    const i1 = await save('invoices', { ...base, number: await nextNo('invoice'), date: d(184), jobId: j1.id, odometer: 38200, items: structuredClone(j1.items), workDone: j1.diagnosis, dueDate: d(184) });
    j1.invoiceId = i1.id; await save('jobs', j1);
    await save('payments', { number: await nextNo('receipt'), date: d(184), invoiceId: i1.id, customerId: c.id, vehicleId: v.id, amount: invoiceState(i1).total, method: 'Card', reference: 'Demo payment' });

    // Visit 2 — now in the workshop, with inspection advisories
    const insp = S.settings.inspectionTemplate.map(([cat, point]) => ({ cat, point, result: 'OK', note: '' }));
    const flag = (txt, result, note) => { const p = insp.find(x => x.point.toLowerCase().includes(txt)); if (p) Object.assign(p, { result, note }); };
    flag('battery', 'Replace', 'Failed load test — 58% health'); flag('front tyres', 'Attention', '3mm tread left');
    await save('jobs', { ...base, number: await nextNo('job'), date: d(1), odometer: 45200, status: 'In Progress', technicianId: t1.id, type: 'Mechanical Repair', complaint: 'Squeal when braking', diagnosis: 'Front pads worn to 2mm — replacing. Inspection done.', items: [P('bp'), L('bpf', t1), L('insp', t2)], promised: today(), inspection: insp });

    // Quotation for the recommended (not yet approved) work
    await save('quotes', { ...base, number: await nextNo('quote'), date: d(1), odometer: 45200, status: 'Sent', sentAt: new Date(Date.now() - 2 * 864e5).toISOString(), validUntil: addDays(today(), 13), description: 'Battery replacement (from inspection)', items: [P('bat'), L('bat', t2)] });
    // A booking next week
    await save('bookings', { date: addDays(today(), 7), time: '10:00', plate: v.plate, vehicleId: v.id, customerId: c.id, service: 'AC Service', duration: 2, status: 'Confirmed', notes: 'Demo booking' });
    await save('expenses', { date: d(3), category: 'Workshop Consumables', description: 'DEMO — gloves, rags, degreaser', amount: 210, vat: 10, paidTo: 'Demo supplier', method: 'Cash' });

    /* ----- MendTech Mobile demo ----- */
    const van = (S.settings.mob.vans[0] || { id: 'van1' }).id;
    const drv = await save('technicians', { code: await nextNo('tech'), name: 'Demo Driver', trade: 'Driver', phone: '050-0000003', costRate: 20, active: true });
    for (const [k, q] of [['bat', 2], ['of', 4], ['oil', 12], ['af', 2]]) {   // load the van
      const tid = uid();
      await save('stockAdjustments', { partId: part[k].id, qty: -q, location: WORKSHOP, transferId: tid, reason: 'Loaded onto van (demo)', date: d(1) });
      await save('stockAdjustments', { partId: part[k].id, qty: q, location: van, transferId: tid, reason: 'Loaded onto van (demo)', date: d(1) });
    }
    const zones = S.settings.mob.zones, iso = (daysAgo, h, mi) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, mi, 0, 0); return x.toISOString(); };
    const c2 = await save('customers', { code: await nextNo('customer'), name: 'DEMO — Omar Siddiqui', type: 'Individual', phone: '052-9988776', address: 'Al Nahda, Sharjah' });
    const v2 = await save('vehicles', { code: await nextNo('vehicle'), customerId: c2.id, plate: 'DEMO 48213', plateNorm: norm('DEMO 48213'), emirate: 'Sharjah', make: 'Nissan', model: 'Altima', year: 2019, color: 'Grey', status: 'Active', odometer: 88000 });
    const mjob = (o) => ({ line: 'mobile', type: 'Mobile service', discount: 0, discountType: 'pct', vatRate: S.settings.vatRate, odometer: '', ...o });
    // ONE mobile demo: an urgent call that the team walks through live (assign → on my way → arrived → work → complete → invoice)
    await save('jobs', mjob({ number: await nextNo('mjob'), date: today(), vehicleId: v2.id, customerId: c2.id, status: 'Booked', complaint: "Car won't start — clicking sound", items: [],
      mobile: { status: 'New', zone: (zones.find(z => z.emirate === 'Sharjah') || zones[0]).name, area: 'Al Nahda 2', address: 'Building 14, basement P1', problem: 'Battery test / replacement', urgency: 'urgent', prefDate: today(), source: 'Phone call', vanId: van,
        times: { requested: new Date(Date.now() - 12 * 60000).toISOString() } } }));
    await save('expenses', { date: d(1), category: 'Fuel', description: 'DEMO — van fuel', amount: 120, vat: 5.71, paidTo: 'ENOC', method: 'Card (machine)', vanId: van });
  } finally { DEMO_MODE = false; }
  toast('Demo loaded — Auto: DEMO 12345 · Mobile: DEMO 48213', 'ok');
  go('#/dashboard');
}
Object.defineProperty(S, 'demoLoaded', { get: () => COLLECTIONS.some(c => S[c].some(r => r.demo)) });

async function removeDemoData() {
  const n = COLLECTIONS.reduce((a, c) => a + S[c].filter(r => r.demo).length, 0);
  if (!n) return toast('No demo records found');
  if (!(await confirmBox(`Remove the demo example (${n} records)? Your own records are not touched.`, 'Remove demo', true))) return;
  for (const c of COLLECTIONS) for (const r of S[c].filter(r => r.demo)) await remove(c, r.id);
  const ids = new Set(S.jobs.map(j => j.id));
  for (const p of await DB.all('photos')) if (!ids.has(p.jobId)) { await DB.del('photos', p.id); await addTombstone('photos', p.id); }
  if (!S.jobs.length && !S.invoices.length && !S.quotes.length) { Object.keys(S.settings.counters).forEach(k => S.settings.counters[k] = 0); await saveSettings(); }
  toast('Demo removed — ready for real work', 'ok'); go('#/dashboard');
}
/* Wipe everything and keep just the single demo example (for training) */
async function resetToOneDemo() {
  const total = COLLECTIONS.reduce((a, c) => a + S[c].length, 0);
  const m = openModal({
    title: 'Keep only one demo example', size: 'narrow',
    body: `<p>This deletes <b>all ${total} records</b> (customers, cars, jobs, invoices, stock…) — ${Sync.user ? '<b>on every synced device and in the cloud</b>' : 'on this computer'} — and loads <b>one MendTech Auto demo</b> (DEMO 12345) and <b>one MendTech Mobile demo</b> (DEMO 48213) for training.</p><p>Staff logins and your garage settings (numbers, WIO, Stripe, logo) are kept. Download a backup first if unsure.</p><p>Type <b>RESET</b> to confirm.</p><input class="inp" id="rs_c">`,
    foot: `<button class="btn" data-c>Cancel</button><button class="btn danger" data-ok>Reset & load demos</button>`
  });
  m.el.querySelector('[data-c]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    if (m.el.querySelector('#rs_c').value.trim().toUpperCase() !== 'RESET') return toast('Type RESET to confirm', 'err');
    if (!(await ownerApprove('Delete all records and load the demo examples', { always: true, level: 'alert' }))) return;
    await wipeCollections(COLLECTIONS.filter(c => c !== 'staff' && c !== 'secLog'));
    secLog('erase', 'All records deleted — demo examples loaded', 'alert');
    Object.keys(S.settings.counters).forEach(k => S.settings.counters[k] = 0); await saveSettings();
    m.close(); await loadDemoData(true);
  };
}

(async function boot() {
  try {
    await loadAll();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="card card-pad red">Could not open the local database: ${esc(e.message)}.<br>Please open this app in Google Chrome or Microsoft Edge.</div>`;
    return;
  }
  await migrateSettings();
  if (IS_PREVIEW) document.title = 'PREVIEW — ' + document.title;
  if (IS_PREVIEW && !S.jobs.length && !S.customers.length && !localStorage.getItem('gp_preview_seeded')) {
    try { localStorage.setItem('gp_preview_seeded', '1'); } catch (e) { }
    await loadDemoData(true);
  }
  Auth.restore();
  Install.init();
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeunload', () => { if (ED.timer) edFlush(); });
  if (!location.hash) location.hash = '#/dashboard'; else render();
  if (Auth.user) Auth.armIdle();
  Sync.init();   // background — never blocks the app
})();
