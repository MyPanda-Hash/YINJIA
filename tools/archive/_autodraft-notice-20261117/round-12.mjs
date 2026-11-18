const task = await taskSpace(51);
const page = task.page("p1");
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").includes("管理员"));
  if (!b) return false;
  b.click();
  return true;
});
console.log({ clicked });
await page.waitForTimeout(1200);
const menu = await page.evaluate(() =>
  [...document.querySelectorAll("li.el-dropdown-menu__item, .el-dropdown-menu__item")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => (el.innerText || "").replace(/\s+/g, "").trim()));
console.log({ menu });
