// round-30: 中文界面最终版面(按钮改名「清空联系人」后是否仍单行)
const task = await taskSpace(3);
const page = task.page('p1');
await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '打印');
  if (el) el.click();
});
await page.waitForTimeout(5000);
const geo = await page.evaluate(() => {
  const row = document.querySelector('.pup-buyer');
  if (!row) return { row: null };
  const r = row.getBoundingClientRect();
  return {
    rowRect: { y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    children: [...row.children].map((c) => {
      const b = c.getBoundingClientRect();
      return { cls: String(c.className).split(' ').slice(-1)[0], text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) };
    }),
  };
});
console.log(JSON.stringify(geo, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-30-8090-zh-row.png', clip: { x: 0, y: 150, width: 1520, height: 140 } });
