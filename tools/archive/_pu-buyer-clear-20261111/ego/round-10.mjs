// round-10: 悬停 → 点两个下拉的清空(ⓧ) → 读值 → 点「确定并打印」→ 读纸面「需方」框
const task = await taskSpace(3);
const page = task.page('p1');

async function clearSelect(sel) {
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s);
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  }, sel);
  await page.mouse.move(r.x, r.y, { label: '悬停下拉' });
  await page.waitForTimeout(400);
  const cr = await page.evaluate((s) => {
    const c = document.querySelector(s).querySelector('.el-select__clear');
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  }, sel);
  if (!cr) return 'no-clear-icon';
  await page.mouse.click(cr.x, cr.y, { label: '点清空' });
  await page.waitForTimeout(500);
  return 'clicked';
}
const r1 = await clearSelect('.pup-buyer-sel');
console.log('name clear:', r1);
const r2 = await clearSelect('.pup-buyer-tel');
console.log('tel clear:', r2);

const vals = await page.evaluate(() => {
  const txt = (s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const inp = el.querySelector('input');
    return {
      shown: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      inputValue: inp ? inp.value : null,
    };
  };
  return { name: txt('.pup-buyer-sel'), tel: txt('.pup-buyer-tel') };
});
console.log('after clear:', JSON.stringify(vals, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-10-cleared.png', clip: { x: 0, y: 120, width: 900, height: 90 } });
