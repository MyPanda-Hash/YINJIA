// server round-02: 清会话 → 登录页 → 选「YINJIA-MES」正式库 → 登录 → 校验工作区标签
const task = await taskSpace(18);
const page = task.page("p1");
await page.goto("http://36.140.66.163:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.goto("http://36.140.66.163:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(4000);

const before = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 240),
  selects: [...document.querySelectorAll("select")].map((s) => ({ name: s.name || "", options: [...s.options].map((o) => o.text) })),
  inputs: [...document.querySelectorAll("input")].map((i) => ({ ph: i.placeholder, type: i.type, value: i.value })),
}));
console.log(JSON.stringify(before, null, 2));
console.log(await page.snapshot());
