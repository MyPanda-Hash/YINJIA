const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/login', { timeout: 30000 });
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => ({ hash: location.hash, url: location.href }))));
console.log(await page.snapshot());
