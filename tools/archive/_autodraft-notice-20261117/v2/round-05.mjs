const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ timeout: 60000 });
await page.waitForTimeout(2000);
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: "visible", timeout: 20000 });
await page.fill('input[placeholder="请输入登录账号"]', "jxg");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "登录仓库审核 jxg" });
await page.waitForTimeout(5000);
console.log({ url: await page.url(), badge: await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label")) });

await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  if (!pop) return null;
  return [...pop.querySelectorAll(".nc-item")].map((el) => ({
    title: el.querySelector(".nc-item-title")?.innerText.trim(),
    body: el.querySelector(".nc-item-summary")?.innerText.trim(),
  }));
});
console.log(JSON.stringify(rows, null, 1));
const shot1 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r05-jxg-msglist.png" });
console.log({ shot1 });
