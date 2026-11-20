// 第 20 轮:用主表(非 fixed 副本)的选择器重测 全选/取消全选/单选送样人
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
  return { picked: t(document.querySelector('.iss-picked')), exportBtn: t(document.querySelector('.iss-export')) };
});
console.log('初始:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .el-table__header-wrapper .el-checkbox', { label: '按送样人全选' });
await page.waitForTimeout(900);
console.log('全选后:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .el-table__header-wrapper .el-checkbox', { label: '取消全选' });
await page.waitForTimeout(900);
console.log('取消全选后:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .el-table__body-wrapper .el-table__row:nth-child(1) .el-checkbox', { label: '勾系统管理员' });
await page.waitForTimeout(900);
console.log('勾系统管理员:', JSON.stringify(await read()));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-20-sender.png' });
await page.click('loc=css:.iss-export', { label: '导出所选 Excel' });
await page.waitForTimeout(6000);
const msg = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('导出提示:', JSON.stringify(msg));
console.log({ screenshot: shot });
