const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
console.log(await page.snapshot());
