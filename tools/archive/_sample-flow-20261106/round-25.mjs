const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(7000);
const dump = () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-info-row .as-docno-input input') || {}).value || '',
  trs: [...document.querySelectorAll('.sg-table tbody tr')].map((tr) => ({ cls: tr.className, tds: tr.querySelectorAll('td').length, ths: tr.querySelectorAll('th').length })),
  addrow: !!document.querySelector('.sg-addrow'),
  sideBtns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()).slice(0, 8),
}));
console.log('初始:', JSON.stringify(await dump()));
await p.evaluate(() => document.querySelector('.sg-addrow')?.click());
await p.waitForTimeout(800);
console.log('点+后:', JSON.stringify(await dump()));
await task.finish({ keep: [] });
process.exit(0);
