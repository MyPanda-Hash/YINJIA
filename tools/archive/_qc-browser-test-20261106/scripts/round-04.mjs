// ego round-04: 打开登录工厂下拉(第二个 select:.el-select--large)
const task = await taskSpace(9);
const page = task.page("p1");
await page.click("css=.el-select--large", { label: "打开登录工厂下拉" });
await page.waitForTimeout(800);
console.log(await page.snapshot());
