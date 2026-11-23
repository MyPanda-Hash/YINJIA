const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 30000 });
await page.waitForTimeout(3000);
console.log(await page.snapshot());
