const task = await taskSpace(52);
const page = task.page("p1");
const info = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-form-item")].find((f) => (f.innerText || "").includes("登录工厂"));
  const poppers = [...document.querySelectorAll(".el-select__popper, .el-popper")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ cls: (el.className || "").toString(), text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 160) }));
  return {
    itemHtml: item ? item.outerHTML.slice(0, 1200) : null,
    poppers,
  };
});
console.log(JSON.stringify(info, null, 1));
