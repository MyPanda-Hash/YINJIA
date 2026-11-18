const task = await taskSpace(52);
const page = task.page("p1");

const visible = () => page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  if (!pop) return null;
  return {
    n: pop.querySelectorAll(".nc-item").length,
    rows: [...pop.querySelectorAll(".nc-item")].map((el) => ({
      title: el.querySelector(".nc-item-title")?.innerText.trim(),
      body: el.querySelector(".nc-item-summary")?.innerText.trim(),
    })),
  };
});

let state = await visible();
console.log("initial", JSON.stringify(state));
for (let i = 0; i < 3; i++) {
  if (state && state.n > 0) break;
  await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
  await page.waitForTimeout(2200);
  state = await visible();
  console.log("try", i + 1, JSON.stringify(state));
}
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r19-jxg-msglist.png" });
console.log({ shot });
