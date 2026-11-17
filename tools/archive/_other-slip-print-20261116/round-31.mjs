const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};
// 整页重载,清掉 keep-alive 里的旧状态(查询框/展开的明细)
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(6000);
await page.evaluate(`(() => { location.reload(); return 'ok'; })()`).catch(() => {});
await page.waitForTimeout(9000);
await restore();
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-hist');
  if (el) el.scrollIntoView({ block: 'start' });
  const sc = document.querySelector('.app-main, .layout-main, main, .el-main');
  if (sc) sc.scrollTop = sc.scrollHeight;
  return 'ok';
})()`);
await page.waitForTimeout(1200);
await restore();
const st = await page.evaluate(`(() => ({
  docs: [...document.querySelectorAll('.mo-doc')].map((d) => (d.textContent || '').replace(/\\s+/g, ' ').trim()),
  groups: [...document.querySelectorAll('.mo-grp')].map((g) => (g.querySelector('.mo-grp-title')?.textContent || '').trim() + ':' + (g.querySelector('.mo-grp-num')?.textContent || '').trim()),
}))()`);
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-31-ret-history.png" });
console.log('DONE');
