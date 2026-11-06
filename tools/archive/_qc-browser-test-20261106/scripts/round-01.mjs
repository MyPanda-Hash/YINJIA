// ego round-01: 打开 8091(当前工作区新代码 jar)登录页,确认连通与页面结构
const task = await taskSpace("qc-proc-insp-ego-test-20261106-1725");
const page = task.page("p1");
await page.goto("http://127.0.0.1:8091/", { timeout: 60_000 });
await page.waitForTimeout(1500);
console.log(JSON.stringify({ spaceId: task.spaceId, page: page.label, url: await page.url(), title: await page.title() }));
console.log(await page.snapshot());
