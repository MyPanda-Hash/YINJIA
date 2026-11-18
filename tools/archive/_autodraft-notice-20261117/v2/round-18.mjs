const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_RETURN", { timeout: 60000 });
await page.waitForTimeout(6000);   // 等 NoticeCenter 挂载后的首轮 load 结束(loadingMap 期间 click 会被忽略)
await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
await page.waitForTimeout(2500);
const state = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  return pop ? {
    open: true,
    n: pop.querySelectorAll(".nc-item").length,
    rows: [...pop.querySelectorAll(".nc-item")].map((el) => ({
      title: el.querySelector(".nc-item-title")?.innerText.trim(),
      body: el.querySelector(".nc-item-summary")?.innerText.trim(),
    })),
  } : { open: false };
});
console.log(JSON.stringify(state, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r18-jxg-msglist.png" });
console.log({ shot });
