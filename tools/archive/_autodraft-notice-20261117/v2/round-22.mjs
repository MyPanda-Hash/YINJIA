const task = await taskSpace(52);
const page = task.page("p1");

// 一次性做完:选测试库 → 登 jxg → 打开消息 → 截图(减少与其它会话抢浏览器的窗口)
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ timeout: 60000 });
await page.waitForTimeout(1800);
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: "visible", timeout: 20000 });

// 登录工厂 → 测试库
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

await page.fill('input[placeholder="请输入登录账号"]', "jxg");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "登录仓库审核 jxg(测试库)" });
await page.waitForTimeout(5500);

const who = await page.evaluate(() => {
  const t = localStorage.getItem("mes_token") || "";
  const b = t.split(".")[1] || "";
  const p = JSON.parse(decodeURIComponent(atob(b.replace(/-/g, "+").replace(/_/g, "/"))));
  return { sub: p.sub, factory: p.factory, badge: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label") };
});
console.log({ who });

await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  if (!pop) return { open: false };
  return {
    open: true,
    items: [...pop.querySelectorAll(".nc-item")].map((el) => ({
      title: el.querySelector(".nc-item-title")?.innerText.trim(),
      body: el.querySelector(".nc-item-summary")?.innerText.trim(),
    })),
  };
});
console.log(JSON.stringify(rows, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r22-jxg-msglist.png" });
console.log({ shot });
