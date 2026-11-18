const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_INSP?docNo=IJ-2026-11-0019", { timeout: 60000 });
await page.waitForTimeout(3000);
console.log({ url: await page.url(), title: await page.title() });
console.log(await page.snapshot());
