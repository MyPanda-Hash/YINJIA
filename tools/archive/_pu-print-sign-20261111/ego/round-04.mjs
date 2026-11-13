// round-04:先重新选中单据 → 打开「打印采购订单」→ 需方联系人下拉/新增 → 出纸核对
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) { log("restore: " + e.message); }
await sleep(500);

await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1200);

const before = await page.evaluate(() => ({
  groups: [...document.querySelectorAll(".tb-group .tb-main")].map((e) => (e.textContent || "").trim()),
  rows: document.querySelectorAll(".el-table__body .el-table__row").length,
  docTitle: (document.querySelector(".doc-rail-title, .el-tabs__item.is-active, .yjt-title")?.textContent || "").trim(),
}));
log("before:", JSON.stringify(before));

// 重新选一行(打印后列表会重载,选中态可能丢)
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1800);

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(1000);
const menu = await page.evaluate(() => ({
  menuItems: [...document.querySelectorAll(".tb-menu *")].filter((e) => e.children.length === 0).map((e) => (e.textContent || "").trim()).filter(Boolean),
  dropdownItems: [...document.querySelectorAll(".el-dropdown-menu__item")].map((e) => (e.textContent || "").trim()),
}));
log("menu:", JSON.stringify(menu));

const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item, li")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印采购订单")[0];
  if (!t) return false;
  t.click();
  return true;
});
log("clicked 打印采购订单:", clicked);
const opened = await page.waitForSelector(".pup", { timeout: 25000 }).then(() => true).catch(() => false);
log("dialog opened:", opened);
if (!opened) { await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-04-nodialog.png" }); process.exit(0); }
await sleep(2500);

const ui = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  fmtActive: (document.querySelector(".el-radio-button.is-active")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
  items: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  values: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => (s.querySelector("input")?.value || "")),
  options: [...document.querySelectorAll(".pup-buyer .el-select")].map((s, i) => i),
}));
log("有金额弹窗:", JSON.stringify(ui, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-04-buyer-block.png" });
console.log("done");
