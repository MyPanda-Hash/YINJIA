const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '新增');
  if (b) b.click();
});
await page.waitForTimeout(5000);
const st = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  headProduct: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl'); return ref ? (ref.textContent || '').trim() : null; })(),
  rows: [...document.querySelectorAll('table.rs-dt tbody tr')].filter(tr => tr.querySelectorAll('td.rs-td').length >= 6).length,
}));
console.log('newDoc', JSON.stringify(st));
await import('file:///D:/workspace/yinjia/_scratch/b46/ego/fill_current.mjs');
