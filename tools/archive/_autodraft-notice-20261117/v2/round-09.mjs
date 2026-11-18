const task = await taskSpace(52);
const page = task.page("p1");

async function probe() {
  return page.evaluate(() => {
    const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
    if (!pop) return null;
    return {
      head: (pop.querySelector(".nc-head")?.innerText || "").replace(/\s+/g, " ").trim(),
      items: [...pop.querySelectorAll(".nc-item")].map((el) => ({
        title: el.querySelector(".nc-item-title")?.innerText.trim(),
        body: el.querySelector(".nc-item-summary")?.innerText.trim(),
      })),
      loading: !!pop.querySelector(".el-loading-mask"),
    };
  });
}

let result = null;
for (let attempt = 1; attempt <= 3 && !result; attempt++) {
  await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const p = await probe();
    if (p && (p.items.length || !p.loading)) { result = { attempt, ...p }; break; }
  }
  if (!result || !result.items?.length) {
    // 可能被"再点一次"关掉了:关掉重来
    await page.evaluate(() => { if ([...document.querySelectorAll(".notice-popover")].some((e) => e.offsetParent !== null)) document.querySelector('button[aria-label*="消息"]')?.click(); });
    await page.waitForTimeout(500);
    result = null;
  }
}
console.log(JSON.stringify(result, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r09-jxg-msglist.png" });
console.log({ shot });
