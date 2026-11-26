const task = await taskSpace("验收 20261127 生产部署");
const page = task.page("p1");
await page.goto("http://36.140.66.163:8090/");
console.log({ taskSpaceId: task.spaceId, page: page.label, url: await page.url() });
console.log(await page.snapshot());
