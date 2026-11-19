const task = await taskSpace('instr-summary-1119');
const page = task.page('p1');
await page.cdp('Page.reload', { ignoreCache: true });
await page.waitForTimeout(2500);
await page.goto('http://127.0.0.1:8090/#/panelx/list/RD_INSTR_USE', { timeout: 30000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.rsp-page-tab')].find((x) => (x.textContent || '').includes('使用记录汇总'));
  if (tab) tab.click();
});
await page.waitForTimeout(3000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const info = await page.evaluate(() => {
  const wrap = document.querySelector('.rsp-ledger');
  const table = document.querySelector('.rsp-ledger table');
  const rows = table ? [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())) : [];
  return {
    tableWidth: Math.round(table?.getBoundingClientRect().width || 0),
    scrollW: wrap?.scrollWidth || 0, clientW: wrap?.clientWidth || 0,
    rows,
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1119/round-04-summary-fit.png' });
console.log({ screenshot: shot });
