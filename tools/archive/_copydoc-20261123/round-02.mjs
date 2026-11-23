const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
console.log("url", await page.url());
console.log("title", await page.title());
const st = await page.evaluate(() => ({ token: !!localStorage.getItem('mes_token'), keys: Object.keys(localStorage) }));
console.log(JSON.stringify(st));
