const task = await taskSpace('instr-summary-1119');
const page = task.page('p1');
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.rsp-page-tab')].find((x) => (x.textContent || '').includes('使用记录汇总'));
  if (tab) tab.click();
});
await page.waitForTimeout(3500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const info = await page.evaluate(() => {
  const table = document.querySelector('.rsp-ledger table');
  const rows = table ? [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())) : [];
  return {
    chips: [...document.querySelectorAll('.rsp-page-tab')].map((x) => ({ text: (x.textContent || '').trim(), active: x.classList.contains('active') })),
    ledgerTitle: document.querySelector('.rsp-ledger .rsp-page-title')?.textContent?.trim() || '',
    rows,
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1119/round-02-summary.png' });
console.log({ screenshot: shot });
