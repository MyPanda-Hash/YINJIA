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

// 一级:点开 WMS管理 → 二级:悬停/点开 库存核算 → fly-card 里的叶子
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".nav-group")].find((n) => (n.textContent || "").includes("WMS管理"));
  if (g) g.click();
});
await page.waitForTimeout(1200);
const mods = await page.evaluate(() => [...document.querySelectorAll(".nav-module")].map((n) => (n.textContent || "").trim()));
console.log("MODULES " + JSON.stringify(mods));

await page.evaluate(() => {
  const m = [...document.querySelectorAll(".nav-module")].find((n) => (n.textContent || "").includes("库存核算"));
  if (m) { m.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); m.click(); }
});
await page.waitForTimeout(2000);
await restore();

const card = await page.evaluate(() => {
  const groups = [...document.querySelectorAll(".fly-card .card-group")].map((g) => ({
    title: (g.querySelector(".card-group-title")?.textContent || "").trim(),
    items: [...g.querySelectorAll(".card-item")].map((i) => (i.textContent || "").trim()),
  }));
  const g0 = groups[0] || { items: [] };
  const iPick = g0.items.indexOf("生产领料明细表");
  const iRet = g0.items.indexOf("生产退料明细表");
  return { groups: groups.map((g) => ({ title: g.title, n: g.items.length })),
           invAcct: g0.items,
           idxPick: iPick, idxRet: iRet,
           neighbours: g0.items.slice(Math.max(0, iPick - 3), iPick + 4) };
});
console.log("CARD " + JSON.stringify(card, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-10-flycard.png" });
console.log("DONE");
