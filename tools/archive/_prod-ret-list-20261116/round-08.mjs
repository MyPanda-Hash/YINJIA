const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(500);
  } catch (e) { console.log("restore skip: " + e.message); }
};

// 1) 生产退料明细表(新面板)
await page.goto("http://localhost:5173/#/panelx/list/PROD_RET_LIST", { timeout: 30000 });
await page.waitForTimeout(6000);
await restore();

const ret = await page.evaluate(() => {
  const headers = [...document.querySelectorAll(".el-table__header th .cell")].map((n) => (n.textContent || "").trim()).filter(Boolean);
  const rows = [...document.querySelectorAll(".el-table__body tr")].slice(0, 6).map((tr) =>
    [...tr.querySelectorAll("td .cell")].map((c) => (c.textContent || "").trim()));
  const tab = [...document.querySelectorAll(".el-tabs__item, .tabs-bar .tab, .tag")].map((n) => (n.textContent || "").trim()).filter(Boolean).slice(0, 6);
  return { url: location.href, hash: location.hash, title: document.title, headers, rowCount: document.querySelectorAll(".el-table__body tr").length, rows, tab,
    total: (document.querySelector(".el-pagination__total")?.textContent || "").trim(),
    bodyHead: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300) };
});
console.log("PROD_RET_LIST " + JSON.stringify(ret, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-08-ret-list.png" });

// 2) 生产领料明细表(改名后的老面板)
await page.goto("http://localhost:5173/#/panelx/list/PROD_PICK_LIST", { timeout: 30000 });
await page.waitForTimeout(6000);
await restore();
const pick = await page.evaluate(() => ({
  url: location.href,
  headers: [...document.querySelectorAll(".el-table__header th .cell")].map((n) => (n.textContent || "").trim()).filter(Boolean),
  total: (document.querySelector(".el-pagination__total")?.textContent || "").trim(),
  rowCount: document.querySelectorAll(".el-table__body tr").length,
  bodyHead: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 260),
}));
console.log("PROD_PICK_LIST " + JSON.stringify(pick, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-08-pick-list.png" });

// 3) 左导航里两张表的位置
const nav = await page.evaluate(() => {
  const texts = [...document.querySelectorAll("aside a, aside .el-menu-item, aside span, .left-nav span, .left-nav a")]
    .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim()).filter((t) => t && t.length < 20);
  const idx = (k) => texts.indexOf(k);
  return { hasPickList: texts.includes("生产领料明细表"), hasRetList: texts.includes("生产退料明细表"),
           order: texts.filter((t) => t.startsWith("生产领料") || t.startsWith("生产退料") || t === "材料出库单"),
           idxPick: idx("生产领料明细表"), idxRet: idx("生产退料明细表") };
});
console.log("NAV " + JSON.stringify(nav, null, 2));
console.log("DONE");
