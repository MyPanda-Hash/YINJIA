// ego round-20: 诊断纸面宽度(左栏展开 vs 收起),并截图收起后的纸面
const task = await taskSpace(9);
const page = task.page("p1");
const m1 = await page.evaluate(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const grid = document.querySelector(".qr-grid");
  return {
    viewport: { w: innerWidth, h: innerHeight },
    rail: box(".doc-select-rail"),
    sheetScroll: box(".sheet-scroll"),
    sheet: box(".qr-sheet"),
    grid: box(".qr-grid"),
    gridScrollWidth: grid ? grid.scrollWidth : null,
    gridOffsetWidth: grid ? grid.offsetWidth : null,
  };
});
console.log("左栏展开时:", JSON.stringify(m1));
// 收起左栏(«)
const railToggle = await page.evaluate(() => {
  const el = [...document.querySelectorAll(".doc-select-rail *")].find((x) => x.textContent.trim() === "«");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log("收起按钮:", JSON.stringify(railToggle));
if (railToggle) {
  await page.mouse.click(railToggle.x, railToggle.y, { label: "收起左栏" });
  await page.waitForTimeout(1200);
}
const m2 = await page.evaluate(() => {
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const grid = document.querySelector(".qr-grid");
  return {
    rail: box(".doc-select-rail"),
    sheetScroll: box(".sheet-scroll"),
    sheet: box(".qr-sheet"),
    grid: box(".qr-grid"),
    gridScrollWidth: grid ? grid.scrollWidth : null,
  };
});
console.log("收起左栏后:", JSON.stringify(m2));
console.log("当前单号:", await page.evaluate(() => document.querySelector(".qr-head-table tr")?.querySelector("td")?.textContent?.trim() || ""));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-03-rail-collapsed.png" });
console.log("shot=" + path);
