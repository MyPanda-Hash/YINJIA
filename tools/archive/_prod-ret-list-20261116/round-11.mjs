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

// 切英文:点顶栏语言(当前显示「中」)
const clicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll("header *, .topbar *, [class*=lang], [class*=locale]")]
    .filter((n) => (n.textContent || "").trim() === "中" && n.children.length === 0);
  const el = cands[0];
  if (el) { (el.closest("div,button,span") || el).click(); return true; }
  return false;
});
console.log("LANG_CLICK " + clicked);
await page.waitForTimeout(1200);

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll(".el-dropdown-menu__item, li, .el-select-dropdown__item")]
    .filter((n) => /English/i.test(n.textContent || ""));
  if (items[0]) { items[0].click(); return true; }
  return false;
});
console.log("PICK_EN " + picked);
await page.waitForTimeout(3500);
await restore();

const en = await page.evaluate(() => ({
  lang: localStorage.getItem("yj_locale") || localStorage.getItem("locale") || "",
  headers: [...document.querySelectorAll(".el-table__header th .cell")].map((n) => (n.textContent || "").trim()).filter(Boolean),
  tabs: [...document.querySelectorAll(".tabs-bar *, .el-tabs__item")].map((n) => (n.textContent || "").trim()).filter((t) => t && t.length < 40).slice(0, 8),
  pageHeader: (document.querySelector(".el-pagination__total")?.textContent || "").trim(),
  bodyHead: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 500),
}));
console.log("EN " + JSON.stringify(en, null, 2));

// 英文态下左导航叶子
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".nav-group")].find((n) => /WMS|Warehouse/i.test(n.textContent || ""));
  if (g) g.click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const m = [...document.querySelectorAll(".nav-module")].find((n) => /Inventory accounting|Inventory/i.test(n.textContent || ""));
  if (m) { m.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); m.click(); }
});
await page.waitForTimeout(1800);
await restore();
const navEn = await page.evaluate(() => {
  const g = document.querySelector(".fly-card .card-group");
  const items = g ? [...g.querySelectorAll(".card-item")].map((i) => (i.textContent || "").trim()) : [];
  return { items, pick: items.filter((t) => /Pick|Return/i.test(t)) };
});
console.log("NAV_EN " + JSON.stringify(navEn, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-11-en.png" });
console.log("DONE");
