// round-11: 打开「管理名单」看能否删除(检查 5173 打到的后端是否有 PUT /px/puPrint/buyerContacts)
const task = await taskSpace(3);
const page = task.page('p1');
const btn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.pup-buyer-mgr')][0];
  if (!el) return 'no-btn';
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: (el.textContent || '').trim() };
});
console.log('mgr btn:', JSON.stringify(btn));
if (btn !== 'no-btn') {
  await page.mouse.click(btn.x, btn.y, { label: '点管理名单' });
  await page.waitForTimeout(1200);
}
const st = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('需方联系人名单'));
  if (!dlg) return { open: false, dialogs: [...document.querySelectorAll('.el-dialog__title')].map((t) => t.textContent) };
  return {
    open: true,
    rows: [...dlg.querySelectorAll('.pup-mgr-row')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value)),
    buttons: [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
  };
});
console.log(JSON.stringify(st, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-11-mgr.png' });
