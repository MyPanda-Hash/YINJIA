// 第 22 轮:勾送样人 → 展开回显 → 子表取消一张 → 送样人行取消 + 单据页签同步
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.reload();
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-sender');
  const docPane = document.getElementById('pane-doc');
  const senderRow = pane.querySelector('.el-table__body-wrapper .el-table__row');
  const subRows = [...pane.querySelectorAll('.iss-subtable .el-table__body tr.el-table__row')];
  return {
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    senderRowChecked: !!senderRow?.querySelector('.el-checkbox.is-checked'),
    subChecked: subRows.filter((tr) => tr.querySelector('.el-checkbox.is-checked')).length,
    subTotal: subRows.length,
    docChecked: docPane.querySelectorAll('.el-table__body-wrapper .el-table__row .el-checkbox.is-checked').length,
  };
});
await page.click('loc=css:#pane-sender .el-table__body-wrapper .el-table__row:nth-child(1) .el-checkbox', { label: '勾系统管理员' });
await page.waitForTimeout(800);
console.log('勾送样人:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .el-table__body-wrapper .el-table__row:nth-child(1) .el-table__expand-icon', { label: '展开' });
await page.waitForTimeout(1500);
console.log('展开后:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .iss-subtable .el-table__row:nth-of-type(1) .el-checkbox', { label: '子表取消第一张' });
await page.waitForTimeout(1000);
console.log('子表取消一张:', JSON.stringify(await read()));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-22-sender-partial.png' });
await page.click('loc=css:#tab-doc', { label: '切到按委托单' });
await page.waitForTimeout(1000);
console.log('按委托单页签:', JSON.stringify(await read()));
console.log({ screenshot: shot });
