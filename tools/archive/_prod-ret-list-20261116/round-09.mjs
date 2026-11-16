const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

await page.goto("http://localhost:5173/#/panelx/list/PROD_RET_LIST", { timeout: 30000 });
await page.waitForTimeout(5000);
await restore();

// 展开 WMS管理 → 库存核算,取出叶子顺序
const step1 = await page.evaluate(() => {
  const byText = (sel, t) => [...document.querySelectorAll(sel)].find((n) => (n.textContent || "").trim() === t);
  const wms = byText("aside span, aside div, .el-sub-menu__title", "WMS管理");
  return { wmsFound: !!wms, wmsTag: wms ? wms.tagName + "." + wms.className : "" };
});
console.log("STEP1 " + JSON.stringify(step1));

await page.click("text=WMS管理", { label: "expand WMS", timeout: 15000 }).catch((e) => console.log("wms click: " + e.message));
await page.waitForTimeout(1500);
await page.click("text=库存核算", { label: "expand 库存核算", timeout: 15000 }).catch((e) => console.log("acct click: " + e.message));
await page.waitForTimeout(2500);
await restore();

const leaves = await page.evaluate(() => {
  const all = [...document.querySelectorAll("aside a, aside .el-menu-item, aside li, .left-nav a, .left-nav li")]
    .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim());
  const uniq = [...new Set(all)].filter((t) => t && t.length <= 12);
  const keep = ["材料出库单", "生产退料单", "生产领料明细表", "生产退料明细表", "其他出库单"];
  return { seq: uniq.filter((t) => keep.includes(t)),
           idx: keep.map((k) => [k, uniq.indexOf(k)]) };
});
console.log("LEAVES " + JSON.stringify(leaves, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-09-nav-wms.png" });
console.log("DONE-NAV");
