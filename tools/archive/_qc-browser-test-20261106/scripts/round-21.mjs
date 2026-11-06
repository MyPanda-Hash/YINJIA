// ego round-21: 1920 视口下重拍演示单,并走完两级审批(草稿→审批中→待二级→已审核)
const task = await taskSpace(9);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await page.goto("http://127.0.0.1:8091/#/panelx/list/QC_PROC_INSP", { timeout: 60_000 });
await page.waitForTimeout(3000);
await page.click('css=td:has-text("ZC-2026-11-0022") >> nth=0', { label: "打开演示制程检验单" });
await page.waitForTimeout(2500);
const st = async () => page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    docNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
    status: q(".doc-status").map((x) => txt(x)),
    plan: document.querySelector(".qr-head-table tr:nth-child(4) td:nth-child(4) input")?.value || "",
    verdict: q(".qr-grid tbody tr:first-child td.c-verdict .el-select").map((x) => txt(x)),
    foot: q(".qr-foot-table td").map((x) => txt(x)),
    messages: q(".el-message").map((x) => txt(x)),
  };
});
console.log("draft:", JSON.stringify(await st()));
console.log("draftShot=" + await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-04-draft-1920.png" }));

// 提交审批
await page.click('text="提交审批"', { label: "提交审批" });
await page.waitForTimeout(1000);
await page.fill('css=textarea[placeholder="提交说明（选填）"]', "EGO 浏览器测试:提交审批");
await page.click('text="确认提交审批"', { label: "确认提交" });
await page.waitForTimeout(2500);
console.log("submitted:", JSON.stringify(await st()));
// 一级审批
await page.click('text="审批通过"', { label: "一级审批通过" });
await page.waitForTimeout(1000);
await page.fill('css=textarea[placeholder="审批意见（选填）"]', "EGO 一级审批通过");
await page.click('text="确认审批通过"', { label: "确认一级通过" });
await page.waitForTimeout(2500);
console.log("L1:", JSON.stringify(await st()));
// 二级批准
await page.click('text="批准通过"', { label: "二级批准通过" });
await page.waitForTimeout(1000);
await page.fill('css=textarea[placeholder="审批意见（选填）"]', "EGO 二级批准");
await page.click('text="确认审批通过"', { label: "确认二级批准" });
await page.waitForTimeout(2800);
console.log("audited:", JSON.stringify(await st()));
console.log("auditedShot=" + await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-05-audited-1920.png" }));
// 审批情况
await page.click('text="审批情况"', { label: "打开审批情况" });
await page.waitForTimeout(1500);
const hist = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const dl = [...document.querySelectorAll(".el-dialog")].filter((d) => d.getBoundingClientRect().height > 0).pop();
  return dl ? txt(dl).slice(0, 600) : "";
});
console.log("history:", hist);
console.log("histShot=" + await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-06-history-1920.png" }));
await page.keyboard.press("Escape");
