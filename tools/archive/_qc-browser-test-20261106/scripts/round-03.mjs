// ego round-03: 用 CSS 打开登录工厂下拉(Element Plus select)
const task = await taskSpace(9);
const page = task.page("p1");
const info = await page.evaluate(() => {
  const sels = [...document.querySelectorAll(".el-select")].map((el, i) => ({ i, cls: el.className, text: el.textContent?.trim().slice(0, 40) }));
  return { sels, inputs: [...document.querySelectorAll("input")].map((x) => ({ ph: x.placeholder, val: x.value })) };
});
console.log(JSON.stringify(info));
await page.click("css=.el-select", { label: "打开登录工厂下拉" });
await page.waitForTimeout(800);
console.log(await page.snapshot());
