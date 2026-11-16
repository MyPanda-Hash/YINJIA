// round-28: 英文界面复验按钮文案(应为 Clear contact,不是 Cleared)
const task = await taskSpace(3);
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 });
await page.waitForTimeout(5000);
const state = await page.evaluate(() => ({ hash: location.hash, bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80) }));
console.log('state:', JSON.stringify(state));

await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => /Print/i.test((e.textContent || '').trim()));
  if (el) el.click();
});
await page.waitForTimeout(5000);
const en = await page.evaluate(() => ({
  open: !!document.querySelector('.pup'),
  row: (document.querySelector('.pup-buyer')?.innerText || '').replace(/\s+/g, ' ').trim(),
  buttons: [...document.querySelectorAll('.pup-buyer button')].map((b) => (b.textContent || '').trim()),
}));
console.log('EN row:', JSON.stringify(en, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-28-en-clearcontact.png' });
