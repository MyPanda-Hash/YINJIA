const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) {}
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()));
  const body = (document.body.innerText || '').replace(/\s+/g, ' ');
  const inputs = [...document.querySelectorAll('.ic-meta-no-input input, .ic-meta-no-input .el-input__inner')].map((i) => ({tag:i.tagName, value:i.value, ph:i.placeholder, cls:i.className}));
  const noVal = document.querySelector('.ic-meta-no-val')?.textContent?.trim();
  const total = document.querySelector('.ic-items-total-val')?.textContent?.trim();
  const qty = [...document.querySelectorAll('.ic-grid input')].map((i)=>({v:i.value, ph:i.placeholder}));
  return { hash: location.hash, rowCount: rows.length, rows: rows.slice(0,5), bodyHas: body.slice(0, 400), inputs, noVal, total, qty: qty.slice(0,20), title: document.title };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-sample-insp-1119/round-02-commission.png' });
console.log({ screenshot: shot });
