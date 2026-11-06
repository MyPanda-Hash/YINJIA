// ego round-02: 填账号密码 + 打开登录工厂下拉,看选项
const task = await taskSpace(9);
const page = task.page("p1");
await page.fill('css=input[placeholder="请输入登录账号"]', "admin");
await page.fill('css=input[placeholder="请输入登录密码"]', "123456");
await page.click("@8");
await page.waitForTimeout(800);
console.log(await page.snapshot());
