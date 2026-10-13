// v3.9: advance on a job, quick past job, invoice/payment dates, "not known yet" plate/phone/km, job type default,
// repeat expense, On Hold status, missing details — with the owner's own October examples
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x).slice(0, 400))); if (!c) process.exitCode = 1; };
const errs = []; const ctx = await b.newContext({ viewport: { width: 1300, height: 1100 } }); const P = await ctx.newPage(); P.on('pageerror', e => errs.push(e.message));
await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2500);
const ev = (f, a) => P.evaluate(f, a);
const set = async vals => ev(v => { for (const [k, x] of Object.entries(v)) { const el = document.getElementById('f_' + k); if (!el) throw new Error('no field ' + k); if (el.type === 'checkbox') el.checked = !!x; else el.value = x; } }, vals);
const save = async () => { await P.click('.modal-back:last-child [data-save]'); await P.waitForTimeout(700); };
const yes = async () => { await P.click('.modal-back:last-child [data-yes]'); await P.waitForTimeout(700); };
const no = async () => { await P.click('.modal-back:last-child [data-no]'); await P.waitForTimeout(700); };
const view = () => ev(() => document.getElementById('view').innerText);
const d8 = await ev(() => addDays(today(), -6)), d12 = await ev(() => addDays(today(), -2)), t = await ev(() => today());
ok((await ev(() => APP_VERSION)).startsWith('3.9'), 'version 3.9.x');

// ---- 5. job type default + 4. unknown phone / plate / km at check-in ----
await ev(() => go('#/checkin/URVAN')); await P.waitForTimeout(500);
ok(await ev(() => document.getElementById('ci_type').value) === 'Mechanical Repair', 'check-in: job type defaults to Mechanical Repair');
await ev(() => { $('#nv_noplate').checked = true; $('#nv_noplate').onchange(); $('#nv_make').value = 'Nissan'; $('#nv_model').value = 'Urvan'; $('#nv_year').value = '2014'; $('#nc_name').value = 'RAZZAK'; $('#ci_comp').value = 'Engine overhaul + differential'; });
await ev(() => { checkinCreate('job'); }); await P.waitForTimeout(700);
ok(/without km/i.test(await ev(() => document.querySelector('.modal-back:last-child')?.innerText || '')), 'no km → asks to continue without it');
await yes();
const urv = await ev(() => { const j = ED.doc; const v = vehicleOf(j), c = customerOf(j); return { jid: j.id, type: j.type, plate: v.plate, unk: v.plateUnknown, cname: c.name, phone: c.phone || '' }; });
ok(/^TEMP-\d{3}$/.test(urv.plate) && urv.unk === true && urv.cname === 'RAZZAK' && urv.phone === '' && urv.type === 'Mechanical Repair', 'job opened with TEMP plate, owner without phone', urv);

// ---- 1. advance: Razzak paid 3,000 for parts on 12 Oct ----
await ev(j => { const x = get('jobs', j); x.date = addDays(today(), -6); save('jobs', x); go('#/job/' + j); }, urv.jid); await P.waitForTimeout(500);
ok(/Advance \/ deposit/i.test(await view()), 'job card shows the Advance card');
const cash0 = await ev(() => accountBalance('cash'));
await ev(j => recordAdvance(j), urv.jid); await P.waitForTimeout(300); await set({ amount: 3000, date: d12, method: 'Cash', reference: 'for parts' }); await save(); await no();   // no receipt now
const adv = await ev(j => ({ list: jobAdvances(get('jobs', j)).map(p => [p.amount, p.date, p.method, p.invoiceId]), cash: accountBalance('cash'), card: document.getElementById('view').innerText }), urv.jid);
ok(adv.list.length === 1 && adv.list[0][0] === 3000 && adv.list[0][1] === d12 && adv.list[0][3] === '', 'advance saved on the job (no invoice yet)', adv.list);
ok(adv.cash - cash0 === 3000, 'Cash & bank counts the advance at once', { cash0, cash: adv.cash });
ok(/3,000/.test(adv.card) && /off the invoice/i.test(adv.card), 'job card lists the advance');
ok(await ev(d => dayReportData(d).collected >= 3000, d12), 'day report counts it on 12 Oct');
await ev(j => go('#/customer/' + get('jobs', j).customerId), urv.jid); await P.waitForTimeout(400);
ok(/Advance held/i.test(await view()), 'customer page shows the advance held');
ok(await ev(j => statementHTML(get('jobs', j).customerId).includes('Advance'), urv.jid), 'customer statement shows the advance');
await ev(() => go('#/payments')); await P.waitForTimeout(400);
ok(/Advance · JC-/i.test(await view()), 'payments list marks it as an advance on the job');
// finish: parts + labour 4,200 → invoice, dated the job's day
await ev(async j => { const x = get('jobs', j); x.items = [{ type: 'part', desc: 'Engine overhaul parts', qty: 1, rate: 3200, cost: 3000 }, { type: 'labour', fixed: true, desc: 'Overhaul + differential labour', qty: 1, rate: 1000, cost: 0 }]; x.status = 'Ready'; await save('jobs', x); go('#/job/' + j); }, urv.jid); await P.waitForTimeout(400);
await ev(() => { createInvoiceFromJob(); }); await P.waitForTimeout(600);
ok(/Date the invoice/i.test(await ev(() => document.querySelector('.modal-back:last-child')?.innerText || '')), 'asks: job date or today');
await yes();
const inv1 = await ev(j => { const i = jobInvoice(get('jobs', j)), s = invoiceState(i); return { date: i.date, total: s.total, paid: s.paid, bal: s.balance, status: s.status, left: jobAdvances(get('jobs', j)).length }; }, urv.jid);
ok(inv1.date === d8 && inv1.paid === 3000 && Math.abs(inv1.bal - (inv1.total - 3000)) < 0.01 && inv1.left === 0, 'invoice dated the job day, advance counted as paid', inv1);
ok(/advance/i.test(await view()), 'invoice payments show the advance');
// pay the rest — payment date defaults to today (invoice made earlier, paid later is normal)…
await ev(() => recordPayment(ED.doc.id)); await P.waitForTimeout(300);
ok(await ev(() => document.getElementById('f_date').value) === d8, 'payment date defaults to the invoice date for work entered today');
await P.click('.modal-back:last-child [data-close2]'); await P.waitForTimeout(300);

// ---- 3. "Use today" choice ----
const j2 = await ev(async () => { const v = S.vehicles[0]; const j = await save('jobs', { number: await nextNo('job'), date: addDays(today(), -3), vehicleId: v.id, customerId: v.customerId, status: 'Delivered', type: 'Mechanical Repair', items: [{ type: 'labour', fixed: true, desc: 'x', qty: 1, rate: 100 }], discount: 0, discountType: 'pct' }); go('#/job/' + j.id); return j.id; });
await P.waitForTimeout(400); await ev(() => { createInvoiceFromJob(); }); await P.waitForTimeout(600); await no();
ok(await ev(j => jobInvoice(get('jobs', j)).date, j2) === t, '“Use today” dates the invoice today');
const j3 = await ev(async () => { const v = S.vehicles[0]; const j = await save('jobs', { number: await nextNo('job'), date: today(), vehicleId: v.id, customerId: v.customerId, status: 'Delivered', items: [{ type: 'labour', fixed: true, desc: 'y', qty: 1, rate: 50 }], discount: 0, discountType: 'pct' }); go('#/job/' + j.id); return j.id; });
await P.waitForTimeout(400); await ev(() => { createInvoiceFromJob(); }); await P.waitForTimeout(700);
ok(await ev(j => !!jobInvoice(get('jobs', j)) && !document.querySelector('.modal-back [data-yes]'), j3), 'job from today: no question, invoice made straight away');

// ---- 2. quick past job: Aject's Sunny 150, 8 Oct, no plate yet ----
const aject = await ev(async () => (await save('customers', { name: 'AJECT RENT A CAR', type: 'Fleet', phone: '' })).id);
await ev(() => go('#/jobs')); await P.waitForTimeout(300);
ok(/Quick past job/i.test(await view()), 'Jobs page has the Quick past job button');
await ev(() => quickPastJob()); await P.waitForTimeout(400);
await ev(([d, c]) => { const m = document.querySelector('.modal-back:last-child'), q = s => m.querySelector(s);
  q('#qj_date').value = d; q('#qj_date').dispatchEvent(new Event('input')); q('#qj_veh').value = ''; q('#qj_noplate').checked = true; q('#qj_noplate').onchange();
  q('#qj_make').value = 'Nissan'; q('#qj_model').value = 'Sunny'; q('#qj_year').value = '2018'; q('#qj_cust').value = c; q('#qj_cust').onchange();
  q('#qj_work').value = 'Engine repair + labour'; q('#qj_amount').value = '150'; q('#qj_paid').value = 'part'; q('#qj_paid').onchange(); q('#qj_paidamt').value = '500'; }, [d8, aject]);
ok(await ev(() => document.querySelector('.modal-back:last-child #qj_pdate').value) === d8, 'payment date follows the work date');
const nJobs = await ev(() => S.jobs.length);
await P.click('.modal-back:last-child [data-ok]'); await P.waitForTimeout(600);
ok(await ev(() => S.jobs.length) === nJobs && await ev(() => !!document.querySelector('.modal-back:last-child #qj_work')), 'wrong part-paid amount: nothing saved, form stays open');
await ev(() => { const m = document.querySelector('.modal-back:last-child'); m.querySelector('#qj_paid').value = 'full'; m.querySelector('#qj_paid').onchange(); });
await P.click('.modal-back:last-child [data-ok]'); await P.waitForTimeout(900);
const q1 = await ev(() => { const j = S.jobs.find(x => x.quick && /Engine repair/.test(x.complaint)), i = jobInvoice(j), p = S.payments.find(x => x.invoiceId === i.id), v = vehicleOf(j);
  return { jdate: j.date, status: j.status, type: j.type, idate: i.date, total: invoiceState(i).total, st: invoiceState(i).status, pdate: p.date, pm: p.method, plate: v.plate, unk: v.plateUnknown, owner: customerOf(j).name, line: i.items[0] }; });
ok(q1.jdate === d8 && q1.idate === d8 && q1.pdate === d8 && q1.status === 'Delivered' && q1.st === 'Paid' && q1.pm === 'Cash' && q1.total >= 150, 'one Save: job + invoice + payment, all on 8 Oct', q1);
ok(/^TEMP-/.test(q1.plate) && q1.unk && q1.owner === 'AJECT RENT A CAR' && q1.line.fixed && q1.line.rate === 150 && q1.type === 'Mechanical Repair', 'new car with temporary plate, owner Aject, fixed-price line', q1);
// existing car, not paid
const nq = await ev(() => S.invoices.length);
await ev(() => quickPastJob()); await P.waitForTimeout(400);
await ev(v => { const m = document.querySelector('.modal-back:last-child'), q = s => m.querySelector(s); q('#qj_veh').value = v; q('#qj_veh').onchange(); q('#qj_work').value = 'General service'; q('#qj_amount').value = '100'; q('#qj_paid').value = 'none'; q('#qj_paid').onchange(); }, await ev(() => S.vehicles.find(v => v.customerId && get('customers', v.customerId) && !/^TEMP/.test(v.plate)).id));
await P.click('.modal-back:last-child [data-ok]'); await P.waitForTimeout(900);
ok(await ev(n => S.invoices.length === n + 1 && invoiceState(S.invoices[S.invoices.length - 1]).status !== 'Paid', nq), 'existing car, not paid yet → unpaid invoice');

// ---- 11. missing details ----
await ev(() => go('#/dashboard')); await P.waitForTimeout(500);
const dash = await view();
ok(/Missing details/i.test(dash) && /plate not known yet/i.test(dash) && /no phone/i.test(dash), 'dashboard: Missing details card (plate, phone)');
await ev(() => go('#/missing')); await P.waitForTimeout(300);
const miss0 = await ev(() => missingInfo().length);
const sunnyV = await ev(() => S.vehicles.find(v => v.model === 'Sunny').id);
await ev(v => editVehicle(v), sunnyV); await P.waitForTimeout(300); await set({ plate: 'K 54321' }); await save();
const sv = await ev(v => ({ plate: get('vehicles', v).plate, unk: get('vehicles', v).plateUnknown, why: (missingInfo().find(m => m.id === v) || {}).why || '', jobs: S.jobs.filter(j => j.vehicleId === v).length }), sunnyV);
ok(sv.plate === 'K 54321' && sv.unk === false && !/plate/.test(sv.why) && /km/.test(sv.why) && sv.jobs >= 1, 'real plate entered → plate no longer missing (km still is), history kept', sv);
await ev(() => editVehicle(null)); await P.waitForTimeout(300);
await set({ customerId: await ev(() => S.customers[0].id), plate: '', make: 'Toyota', model: 'Land Cruiser' }); await save();
ok(/plate not known yet/i.test(await ev(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '))) && await ev(() => !!document.querySelector('.modal-back #f_plate')), 'vehicle form: empty plate without the tick is refused');
await set({ plateUnknown: true }); await save();
ok(await ev(() => /^TEMP-/.test(S.vehicles[S.vehicles.length - 1].plate)), 'vehicle form: “not known yet” gives a TEMP plate');
await ev(() => editCustomer(null)); await P.waitForTimeout(300); await set({ name: 'Honda City 94619 – owner unknown' }); await save();
ok(await ev(() => S.customers.some(c => /owner unknown/.test(c.name) && !c.phone)), 'customer can be saved without a phone');

// ---- 10. On Hold ----
await ev(async () => { const v = S.vehicles.find(x => x.model === 'Sunny'); const j = await save('jobs', { number: await nextNo('job'), date: today(), vehicleId: v.id, customerId: v.customerId, status: 'In Progress', items: [], discount: 0, discountType: 'pct' }); go('#/job/' + j.id); });
await P.waitForTimeout(400);
ok(/On Hold/.test(await view()), 'job status steps include On Hold');
await ev(() => { jobStatus('On Hold'); }); await P.waitForTimeout(500);
const hold = await ev(() => ({ st: ED.doc.status, open: OPEN_JOB.includes('On Hold') }));
ok(hold.st === 'On Hold' && hold.open, 'job set On Hold, still counted as open', hold);
await ev(() => { setFilter('jobs', 'status', 'In workshop'); go('#/jobs'); }); await P.waitForTimeout(400);
ok(/On Hold/i.test(await view()), 'On Hold job listed under In workshop');

// ---- 6. repeat expense: fuel ----
const e1 = await ev(async () => (await save('expenses', { date: addDays(today(), -5), category: 'Fuel', description: 'Fuel – Pathfinder', paidTo: 'ENOC', method: 'Cash', amount: 20, vat: 0 })).id);
await ev(e => editExpense(e), e1); await P.waitForTimeout(300);
ok(/Repeat/.test(await ev(() => document.querySelector('.modal-back:last-child').innerText)), 'expense has a Repeat button');
await P.click('.modal-back:last-child button:has-text("Repeat")'); await P.waitForTimeout(400);
const rp = await ev(() => ({ date: $('#f_date').value, cat: $('#f_category').value, desc: $('#f_description').value, to: $('#f_paidTo').value, amt: $('#f_amount').value, m: $('#f_method').value }));
ok(rp.date === t && rp.cat === 'Fuel' && rp.desc === 'Fuel – Pathfinder' && rp.to === 'ENOC' && rp.amt === '20' && rp.m === 'Cash', 'Repeat opens a new expense with the same details, dated today', rp);
await set({ amount: 25 }); await save();
ok(await ev(() => S.expenses.filter(e => e.description === 'Fuel – Pathfinder').map(e => e.amount).sort().join(',')) === '20,25', 'second fuel expense saved');
await ev(() => go('#/expenses')); await P.waitForTimeout(300);
ok(/Repeat last/i.test(await view()), 'Expenses page has Repeat last');

// ---- cancelling a job with an advance warns ----
const j4 = await ev(async () => { const v = S.vehicles[0]; const j = await save('jobs', { number: await nextNo('job'), date: today(), vehicleId: v.id, customerId: v.customerId, status: 'In Progress', items: [], discount: 0, discountType: 'pct' });
  await save('payments', { number: 'R-ADV', date: today(), amount: 200, method: 'Cash', jobId: j.id, invoiceId: '', advance: true, customerId: v.customerId, vehicleId: v.id }); go('#/job/' + j.id); return j.id; });
await P.waitForTimeout(400); await ev(() => { jobStatus('Cancelled'); }); await P.waitForTimeout(400);
ok(/advance of/i.test(await ev(() => document.querySelector('.modal-back:last-child')?.innerText || '')), 'cancel warns about the advance');
await no();

// ---- phone width ----
await P.setViewportSize({ width: 390, height: 900 });
await ev(j => go('#/job/' + j), j4); await P.waitForTimeout(500);
ok(await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'job card with advance fits a phone');
await ev(() => quickPastJob()); await P.waitForTimeout(400);
ok(await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Quick past job fits a phone');
await P.screenshot({ path: '/tmp/pgt/v39-quick-phone.png' });
await P.click('.modal-back:last-child [data-c]'); await P.waitForTimeout(200);
await ev(() => go('#/dashboard')); await P.waitForTimeout(500);
ok(await ev(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'dashboard with Missing details fits a phone');
await P.screenshot({ path: '/tmp/pgt/v39-dash-phone.png', fullPage: false });
ok(!errs.length, 'no page errors', errs);
await b.close();
