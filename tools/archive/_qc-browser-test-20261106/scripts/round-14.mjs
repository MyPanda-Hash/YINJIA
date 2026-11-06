// ego round-14: 确认一级审批通过,检查状态=待二级审批、审核人已落
const task = await taskSpace(9);
const page = task.page("p1");
await page.fill('css=textarea[placeholder="审批意见（选填）"]', "EGO 一级审批通过");
await page.click('text="确认审批通过"', { label: "确认一级审批通过" });
await page.waitForTimeout(3000);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return {
    status: q(".doc-status").map((x) => txt(x)),
    side: q(".as-side-btn").map((b) => ({ text: txt(b), disabled: b.className.includes("disabled") })),
    foot: q(".qr-foot-table td").map((x) => txt(x)),
    messages: q(".el-message").map((x) => txt(x)),
  };
});
console.log(JSON.stringify(after, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round14-l2-pending.png" });
console.log("shot=" + path);
