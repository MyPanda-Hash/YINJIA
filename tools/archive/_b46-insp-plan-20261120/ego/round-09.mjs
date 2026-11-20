const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_PROD_INFO', { timeout: 30000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim() === '新增');
  const el = hits[0];
  if (el) (el.closest('button, .el-button, [class*="op"], li, div') || el).click();
  return hits.length;
});
console.log('newBtnHits', r);
await page.waitForTimeout(3500);
const info = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\n{2,}/g, '\n').slice(1800, 4200),
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r09-prodnew.png' });
