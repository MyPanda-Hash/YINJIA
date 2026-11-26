const task = await taskSpace(1);
const page = task.page("p1");
await page.goto("http://36.140.66.163:8090/#/panelx/list/MATERIAL_OUT");
await page.waitForTimeout(4000);
console.log({ title: await page.title(), url: await page.url() });
const shot = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_deploy-20261127/round-02-material-out.png" });
console.log("SHOT=" + shot);
console.log(await page.snapshot());
