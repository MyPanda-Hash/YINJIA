// ego round-08: 草稿上改「检验方案」+ 新增检验项 + 结果判断选「不合格」+ 保存
const task = await taskSpace(9);
const page = task.page("p1");

// 1) 改检验方案(第 4 行第 2 对的输入框)
await page.fill("css=.qr-head-table tr:nth-child(4) td:nth-child(4) input", "EGO测试方案-20261106");
// 2) 新增检验项
await page.click('text="＋ 新增检验项"', { label: "新增一行检验项" });
await page.waitForTimeout(800);
// 3) 填检验要求(第一行 c-req textarea)
await page.fill("css=.qr-grid tbody tr:first-child td.c-req textarea", "EGO测试：外观无破损，尺寸符合图纸");
// 4) 结果判断选「不合格」
await page.click("css=.qr-grid tbody tr:first-child td.c-verdict .el-select", { label: "打开结果判断下拉" });
await page.waitForTimeout(600);
const opts = await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].map((x) => x.textContent.trim()));
console.log("verdict options:", JSON.stringify(opts));
await page.click('text="不合格"', { label: "选择不合格" });
await page.waitForTimeout(400);
// 5) 保存
await page.click('text="保存"', { label: "保存草稿" });
await page.waitForTimeout(3000);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    docNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
    status: q(".doc-status").map((x) => txt(x)),
    planValue: document.querySelector(".qr-head-table tr:nth-child(4) td:nth-child(4) input")?.value || "",
    gridRows: q(".qr-grid tbody tr").length,
    verdictText: q(".qr-grid tbody tr:first-child td.c-verdict .el-select").map((x) => txt(x)),
    reqText: document.querySelector(".qr-grid tbody tr:first-child td.c-req textarea")?.value || "",
    messages: q(".el-message").map((x) => txt(x)),
    savedSnapshot: q(".doc-status").map((x) => txt(x)),
  };
});
console.log(JSON.stringify(after, null, 1));
// 记录单号到文件供下一轮使用(ego 每次新进程,靠 .mjs 里写死的下一轮脚本)
const fs = await import("node:fs/promises");
await fs.writeFile("D:/workspace/yinjia/.tmp/ego/last-doc.json", JSON.stringify(after, null, 1), "utf8");
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round08-after-save.png" });
console.log("shot=" + path);
