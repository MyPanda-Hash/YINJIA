const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(6000);
await restore();

// 只在没展开时才点(点两次会折叠)
const opened = await page.evaluate(`(() => {
  const has = [...document.querySelectorAll('.nav-module')].some((n) => (n.textContent || '').includes('生产扫码登记'));
  if (!has) {
    const g = [...document.querySelectorAll('.nav-group')].find((n) => (n.textContent || '').includes('手机扫码'));
    if (g) g.click();
  }
  return has;
})()`);
await page.waitForTimeout(1500);
await page.evaluate(`(() => {
  const m = [...document.querySelectorAll('.nav-module')].find((n) => (n.textContent || '').includes('生产扫码登记'));
  if (m) m.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(1800);
await restore();
const leaves = await page.evaluate(`(() => {
  const g = document.querySelector('.fly-card .card-group');
  return g ? [...g.querySelectorAll('.card-item')].map((i) => (i.textContent || '').trim()) : [];
})()`);
console.log('wasOpen=' + opened + ' LEAVES ' + JSON.stringify(leaves, null, 1));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-23-nav-mobile.png" });
console.log('DONE');
