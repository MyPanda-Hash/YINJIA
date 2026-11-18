const task = await taskSpace(52);
const page = task.page("p1");
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(2500);
await page.fill('input[placeholder="请输入登录账号"]', "jxg");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "登录仓库审核 jxg" });
await page.waitForTimeout(5000);
console.log({ badge: await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label")) });

await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  return [...pop.querySelectorAll(".nc-item")].map((el) => ({
    title: el.querySelector(".nc-item-title")?.innerText.trim(),
    body: el.querySelector(".nc-item-summary")?.innerText.trim(),
  }));
});
console.log(JSON.stringify(rows, null, 1));
const shot1 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r04-jxg-msglist.png" });

// 点「采购入库单」那条 → 详情
const idx = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  const items = [...pop.querySelectorAll(".nc-item")];
  const i = items.findIndex((el) => (el.innerText || "").includes("采购入库单"));
  if (i >= 0) items[i].click();
  return i;
});
await page.waitForTimeout(1500);
const detail = await page.evaluate(() => (document.querySelector(".nc-detail")?.innerText || "").replace(/\s+/g, " ").trim());
console.log({ clickedRow: idx, detail });
const shot2 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r04-jxg-msg-detail.png" });

await page.click('loc=role:button[name="去处理"]', { label: "去处理跳转" });
await page.waitForTimeout(4000);
const jump = await page.evaluate(() => ({
  url: location.hash,
  title: document.title,
  doc: [...document.querySelectorAll("input")].map((i) => i.value).filter((v) => /^PI-/.test(v || "")),
}));
console.log(JSON.stringify(jump));
const shot3 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r04-jxg-jump.png" });
console.log({ shot1, shot2, shot3 });
