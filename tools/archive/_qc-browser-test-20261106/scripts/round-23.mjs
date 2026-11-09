// ego round-23: 清场后刷新回列表(收尾态)
const task = await taskSpace(9);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8091/#/panelx/list/QC_PROC_INSP", { timeout: 60_000 });
await page.waitForTimeout(3000);
const facts = await page.evaluate(() => ({
  docNo: document.querySelector(".qr-head-table tr")?.querySelector("td")?.textContent?.trim() || "",
  total: document.querySelector(".doc-select-rail")?.textContent?.match(/共有数据[:：]\s*(\d+)/)?.[1] || "",
  hasTestDoc: document.body.textContent.includes("ZC-2026-11-0021") || document.body.textContent.includes("ZC-2026-11-0022"),
}));
console.log(JSON.stringify(facts));
console.log("shot=" + await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-08-final-list.png" }));
