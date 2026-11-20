const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
// 1) 点开「产品编号」参照
await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td.rs-label')];
  const td = tds.find(t => (t.textContent || '').trim() === '产品编号');
  const cell = td && td.nextElementSibling;
  const ref = cell && cell.querySelector('.rs-ref-ctl');
  if (ref) ref.click();
});
await page.waitForTimeout(2500);
// 2) 关键字过滤
const kw = '.el-dialog:not([style*="display: none"]) input[placeholder="输入关键字过滤…"]';
await page.fill(kw, 'B-46-10-1');
await page.press(kw, 'Enter');
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  if (!d) return 'no dialog';
  const trs = [...d.querySelectorAll('tbody tr')];
  return {
    count: trs.length,
    first: trs.slice(0, 3).map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText || '').trim()).join(' | ').slice(0, 200)),
  };
});
console.log(JSON.stringify(rows, null, 1));
