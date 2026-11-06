// ego round-05: 选测试库工厂 + 登录,进入后打开「制程检验单」面板
const task = await taskSpace(9);
const page = task.page("p1");
await page.click("text=YINJIA-MES·测试库", { label: "选择测试账套" });
await page.waitForTimeout(300);
await page.click("@9", { label: "点击进入系统" });
await page.waitForURL((u) => !String(u).includes("/login"), { timeout: 30_000 });
await page.waitForTimeout(2500);
console.log(JSON.stringify({ url: await page.url(), title: await page.title() }));
await page.goto("http://127.0.0.1:8091/#/panelx/list/QC_PROC_INSP", { timeout: 60_000 });
await page.waitForTimeout(3500);
console.log(JSON.stringify({ url2: await page.url() }));
console.log(await page.snapshot());
