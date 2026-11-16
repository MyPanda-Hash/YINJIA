const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};
for (const [path, name] of [['MOBILE_OTHER_PICK', '其他领料'], ['MOBILE_OTHER_RET', '其他退料']]) {
  await page.goto(`http://127.0.0.1:8090/#/panelx/list/${path}`, { timeout: 40000 });
  await page.waitForTimeout(6000);
  await restore();
  const st = await page.evaluate(`(() => ({
    hash: location.hash,
    title: document.title,
    body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
    hasScan: !!document.querySelector('.mo-scanbar input'),
  }))()`);
  console.log('8090 ' + name + ' ' + JSON.stringify(st, null, 2));
}
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-24-8090-other-ret.png" });
console.log('DONE');
