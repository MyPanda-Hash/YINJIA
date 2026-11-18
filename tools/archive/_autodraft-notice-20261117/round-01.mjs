const task = await taskSpace("yinjia autodraft notice verify");
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/", { timeout: 60000 });
await page.waitForTimeout(1500);
console.log({ taskSpaceId: task.spaceId, page: page.label, url: await page.url() });
console.log(await page.snapshot());
