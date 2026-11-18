const task = await taskSpace(51);
const page = task.page("p1");
const has = await page.evaluate(() => (document.querySelector(".el-message-box")?.innerText || "").replace(/\s+/g, " ").trim());
console.log({ dialogNow: has });
if (has.includes("确认审核")) {
  await page.click('loc=css:.el-message-box__btns button.el-button--primary', { label: "确认审核" });
  await page.waitForTimeout(3000);
}
const out = await page.evaluate(() => ({
  toasts: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()),
  docNo: [...document.querySelectorAll("input")].map((i) => i.value).find((v) => v && v.startsWith("IJ-")),
  statusTag: [...document.querySelectorAll(".el-tag")].map((n) => n.innerText.trim()).slice(0, 3),
  msgBadge: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
}));
console.log(JSON.stringify(out, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r11-audit-done.png" });
console.log({ shot });
