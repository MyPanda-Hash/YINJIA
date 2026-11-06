// ego round-19: 1600x900 视口下重建演示草稿(检验方案可改+结果判断下拉),截图后保存
const task = await taskSpace(9);
const page = task.page("p1");
try {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
} catch (e) {
  console.log("cdp viewport failed:", String(e).slice(0, 200));
}
await page.goto("http://127.0.0.1:8091/#/panelx/list/QC_PROC_INSP", { timeout: 60_000 });
await page.waitForTimeout(2500);
await page.click('text="新增"', { label: "新增演示草稿" });
await page.waitForTimeout(2500);
const no = await page.evaluate(() => document.querySelector(".qr-head-table tr")?.querySelector("td")?.textContent?.trim() || "");
await page.fill("css=.qr-head-table tr:nth-child(4) td:nth-child(4) input", "EGO演示方案-20261106");
await page.click('text="＋ 新增检验项"', { label: "新增检验项" });
await page.waitForTimeout(600);
await page.fill("css=.qr-grid tbody tr:first-child td.c-req textarea", "EGO 浏览器测试：外观无破损，尺寸符合图纸要求");
await page.click("css=.qr-grid tbody tr:first-child td.c-verdict .el-select", { label: "打开结果判断下拉" });
await page.waitForTimeout(600);
await page.click('text="不合格"', { label: "选择不合格" });
await page.waitForTimeout(400);
const shot1 = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-01-paper-filled.png" });
await page.click('text="保存"', { label: "保存演示草稿" });
await page.waitForTimeout(2500);
const shot2 = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-02-saved.png" });
const facts = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    docNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
    status: q(".doc-status").map((x) => txt(x)),
    plan: document.querySelector(".qr-head-table tr:nth-child(4) td:nth-child(4) input")?.value || "",
    verdict: q(".qr-grid tbody tr:first-child td.c-verdict .el-select").map((x) => txt(x)),
    messages: q(".el-message").map((x) => txt(x)),
  };
});
console.log(JSON.stringify({ no, facts, shot1, shot2 }, null, 1));
