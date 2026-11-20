// 第 3 轮:仪器使用记录表(RD_INSTR_USE)确认「使用记录汇总」页签已撤除(单页登记表)
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_INSTR_USE', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}

const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    hash: location.hash,
    pageTabs: [...document.querySelectorAll('.rsp-page-tab')].map(t),
    ledgerBlocks: document.querySelectorAll('.rsp-ledger').length,
    tableTitles: [...document.querySelectorAll('.rsp-page-title')].map(t),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-03-record-sheet.png' });
console.log({ screenshot: shot });
