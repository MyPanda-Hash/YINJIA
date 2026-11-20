// 第 5 轮:样品检验汇总表勾选(按委托单页签)→ 导出按钮变「导出所选 Excel (1)」→ 截图
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-doc');
  return {
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    docRows: pane ? pane.querySelectorAll('.el-table__body tr').length : -1,
    checked: pane ? pane.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
  };
});
console.log('首屏:', JSON.stringify(await read()));
await page.click('loc=css:#tab-doc', { label: '切到按委托单页签' });
await page.waitForTimeout(1000);
console.log('切页签后:', JSON.stringify(await read()));
await page.click('loc=css:#pane-doc .el-table__body tr:nth-child(1) .el-checkbox', { label: '勾选第1张委托单' });
await page.waitForTimeout(900);
console.log('勾选后:', JSON.stringify(await read()));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-05-insp-picked.png' });
console.log({ screenshot: shot });
