const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
await page.fill("@4", "admin");
await page.fill("@6", "123456");
await page.click("@9");
await page.waitForURL(/dashboard|\/panelx|\/home/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log("url", await page.url());
console.log("token?", await page.evaluate(() => Object.keys(localStorage)));
