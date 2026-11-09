// ego round-11: 点「提交审批」,看审批意见弹窗结构
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="提交审批"', { label: "点提交审批" });
await page.waitForTimeout(1200);
console.log(await page.snapshot());
