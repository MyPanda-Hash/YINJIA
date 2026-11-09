// ego round-22: 清理演示单(弃审→删除)
const task = await taskSpace(9);
const page = task.page("p1");
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
// 弃审
await page.click('text="弃审"', { label: "弃审演示单" });
await page.waitForTimeout(900);
await page.click('text="确定"', { label: "确认弃审" });
await page.waitForTimeout(2500);
let st = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return { status: q(".doc-status").map((x) => txt(x)), messages: q(".el-message").map((x) => txt(x)) };
});
console.log("弃审后:", JSON.stringify(st));
// 删除
await page.click('text="删除"', { label: "删除演示单" });
await page.waitForTimeout(900);
await page.click('text="确定"', { label: "确认删除" });
await page.waitForTimeout(2500);
st = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  return { messages: q(".el-message").map((x) => txt(x)), currentDocNo: q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "" };
});
console.log("删除后:", JSON.stringify(st));
console.log("shot=" + await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/demo-07-cleaned.png" }));
