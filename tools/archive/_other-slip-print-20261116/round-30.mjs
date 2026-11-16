const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(8000);
await restore();
// 滚到历史单据区,把两张单与两个按钮都拍进来
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-hist');
  if (el) el.scrollIntoView({ block: 'center' });
  // 页面内滚动容器可能不是 window,再兜一次
  const sc = document.querySelector('.app-main, .layout-main, main, .el-main');
  if (sc) sc.scrollTop = sc.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
  return 'ok';
})()`);
await page.waitForTimeout(1200);
await restore();
const st = await page.evaluate(`(() => {
  const hist = document.querySelector('.mo-hist');
  const r = hist ? hist.getBoundingClientRect() : null;
  return { top: r ? Math.round(r.top) : null, h: r ? Math.round(r.height) : null,
           docs: [...document.querySelectorAll('.mo-doc')].map((d) => (d.textContent || '').replace(/\\s+/g, ' ').trim()) };
})()`);
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-30-history-view.png" });
console.log('DONE');
