// round-16: 全宽截图看「需方联系人」这一排的版面(清空按钮 + 提示是否折行难看)
const task = await taskSpace(3);
const page = task.page('p1');
const geo = await page.evaluate(() => {
  const row = document.querySelector('.pup-buyer');
  const r = row.getBoundingClientRect();
  return {
    rowRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    children: [...row.children].map((c) => {
      const b = c.getBoundingClientRect();
      return { cls: String(c.className), text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
    }),
  };
});
console.log(JSON.stringify(geo, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-16-row-full.png', clip: { x: 0, y: 150, width: 1520, height: 130 } });
