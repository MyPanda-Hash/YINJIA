const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_PROD_INFO', { timeout: 30000 });
await page.reload({ timeout: 30000 });
await page.waitForTimeout(5000);
const st = await page.evaluate(() => ({
  hash: location.hash,
  dialogs: [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null).length,
  sideBtns: [...document.querySelectorAll('.as-side-btn')].map(b => (b.textContent || '').trim()),
}));
console.log(JSON.stringify(st, null, 2));
