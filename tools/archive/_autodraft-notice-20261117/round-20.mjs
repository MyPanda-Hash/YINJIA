const task = await taskSpace(51);
const page = task.page("p1");
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(2500);
await page.fill('input[placeholder="请输入登录账号"]', "admin");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "恢复 admin 登录" });
await page.waitForTimeout(5000);
const back = await page.evaluate(() => ({
  url: location.hash,
  factory: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).find((t) => t.includes("测试库")) || "",
  msgBadge: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
}));
console.log(JSON.stringify(back, null, 1));
