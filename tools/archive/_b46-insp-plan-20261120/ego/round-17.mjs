const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
// 勾选那一行
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  if (!d) return;
  const tr = d.querySelector('tbody tr');
  if (tr) tr.click();
});
await page.waitForTimeout(800);
const btnText = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  if (!d) return 'no dialog';
  const btn = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('确定导入'));
  return btn ? (btn.textContent || '').trim() : 'no btn';
});
console.log('confirmBtn', btnText);
// 确定导入
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  if (!d) return;
  const btn = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('确定导入'));
  if (btn) btn.click();
});
await page.waitForTimeout(6000);
const st = await page.evaluate(() => {
  const head = {};
  for (const td of document.querySelectorAll('td.rs-label')) {
    const lab = (td.textContent || '').trim();
    const next = td.nextElementSibling;
    const inp = next && next.querySelector('input');
    const ref = next && next.querySelector('.rs-ref-ctl');
    if (lab) head[lab] = inp ? inp.value : ref ? (ref.textContent || '').trim() : (next ? (next.textContent || '').trim() : '');
  }
  const msgs = [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim());
  const rows = [...document.querySelectorAll('.rs-data-t tbody tr, table.rs-t tbody tr')].length;
  return { head, msgs, rows };
});
console.log(JSON.stringify(st, null, 1).slice(0, 2500));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r17-picked.png' });
