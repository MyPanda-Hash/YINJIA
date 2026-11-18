const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(3500);

// 1) 点「审批」组的下拉箭头（Element Plus 的 trigger 是 span.tb-caret）
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
console.log({ visibleMenu: menu });

if (menu.includes("审核")) {
  await page.click('loc=css:li.el-dropdown-menu__item:has-text("审核")', { label: "点击下拉里的审核" });
  await page.waitForTimeout(2000);
  const dlg = await page.evaluate(() => ({
    box: (document.querySelector(".el-message-box")?.innerText || "").replace(/\s+/g, " ").trim(),
    toasts: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()),
  }));
  console.log({ afterAuditClick: dlg });
}
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r10-audit-click.png" });
console.log({ shot });
