// round-08: 用 querySelectorAll('*') 找「打印」按钮 → 点开下拉 → 列出菜单项
const task = await taskSpace(3);
const page = task.page('p1');
const found = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('*')].filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '打印');
  return hits.map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 90), parent: e.parentElement ? e.parentElement.outerHTML.slice(0, 220) : '' }));
});
console.log(JSON.stringify(found.slice(0, 4), null, 2));

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '打印').pop();
  if (!el) return 'no-el';
  const btn = el.closest('button, .px-btn, [class*=btn]') || el;
  btn.click();
  return String(btn.className).slice(0, 120);
});
console.log('clicked:', clicked);
await page.waitForTimeout(1500);
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popper li, .el-dropdown-menu li')].map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('dropdown items:', JSON.stringify(items, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-08-menu.png' });
