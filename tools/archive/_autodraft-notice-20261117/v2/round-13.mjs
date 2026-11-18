const task = await taskSpace(52);
const page = task.page("p1");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const opened = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-form-item")].find((f) => (f.innerText || "").includes("登录工厂"));
  if (!item) return "no-item";
  const sel = item.querySelector(".el-select");
  if (!sel) return "no-select";
  sel.click();
  return "clicked";
});
await page.waitForTimeout(900);
const opts = await page.evaluate(() =>
  [...document.querySelectorAll("li.el-select-dropdown__item")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim()));
console.log({ opened, opts });
