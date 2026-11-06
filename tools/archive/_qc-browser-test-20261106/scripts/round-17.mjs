// ego round-17: 关闭审批情况弹窗 → 弃审 → 删除测试单(清理测试账套)
const task = await taskSpace(9);
const page = task.page("p1");
// 关闭弹窗
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
// 弃审
await page.click('text="弃审"', { label: "弃审退回草稿" });
await page.waitForTimeout(1000);
let snap = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return [...document.querySelectorAll(".el-message-box")].filter((d) => d.getBoundingClientRect().height > 0).map((d) => txt(d).slice(0, 300));
});
console.log("弃审确认框:", JSON.stringify(snap));
await page.click('text="确定"', { label: "确认弃审" });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return { status: q(".doc-status").map((x) => txt(x)), messages: q(".el-message").map((x) => txt(x)), foot: q(".qr-foot-table td").map((x) => txt(x)) };
});
console.log("弃审后:", JSON.stringify(after));
