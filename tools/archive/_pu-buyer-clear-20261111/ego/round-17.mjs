// round-17: 版面复验(加了 tip 折行样式)：重新选中联系人 → 看这一排是否仍一行 / 清空按钮位置
const task = await taskSpace(3);
const page = task.page('p1');
await page.waitForTimeout(2000);
const geo = await page.evaluate(() => {
  const row = document.querySelector('.pup-buyer');
  if (!row) return { row: null };
  const r = row.getBoundingClientRect();
  return {
    rowRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    children: [...row.children].map((c) => {
      const b = c.getBoundingClientRect();
      return { cls: String(c.className), text: (c.textContent || '').replace(/\s+/g, ' ').trim(), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }),
  };
});
console.log(JSON.stringify(geo, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-17-row.png', clip: { x: 0, y: 150, width: 1520, height: 140 } });
