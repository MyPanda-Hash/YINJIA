const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_RETURN", { timeout: 60000 });
await page.waitForTimeout(3500);
console.log({ url: await page.url(), badge: await page.evaluate(() => document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label")) });

const before = await page.evaluate(() => document.querySelectorAll(".notice-popover").length);
await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const pops = [...document.querySelectorAll(".notice-popover")];
  return {
    count: pops.length,
    states: pops.map((p) => ({
      visible: p.offsetParent !== null,
      display: getComputedStyle(p).display,
      text: (p.innerText || "").replace(/\s+/g, " ").slice(0, 120),
    })),
  };
});
console.log(JSON.stringify({ before, after }, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r10-jxg-from-panel.png" });
console.log({ shot });
