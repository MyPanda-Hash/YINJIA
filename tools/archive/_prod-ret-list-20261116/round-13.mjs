const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/PROD_RET_LIST", { timeout: 40000 });
await page.waitForTimeout(5000);
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) {}

// 确保 WMS管理 处于展开态(已展开就不再点,避免点成折叠)
const opened = await page.evaluate(() => {
  const has = [...document.querySelectorAll(".nav-module")].some((n) => (n.textContent || "").includes("库存核算"));
  if (!has) {
    const g = [...document.querySelectorAll(".nav-group")].find((n) => (n.textContent || "").includes("WMS管理"));
    if (g) g.click();
  }
  return has;
});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const m = [...document.querySelectorAll(".nav-module")].find((n) => (n.textContent || "").includes("库存核算"));
  if (m) m.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
});
await page.waitForTimeout(1800);
const nav = await page.evaluate(() => {
  const g = document.querySelector(".fly-card .card-group");
  return g ? [...g.querySelectorAll(".card-item")].map((i) => (i.textContent || "").trim()) : [];
});
console.log("wasOpen=" + opened + " 8090_NAV " + JSON.stringify(nav, null, 1));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-13-8090-nav.png" });
console.log("DONE");
