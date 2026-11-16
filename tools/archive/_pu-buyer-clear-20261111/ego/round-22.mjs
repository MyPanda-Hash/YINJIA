// round-22: 8090(打包版)复验——先确认登录工厂,再走 有金额打印弹窗 → 清空 → 纸面留空
const task = await taskSpace(3);
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 40000 });
await page.waitForTimeout(5000);
const head = await page.evaluate(() => ({
  hash: location.hash,
  login: !!document.querySelector('input[placeholder*="账号"]'),
  factory: [...document.querySelectorAll('.el-tag, .login-factory, .lf-current, header *')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /测试库|YINJIA-MES/.test(t)).slice(0, 5),
  bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
}));
console.log(JSON.stringify(head, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-22-8090-state.png' });
