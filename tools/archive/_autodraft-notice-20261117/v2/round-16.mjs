const task = await taskSpace(52);
const page = task.page("p1");

async function openMsg() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      const p = await page.evaluate(() => {
        const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
        if (!pop) return null;
        const items = [...pop.querySelectorAll(".nc-item")];
        return {
          items: items.map((el) => ({
            title: el.querySelector(".nc-item-title")?.innerText.trim(),
            body: el.querySelector(".nc-item-summary")?.innerText.trim(),
            time: el.querySelector(".nc-item-time")?.innerText.trim(),
          })),
          head: (pop.querySelector(".nc-head")?.innerText || "").replace(/\s+/g, " ").trim(),
        };
      });
      if (p && p.items.length) return p;
    }
  }
  return null;
}

const list = await openMsg();
console.log(JSON.stringify(list, null, 1));
const shot1 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r16-jxg-msglist.png" });

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
const shot2 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r16-jxg-msg-detail.png" });

await page.click('loc=role:button[name="去处理"]', { label: "去处理跳转" });
await page.waitForTimeout(4000);
const jump = await page.evaluate(() => ({
  url: location.hash,
  title: document.title,
  doc: [...document.querySelectorAll("input")].map((i) => i.value).filter((v) => /^PI-/.test(v || "")),
}));
console.log(JSON.stringify(jump));
const shot3 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r16-jxg-jump.png" });
console.log({ shot1, shot2, shot3 });
