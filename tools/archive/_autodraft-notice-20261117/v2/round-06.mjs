const task = await taskSpace(52);
const page = task.page("p1");
const before = await page.evaluate(() => ({
  url: location.hash,
  user: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").replace(/\s+/g, "")).filter((t) => t.length > 0 && t.length < 8).slice(-4),
  msgBtn: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
}));
console.log("BEFORE", JSON.stringify(before));

await page.click('css=button[aria-label*="消息"]', { label: "打开消息" });
await page.waitForTimeout(3500);
const pop = await page.evaluate(() => {
  const el = [...document.querySelectorAll(".notice-popover")].find((e) => e.offsetParent !== null);
  if (!el) return { found: false };
  return {
    found: true,
    text: el.innerText.replace(/\s+/g, " ").slice(0, 400),
    items: el.querySelectorAll(".nc-item").length,
    empty: (el.querySelector(".el-empty")?.innerText || "").trim(),
  };
});
console.log("POP", JSON.stringify(pop, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice2-20261117/r06-jxg-probe.png" });
console.log({ shot });
