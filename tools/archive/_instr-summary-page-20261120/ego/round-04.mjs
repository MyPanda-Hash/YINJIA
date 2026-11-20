// 第 4 轮:样品检验汇总表 —— 勾选一张检验委托单 → 导出按钮变「导出所选 Excel (1)」
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}

await page.click('loc=css:#pane-doc', { label: '切到按委托单页签' }).catch(() => {});
await page.waitForTimeout(1200);
const before = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    hash: location.hash,
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    docRows: document.querySelectorAll('#pane-doc .iss-table .el-table__body tr').length,
    headers: [...document.querySelectorAll('#pane-doc .el-table__header th')].map(t),
  };
});
console.log('勾选前:', JSON.stringify(before, null, 2));

await page.click('loc=css:#pane-doc .iss-table .el-table__body tr:nth-child(1) .el-checkbox', { label: '勾选第1张委托单' });
await page.waitForTimeout(800);
const after = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    checked: document.querySelectorAll('#pane-doc .iss-table .el-table__body .el-checkbox.is-checked').length,
  };
});
console.log('勾选后:', JSON.stringify(after));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-04-insp-picked.png' });
console.log({ screenshot: shot });
