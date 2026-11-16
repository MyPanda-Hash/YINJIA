// round-07:手机扫码各页 —— 进页面光标是否在扫码框 + 扫完(回车)后是否回到扫码框
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

const routes = [
  ['生产领料(定位)', 'panelx/list/MOBILE_PICK'],
  ['生成工单领料/退料单', 'panelx/list/MOBILE_PICK_CREATE'],
  ['其他领料', 'panelx/list/MOBILE_OTHER_PICK'],
  ['其他退料', 'panelx/list/MOBILE_OTHER_RET'],
  ['扫码混料', 'panelx/list/MOBILE_MIX_SCAN'],
  ['工序报工', 'panelx/list/MOBILE_REPORT'],
  ['生产退料', 'panelx/list/MOBILE_RETURN'],
];

const readActive = () => page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return { tag: '(none)', placeholder: '', value: '' };
  return {
    tag: el.tagName.toLowerCase(),
    placeholder: el.getAttribute('placeholder') || '',
    value: String(el.value || '').slice(0, 24),
  };
});

const rows = [];
for (const [label, route] of routes) {
  await page.goto('http://127.0.0.1:8091/#' + route, { timeout: 30000 });
  await page.waitForTimeout(4000);
  const onEnter = await readActive();

  // 模拟 PDA:直接往当前焦点打字 + 回车(不点输入框)
  await page.keyboard.type('ZZ-NO-SUCH-CODE');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2200);
  const afterScan = await readActive();

  rows.push({
    页面: label,
    route,
    进入时焦点: onEnter.tag + ' | ' + onEnter.placeholder,
    回车后焦点: afterScan.tag + ' | ' + afterScan.placeholder,
    回车后残留值: afterScan.value,
  });
}
console.log(JSON.stringify(rows, null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.goto('http://127.0.0.1:8091/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 30000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: shot + '/round-07-scan-focus.png' });
console.log('screenshot -> round-07-scan-focus.png');
