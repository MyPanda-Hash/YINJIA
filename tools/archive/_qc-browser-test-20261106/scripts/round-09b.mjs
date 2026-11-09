// ego round-09b: 刷新后重新打开 ZC-2026-11-0021,验证修改已持久化
const task = await taskSpace(9);
const page = task.page("p1");
await page.reload({ timeout: 60_000 });
await page.waitForTimeout(3000);
await page.click('css=td:has-text("ZC-2026-11-0021")', { label: "打开刚保存的制程检验单" });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    docNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
    status: q(".doc-status").map((x) => txt(x)),
    planValue: document.querySelector(".qr-head-table tr:nth-child(4) td:nth-child(4) input")?.value || "",
    headLabels: q(".qr-head-table th").map((x) => txt(x)),
    gridRows: q(".qr-grid tbody tr").length,
    reqText: document.querySelector(".qr-grid tbody tr:first-child td.c-req textarea")?.value || "",
    verdictText: q(".qr-grid tbody tr:first-child td.c-verdict .el-select").map((x) => txt(x)),
    footLabels: q(".qr-foot-table th").map((x) => txt(x)),
  };
});
console.log(JSON.stringify(after, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round09-reopened.png" });
console.log("shot=" + path);
