// ego round-12: 填提交说明并确认提交审批,查看状态与侧栏按钮
const task = await taskSpace(9);
const page = task.page("p1");
await page.fill('css=textarea[placeholder="提交说明（选填）"]', "EGO 测试提交说明");
await page.click('text="确认提交审批"', { label: "确认提交审批" });
await page.waitForTimeout(3000);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    docNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "",
    status: q(".doc-status").map((x) => txt(x)),
    side: q(".as-side-btn").map((b) => ({ text: txt(b), disabled: b.className.includes("disabled") })),
    foot: q(".qr-foot-table td").map((x) => txt(x)),
    messages: q(".el-message").map((x) => txt(x)),
  };
});
console.log(JSON.stringify(after, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round12-pending.png" });
console.log("shot=" + path);
