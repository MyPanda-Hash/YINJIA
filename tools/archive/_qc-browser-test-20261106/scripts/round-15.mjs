// ego round-15: 二级「批准通过」→ 已审核,检查签名格与状态
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="批准通过"', { label: "点二级批准通过" });
await page.waitForTimeout(1000);
await page.fill('css=textarea[placeholder="审批意见（选填）"]', "EGO 二级批准");
await page.click('text="确认审批通过"', { label: "确认二级批准" });
await page.waitForTimeout(3000);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    status: q(".doc-status").map((x) => txt(x)),
    foot: q(".qr-foot-table td").map((x) => txt(x)),
    messages: q(".el-message").map((x) => txt(x)),
    revision: document.querySelector(".doc-status")?.className,
  };
});
console.log(JSON.stringify(after, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round15-audited.png" });
console.log("shot=" + path);
