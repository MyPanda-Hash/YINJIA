const task = await taskSpace(52);
const page = task.page("p1");
await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForSelector(".notice-popover .nc-item, .notice-popover .el-empty", { state: "visible", timeout: 20000 });
await page.waitForTimeout(1200);
const rows = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  return {
    head: (pop.querySelector(".nc-head")?.innerText || "").replace(/\s+/g, " ").trim(),
    items: [...pop.querySelectorAll(".nc-item")].map((el) => ({
      title: el.querySelector(".nc-item-title")?.innerText.trim(),
      body: el.querySelector(".nc-item-summary")?.innerText.trim(),
      time: el.querySelector(".nc-item-time")?.innerText.trim(),
    })),
  };
});
console.log(JSON.stringify(rows, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r07-jxg-msglist.png" });
console.log({ shot });
