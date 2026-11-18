const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ timeout: 60000 });
await page.waitForTimeout(1800);
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: "visible", timeout: 20000 });
await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-form-item")].find((f) => (f.innerText || "").includes("登录工厂"));
  item?.querySelector(".el-select__wrapper")?.click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const li = [...document.querySelectorAll("li.el-select-dropdown__item")]
    .find((el) => el.offsetParent !== null && (el.innerText || "").includes("测试库"));
  li?.click();
});
await page.waitForTimeout(500);
await page.fill('input[placeholder="请输入登录账号"]', "admin");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "恢复 admin 登录" });
await page.waitForTimeout(5000);
const back = await page.evaluate(() => ({
  url: location.hash,
  factory: localStorage.getItem("mes_factory"),
  badge: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
}));
console.log(JSON.stringify(back));
