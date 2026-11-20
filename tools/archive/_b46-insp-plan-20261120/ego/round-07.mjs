const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.evaluate(() => {
  const el = document.querySelector('.rs-ref-ctl');
  if (el) el.click();
});
await page.waitForTimeout(2000);
const dlg = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter(d => d.offsetParent !== null);
  return dialogs.map(d => ({ cls: d.className, text: (d.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 800), inputs: [...d.querySelectorAll('input')].map(i => i.placeholder) }));
});
console.log(JSON.stringify(dlg, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r07-refpick.png' });
