// round-08:生产退料页 —— 选中一张单后光标是否落到物料扫码框(该页扫码框 v-if="cur")
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/panelx/list/MOBILE_RETURN', { timeout: 30000 });
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }

const before = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const btns = [...document.querySelectorAll('button')].filter((b) => txt(b).includes('选这张退料'));
  return { 可退单据数: btns.length, 扫码框数: document.querySelectorAll('input[placeholder*="物料码"]').length };
});
console.log(JSON.stringify(before, null, 2));

if (before.可退单据数 > 0) {
  await page.evaluate(() => {
    const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const b = [...document.querySelectorAll('button')].find((x) => txt(x).includes('选这张退料'));
    b.click();
  });
  await page.waitForTimeout(1800);
  const after = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName?.toLowerCase() || '',
      placeholder: el?.getAttribute?.('placeholder') || '',
      扫码框数: document.querySelectorAll('input[placeholder*="物料码"]').length,
    };
  });
  console.log(JSON.stringify({ 选中后焦点: after }, null, 2));
} else {
  console.log('（测试库里没有可退单据;该页扫码框只在选中单据后出现,聚焦由 select() 负责)');
}
await page.screenshot({ path: shot + '/round-08-return-focus.png' });
console.log('screenshot -> round-08-return-focus.png');
