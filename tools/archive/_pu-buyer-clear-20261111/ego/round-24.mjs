// round-24: 8090 最终取证截图 —— ①有默认值(清空按钮可点) ②清空后(placeholder + 按钮置灰)
const task = await taskSpace(3);
const page = task.page('p1');
const state = await page.evaluate(() => ({ open: !!document.querySelector('.pup'), hash: location.hash }));
console.log('state:', JSON.stringify(state));

if (!state.open) {
  await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '打印');
    if (el) el.click();
  });
  await page.waitForTimeout(5000);
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

// ① 有默认值
await page.mouse.move(600, 300);
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-24-8090-default.png' });

// ② 点「清空」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.pup-buyer button')].find((x) => (x.textContent || '').trim() === '清空');
  if (b) b.click();
});
await page.waitForTimeout(800);
const after = await page.evaluate(() => ({
  name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  clearDisabled: (() => {
    const b = [...document.querySelectorAll('.pup-buyer button')].find((x) => (x.textContent || '').trim() === '清空');
    return b ? b.disabled : null;
  })(),
}));
console.log('after clear:', JSON.stringify(after));
await page.mouse.move(600, 300);
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-24-8090-cleared.png' });
