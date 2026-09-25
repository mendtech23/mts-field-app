// Opens every page of the app (as each role, desktop + phone) and fails on any script error or "Something went wrong".
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log('  FAIL', m, x ? JSON.stringify(x).slice(0, 300) : ''); } };
for (const [vw, vh, label] of [[1300, 900, 'desktop'], [390, 844, 'phone']]) {
  const P = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage(); const errs = [];
  P.on('pageerror', e => errs.push(e.message)); P.on('console', m => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await P.goto('http://localhost:8099/new/index.html'); await P.waitForTimeout(2200);
  const routes = await P.evaluate(() => {
    const r = Object.keys(PAGES).filter(k => !['job', 'quote', 'invoice', 'customer', 'vehicle', 'po', 'package', 'partner'].includes(k)).map(k => '#/' + k);
    const one = (c, p) => S[c][0] ? [`#/${p}/${S[c][0].id}`] : [];
    return [...r, ...one('jobs', 'job'), ...one('quotes', 'quote'), ...one('invoices', 'invoice'), ...one('customers', 'customer'), ...one('vehicles', 'vehicle'), ...one('purchaseOrders', 'po'), ...one('packages', 'package'), ...one('partners', 'partner'),
      ...['garage', 'docs', 'lists', 'mobile', 'templates', 'staff', 'cloud', 'data'].map(t => 'settings:' + t)];
  });
  for (const role of ['owner', 'manager', 'advisor', 'technician', 'driver']) {
    await P.evaluate(async role => {
      const t = S.technicians[0];
      let s = S.staff.find(x => x.role === role);
      if (!s) s = await save('staff', { name: 'T-' + role, role, active: true, techId: t && t.id, pinHash: await hashPinStrong('482913') });
      if (!S.staff.some(x => x.role === 'owner')) await save('staff', { name: 'Own', role: 'owner', active: true, pinHash: await hashPinStrong('482913') });
      Auth.user = s; sessionStorage.setItem('gp_user', s.id); document.getElementById('lockScreen')?.remove(); document.body.classList.remove('locked-screen');
    }, role);
    for (const r of routes) {
      errs.length = 0;
      await P.evaluate(r => { if (r.startsWith('settings:')) { setFilter('settings', 'tab', r.slice(9)); location.hash = '#/settings'; render(); } else { location.hash = r; } }, r);
      await P.waitForTimeout(r.startsWith('settings:') || /closing|reports|kpi/.test(r) ? 350 : 180);
      const bad = await P.evaluate(() => /Something went wrong/.test(document.getElementById('view').innerText));
      ok(!bad && errs.length === 0, `${label} ${role} ${r}`, errs.slice(0, 2));
    }
  }
  await P.context().close();
}
console.log(`crawl: ${pass} page visits ok, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
