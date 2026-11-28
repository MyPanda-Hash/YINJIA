// round-01: 打开 5173,处理登录,进入 采购入库单 深链,输出快照
const task = await taskSpace("purchase-in-untransferred-shots-20261128");
const page = task.page("p1");
await page.goto("http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0147", { timeout: 40000 });
await page.waitForTimeout(5000);

const state = await page.evaluate(() => {
  const txt = (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400);
  return {
    hash: location.hash,
    hasLogin: !!(document.querySelector('input[placeholder*="账号"]') || (document.body.innerText || "").includes("进入系统")),
    text: txt,
  };
});
console.log(JSON.stringify(state, null, 2));

try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
  await page.waitForTimeout(300);
} catch (e) { console.log("restore skip: " + e.message); }

console.log(await page.snapshot());
