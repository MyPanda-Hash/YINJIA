// 第 21 轮(诊断):按送样人表头勾选框的状态与点击效果
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.reload();
await page.waitForTimeout(4500);
const state = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-sender');
  const heads = [...pane.querySelectorAll('.el-table__header-wrapper .el-checkbox')];
  const rows = [...pane.querySelectorAll('.el-table__body-wrapper .el-table__row .el-checkbox')];
  return {
    headerCount: heads.length,
    headerCls: heads.map((el) => el.className),
    rowChecked: rows.filter((el) => el.className.includes('is-checked')).length,
    rowTotal: rows.length,
    picked: t(document.querySelector('.iss-picked')),
    msgs: [...document.querySelectorAll('.el-message')].map(t),
  };
});
console.log('初始:', JSON.stringify(await state()));
await page.click('loc=css:#pane-sender .el-table__header-wrapper .el-checkbox', { label: '点表头全选' });
await page.waitForTimeout(800);
console.log('第1次点表头:', JSON.stringify(await state()));
await page.click('loc=css:#pane-sender .el-table__header-wrapper .el-checkbox', { label: '再点表头取消' });
await page.waitForTimeout(800);
console.log('第2次点表头:', JSON.stringify(await state()));
// 直接点内部 input(排除 label 命中问题)
await page.evaluate(() => {
  const input = document.querySelector('#pane-sender .el-table__header-wrapper .el-checkbox__original');
  if (input) input.click();
});
await page.waitForTimeout(800);
console.log('直接点 input:', JSON.stringify(await state()));
