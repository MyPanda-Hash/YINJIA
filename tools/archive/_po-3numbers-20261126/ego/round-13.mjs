const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const docNo = 'PI-2026-11-0169';
await page.goto(`http://36.140.66.163:8090/#/panelx/list/PURCHASE_IN?docNo=${docNo}`, { timeout: 60000 });
await page.waitForTimeout(8000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const btns = [...document.querySelectorAll('button, .el-button')].map((b) => txt(b)).filter((t) => t && t.length < 12);
  const tables = [...document.querySelectorAll('table.dp-table')].map((t) => ({
    head: [...t.querySelectorAll('thead th')].map((x) => txt(x)).slice(0, 14),
    rows: [...t.querySelectorAll('tbody tr')].slice(0, 8).map((tr) => [...tr.querySelectorAll('td')].map((x) => txt(x)).slice(0, 14)),
  }));
  return {
    hash: location.hash,
    factory: txt([...document.querySelectorAll('span.factory-name')][0]),
    buttons: [...new Set(btns)].slice(0, 40),
    tables,
    bodyTop: (document.body.innerText || '').slice(0, 300),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 6000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r13-purchase-in.png' });
