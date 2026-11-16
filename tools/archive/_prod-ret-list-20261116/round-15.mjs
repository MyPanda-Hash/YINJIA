const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
// 先切回中文,文案才可读
await page.evaluate(() => {
  const el = [...document.querySelectorAll("header *, [class*=lang]")].filter((n) => (n.textContent || "").trim() === "EN" && n.children.length === 0)[0];
  if (el) (el.closest("div,button,span") || el).click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const it = [...document.querySelectorAll(".el-dropdown-menu__item, li")].find((n) => /简体中文/.test(n.textContent || ""));
  if (it) it.click();
});
await page.waitForTimeout(3000);
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) {}

// 打开第一张单据
await page.click("text=打开单据", { label: "open slip", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(6000);
const st = await page.evaluate(() => {
  const t = (document.body.innerText || "").replace(/\s+/g, " ");
  return {
    hash: location.hash,
    text: t.slice(0, 1200),
    mentions: {
      材料出库单: t.includes("材料出库单"),
      生产退料单: t.includes("生产退料单"),
    },
    sentences: (t.match(/[^。;]{0,30}(材料出库单|生产退料单)[^。;]{0,40}/g) || []).slice(0, 8),
  };
});
console.log("MOBILE_DOC " + JSON.stringify(st, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-15-mobile-doc.png" });
console.log("DONE");
