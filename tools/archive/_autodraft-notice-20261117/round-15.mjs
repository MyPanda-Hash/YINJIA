const task = await taskSpace(51);
const page = task.page("p1");
await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForTimeout(2500);
const items = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  if (!pop) return { found: false };
  return {
    found: true,
    head: (pop.querySelector(".nc-head")?.innerText || "").replace(/\s+/g, " ").trim(),
    rows: [...pop.querySelectorAll(".nc-item")].map((el) => ({
      title: el.querySelector(".nc-item-title")?.innerText.trim(),
      body: el.querySelector(".nc-item-summary")?.innerText.trim(),
      time: el.querySelector(".nc-item-time")?.innerText.trim(),
      unread: el.classList.contains("unread"),
    })),
  };
});
console.log(JSON.stringify(items, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r15-smm-msglist.png" });
console.log({ shot });
