const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_RETURN", { timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.click());
await page.waitForTimeout(1500);
const state = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  return pop ? { open: true, n: pop.querySelectorAll(".nc-item").length, text: (pop.innerText || "").replace(/\s+/g, " ").slice(0, 200) } : { open: false };
});
console.log(JSON.stringify(state));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r17-jxg-msglist.png" });
console.log({ shot });
