// 第 2 轮:勾选前两行 → 导出按钮变「导出所选 Excel (2)」→ 真的点导出 → 截图
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}

const txt = async () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    picked: t(document.querySelector('.isu-picked')),
    exportBtn: t(document.querySelector('.isu-export')),
    checked: document.querySelectorAll('.isu-table .el-table__body .el-checkbox.is-checked').length,
    headScroll: (() => {
      const wrap = document.querySelector('.isu-table .el-table__body-wrapper .el-scrollbar__wrap');
      return wrap ? { scrollW: wrap.scrollWidth, clientW: wrap.clientWidth } : null;
    })(),
  };
});
console.log('导出前:', JSON.stringify(await txt()));

await page.click('loc=css:.isu-table .el-table__body tr:nth-child(1) .el-checkbox', { label: '勾选第1行' });
await page.waitForTimeout(400);
await page.click('loc=css:.isu-table .el-table__body tr:nth-child(2) .el-checkbox', { label: '勾选第2行' });
await page.waitForTimeout(600);
console.log('勾选后:', JSON.stringify(await txt()));
const shot1 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-02-picked.png' });

await page.click('loc=css:.isu-export', { label: '导出所选 Excel' });
await page.waitForTimeout(3500);
const msg = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return { messages: [...document.querySelectorAll('.el-message')].map(t) };
});
console.log('导出后:', JSON.stringify(msg));
const shot2 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-02-exported.png' });
console.log({ screenshots: [shot1, shot2] });
