/* mendtech. — other income (v3.5): money that doesn't come from a job — scrap sold, a car sold, used parts,
   commission, rent received… It feeds the P&L, month-end closing, VAT and the cash count.
   `amount` = total received (incl. VAT), `vat` = output VAT in it, `cost` = what the item cost you (optional, e.g. a car
   bought to resell), so profit = amount − vat − cost. */
'use strict';

const incomeNet = i => r2(num(i.amount) - num(i.vat));
const incomeProfit = i => r2(incomeNet(i) - num(i.cost));
/* totals for a date range (inclusive, ISO dates) */
function incomeTotals(from, to) {
  const list = S.incomes.filter(i => i.date && i.date >= from && i.date <= to);
  const t = { list, amount: 0, net: 0, vat: 0, cost: 0, profit: 0, byCat: {} };
  for (const i of list) {
    t.amount += num(i.amount); t.net += incomeNet(i); t.vat += num(i.vat); t.cost += num(i.cost); t.profit += incomeProfit(i);
    t.byCat[i.category || 'Other'] = (t.byCat[i.category || 'Other'] || 0) + incomeProfit(i);
  }
  for (const k of ['amount', 'net', 'vat', 'cost', 'profit']) t[k] = r2(t[k]);
  return t;
}
const incomeFields = () => [
  { k: 'date', label: 'Date', type: 'date', req: true, def: today() },
  { k: 'category', label: 'Type of income', type: 'select', options: S.settings.lists.incomeCategory, req: true },
  { k: 'description', label: 'Description', req: true, span: 2, placeholder: 'e.g. 350 kg scrap metal, old batteries · 2015 Nissan Sunny sold' },
  { k: 'amount', label: 'Amount received (total)', type: 'number', req: true },
  { k: 'vat', label: 'VAT included (output VAT)', type: 'number', help: 'Leave 0 if you did not charge VAT' },
  { k: 'cost', label: 'What it cost you (optional)', type: 'number', help: 'e.g. the price you paid for a car you resold — so profit is right' },
  { k: 'receivedFrom', label: 'Received from' },
  { k: 'method', label: 'Payment method', type: 'select', options: S.settings.lists.paymentMethod },
  { k: 'reference', label: 'Reference / receipt no.' }];
function editIncome(id) {
  const e = get('incomes', id);
  openForm({
    title: e ? 'Edit other income' : 'New other income', fields: incomeFields(), data: e || {},
    onSave: async vals => {
      if ((e && guardClosed(e.date, 'This income')) || guardClosed(vals.date, 'That date')) return false;
      if (num(vals.vat) > num(vals.amount)) throw new Error('VAT cannot be more than the amount');
      await save('incomes', e ? Object.assign(e, vals) : vals); render();
    },
    onDelete: e ? async () => { if (guardClosed(e.date, 'This income')) return false; if (!(await confirmBox('Delete this income?', 'Delete', true))) return false; await remove('incomes', e.id); render(); return true; } : null,
  });
}
PAGES.incomes = () => {
  const m = getFilter('incomes', 'month', monthKey(today()));
  const months = [...new Set([monthKey(today()), ...S.incomes.map(e => monthKey(e.date))])].sort().reverse();
  const list = S.incomes.filter(e => !m || monthKey(e.date) === m).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const t = list.reduce((a, i) => { a.amount += num(i.amount); a.vat += num(i.vat); a.cost += num(i.cost); a.profit += incomeProfit(i); return a; }, { amount: 0, vat: 0, cost: 0, profit: 0 });
  const byCat = {}; list.forEach(i => byCat[i.category || 'Other'] = (byCat[i.category || 'Other'] || 0) + num(i.amount));
  view().innerHTML = pageHead('💰 Other income', 'Money that doesn\'t come from a job: scrap sold, a car sold, used parts, commission, rent received. It counts in the P&L, month-end, VAT and the cash count.', `<button class="btn primary" onclick="editIncome()">＋ Add income</button>`) +
    `<div class="filters"><select class="inp" onchange="setFilter('incomes','month',this.value)"><option value="">All time</option>${months.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${new Date(x + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="grid g6 mb"><div class="kpi"><div class="lbl">Received</div><div class="val">${money(t.amount, false)}</div></div>
      <div class="kpi"><div class="lbl">Profit (after VAT & cost)</div><div class="val ${t.profit < 0 ? 'red' : 'green'}">${money(t.profit, false)}</div></div>
      ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `<div class="kpi"><div class="lbl">${esc(k)}</div><div class="val" style="font-size:19px">${money(v, false)}</div></div>`).join('')}</div>
    <div class="card">${table([{ h: 'Date', v: e => fmtDate(e.date) }, { h: 'Type', v: e => esc(e.category) }, { h: 'Description', v: e => esc(e.description) }, { h: 'From', v: e => esc(e.receivedFrom || '') },
      { h: 'Method', v: e => esc(e.method || '') }, { h: 'VAT', cls: 'num', v: e => num(e.vat) ? money(e.vat, false) : '' }, { h: 'Cost', cls: 'num', v: e => num(e.cost) ? money(e.cost, false) : '' },
      { h: 'Amount', cls: 'num', v: e => `<b>${money(e.amount, false)}</b>` }, { h: 'Profit', cls: 'num', v: e => `<span class="${incomeProfit(e) < 0 ? 'red' : ''}">${money(incomeProfit(e), false)}</span>` }],
      list, { click: e => `editIncome('${e.id}')`, empty: 'No other income recorded for this period.',
        foot: [{ v: 'Total' }, {}, {}, {}, {}, { cls: 'num', v: money(t.vat, false) }, { cls: 'num', v: money(t.cost, false) }, { cls: 'num', v: money(t.amount, false) }, { cls: 'num', v: money(t.profit, false) }] })}</div>`;
};
