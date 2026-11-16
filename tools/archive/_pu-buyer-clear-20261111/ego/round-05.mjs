// round-05: 点工具栏「打印」→ 列出下拉两项 → 点「打印采购订单」(有金额) → 摸 DOM
const task = await taskSpace(3);
const page = task.page('p1');
const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map((b, i) => ({ i, t: (b.textContent || '').replace(/\s+/g, ' ').trim() })).filter((x) => x.t));
console.log(JSON.stringify(btns.filter((x) => /打印/.test(x.t)), null, 2));
await page.click('button:has-text("打印")', { label: '点打印按钮' });
await page.waitForTimeout(1200);
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-popper li')].map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('dropdown items:', JSON.stringify(items, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-05-printmenu.png' });
