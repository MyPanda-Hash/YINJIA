// round-04: 双击指定行 PO-2026-11-0012 打开单据 → 找打印按钮组
const task = await taskSpace(3);
const page = task.page('p1');
await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '双击打开采购订单' });
await page.waitForTimeout(4500);
const st = await page.evaluate(() => ({
  hash: location.hash,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 90),
}));
console.log(JSON.stringify(st, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-04-form.png' });
