const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_PICK", { timeout: 40000 });
await page.waitForTimeout(7000);
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) {}
const st = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 900),
  mentions: {
    材料出库单: (document.body.innerText || "").includes("材料出库单"),
    生产退料单: (document.body.innerText || "").includes("生产退料单"),
    其他入库单: (document.body.innerText || "").includes("其他入库单"),
  },
  rows: document.querySelectorAll(".el-table__body tr").length,
}));
console.log("MOBILE_PICK " + JSON.stringify(st, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-14-mobile-pick.png" });
console.log("DONE");
