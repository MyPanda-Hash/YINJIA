// ego round-18: 删除测试单 ZC-2026-11-0021(清理测试账套),并确认列表里已消失
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="删除"', { label: "删除测试单" });
await page.waitForTimeout(1000);
let boxes = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return [...document.querySelectorAll(".el-message-box")].filter((d) => d.getBoundingClientRect().height > 0).map((d) => txt(d).slice(0, 200));
});
console.log("删除确认框:", JSON.stringify(boxes));
await page.click('text="确定"', { label: "确认删除" });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    messages: q(".el-message").map((x) => txt(x)),
    railRows: q(".doc-select-rail table_row").length,
    railText: q(".doc-select-rail tbody")[0] ? txt(q(".doc-select-rail tbody")[0]).slice(0, 300) : "",
    stillHasDoc: document.body.textContent.includes("ZC-2026-11-0021"),
    currentDocNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
  };
});
console.log(JSON.stringify(after, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round18-deleted.png" });
console.log("shot=" + path);
