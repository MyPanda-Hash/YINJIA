const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
await page.goto("http://127.0.0.1:5173/");
await page.waitForSelector("input", { timeout: 15000 });
// login
const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((el) => ({ type: el.type, ph: el.placeholder || '' })));
console.log("inputs", JSON.stringify(inputs));
console.log({ taskSpaceId: task.spaceId, page: page.label });
