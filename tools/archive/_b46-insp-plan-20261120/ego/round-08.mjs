const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const inputSel = '.el-dialog:not([style*="display: none"]) input[placeholder="输入关键字过滤…"]';
await page.fill(inputSel, 'B-46');
await page.waitForTimeout(1500);
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter(x => x.offsetParent !== null)[0];
  if (!d) return 'no dialog';
  const body = d.querySelector('.el-dialog__body');
  return { text: (body.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 600), rows: d.querySelectorAll('tbody tr').length };
});
console.log(JSON.stringify(dlg, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r08-filter.png' });
