const task = await taskSpace(51);
const page = task.page("p1");
// 点「采购入库单 PI-2026-11-0021」那条(第 2 行)
const idx = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  const rows = [...pop.querySelectorAll(".nc-item")];
  const i = rows.findIndex((el) => (el.innerText || "").includes("采购入库单"));
  if (i >= 0) rows[i].click();
  return i;
});
console.log({ clickedRow: idx });
await page.waitForTimeout(1500);
const dlg = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.innerText || "").trim(),
  body: (document.querySelector(".nc-detail")?.innerText || "").replace(/\s+/g, " ").trim(),
  footer: [...document.querySelectorAll(".el-dialog__footer button")].map((b) => b.innerText.trim()),
}));
console.log(JSON.stringify(dlg, null, 1));
const shot1 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r16-smm-msg-detail.png" });
console.log({ shot1 });
