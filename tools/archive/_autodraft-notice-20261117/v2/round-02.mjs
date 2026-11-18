const task = await taskSpace(52);
const page = task.page("p1");

const opened = await page.evaluate(() => {
  const grp = [...document.querySelectorAll(".tools .tb-group")].find(
    (g) => (g.querySelector(".tb-main")?.textContent || "").trim() === "审批");
  if (!grp) return "no-group";
  const caret = grp.querySelector(".tb-caret");
  if (!caret) return "no-caret";
  caret.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  caret.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  caret.click();
  return "clicked";
});
console.log({ opened });
await page.waitForTimeout(800);
const menu = await page.evaluate(() =>
  [...document.querySelectorAll("li.el-dropdown-menu__item")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => (el.innerText || "").replace(/\s+/g, "").trim()));
console.log({ menu });
await page.click('loc=css:li.el-dropdown-menu__item:has-text("审核")', { label: "点击下拉里的审核" });
await page.waitForTimeout(2000);
const box = await page.evaluate(() => (document.querySelector(".el-message-box")?.innerText || "").replace(/\s+/g, " ").trim());
console.log({ confirm: box });
if (box.includes("确认审核")) {
  await page.click('loc=css:.el-message-box__btns button.el-button--primary', { label: "确认审核" });
  await page.waitForTimeout(3500);
}
const done = await page.evaluate(() => ({
  toasts: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()),
  status: [...document.querySelectorAll(".el-tag")].map((n) => n.innerText.trim()).filter(Boolean).slice(0, 2),
}));
console.log(JSON.stringify(done));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r02-audited.png" });
console.log({ shot });
