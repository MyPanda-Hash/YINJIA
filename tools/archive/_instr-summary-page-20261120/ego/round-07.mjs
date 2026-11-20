// 第 7 轮:刷新页面(拿到 2 张委托单)→ 只勾第 1 张 → 导出 → 等下载 → 截图
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.reload();
await page.waitForTimeout(5000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
await page.click('loc=css:#tab-doc', { label: '切到按委托单页签' });
await page.waitForTimeout(1000);
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-doc');
  return {
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    rows: pane ? [...pane.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(t).filter(Boolean).join(' | ')) : [],
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
  };
});
console.log('刷新后:', JSON.stringify(await read(), null, 2));
await page.click('loc=css:#pane-doc .el-table__body tr:nth-child(1) .el-checkbox', { label: '只勾第一张委托单' });
await page.waitForTimeout(800);
console.log('勾选后:', JSON.stringify(await read()));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-07-picked-2docs.png' });
await page.click('loc=css:.iss-export', { label: '导出所选 Excel' });
await page.waitForTimeout(4500);
const msg = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('导出提示:', JSON.stringify(msg));
const shot2 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-07-exported.png' });
console.log({ screenshots: [shot, shot2] });
