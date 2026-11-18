const task = await taskSpace("yinjia autodraft notice v2");
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });

await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(2500);
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'));
console.log({ needLogin });
if (needLogin) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[placeholder="请输入登录账号"]', "admin");
  await page.fill('input[placeholder="请输入登录密码"]', "123456");
  await page.click('loc=role:button[name="进入系统"]', { label: "登录 admin" });
  await page.waitForTimeout(5000);
}
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0022", { timeout: 60000 });
await page.waitForTimeout(4000);
const st = await page.evaluate(() => ({
  url: location.hash,
  doc: [...document.querySelectorAll("input")].map((i) => i.value).find((v) => /^IJ-/.test(v || "")),
  status: [...document.querySelectorAll(".el-tag")].map((n) => n.innerText.trim()).filter(Boolean).slice(0, 2),
}));
console.log(JSON.stringify(st));
