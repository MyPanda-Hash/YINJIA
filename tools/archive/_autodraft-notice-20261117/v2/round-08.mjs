const task = await taskSpace(52);
const page = task.page("p1");
const clicked = await page.evaluate(() => {
  const b = document.querySelector('button[aria-label*="消息"]');
  if (!b) return "no-btn";
  b.click();
  return "clicked";
});
console.log({ clicked });
let rows = null;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(500);
  rows = await page.evaluate(() => {
    const pops = [...document.querySelectorAll(".notice-popover")].filter((el) => el.offsetParent !== null);
    if (!pops.length) return null;
    const pop = pops[0];
    const items = [...pop.querySelectorAll(".nc-item")];
    return {
      items: items.map((el) => ({
        title: el.querySelector(".nc-item-title")?.innerText.trim(),
        body: el.querySelector(".nc-item-summary")?.innerText.trim(),
      })),
      empty: (pop.querySelector(".el-empty")?.innerText || "").trim(),
      head: (pop.querySelector(".nc-head")?.innerText || "").replace(/\s+/g, " ").trim(),
    };
  });
  if (rows && (rows.items.length || rows.empty)) break;
}
console.log(JSON.stringify(rows, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r08-jxg-msglist.png" });
console.log({ shot });
