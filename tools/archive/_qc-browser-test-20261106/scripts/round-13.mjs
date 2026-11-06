// ego round-13: 点「审批通过」(一级),查看审批意见弹窗
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="审批通过"', { label: "点一级审批通过" });
await page.waitForTimeout(1200);
console.log(await page.snapshot());
