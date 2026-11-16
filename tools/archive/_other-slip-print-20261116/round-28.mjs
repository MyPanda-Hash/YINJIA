const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(7000);
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) {}
const st = await page.evaluate(`(() => ({
  title: document.title,
  hasReprint: !!document.querySelector('.mo-reprint'),
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 320),
}))()`);
console.log('8090 ' + JSON.stringify(st, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-28-8090-reprint.png" });
console.log('DONE');
