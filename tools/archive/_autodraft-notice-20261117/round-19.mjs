const task = await taskSpace(51);
const page = task.page("p1");
const idx = await page.evaluate(() => {
  const pop = [...document.querySelectorAll(".notice-popover")].find((el) => el.offsetParent !== null);
  if (!pop) return -1;
  const rows = [...pop.querySelectorAll(".nc-item")];
  const i = rows.findIndex((el) => (el.innerText || "").includes("暂收退回单"));
  if (i >= 0) rows[i].click();
  return i;
});
console.log({ clickedRow: idx });
await page.waitForTimeout(1500);
const dlg = await page.evaluate(() => ({
  body: (document.querySelector(".nc-detail")?.innerText || "").replace(/\s+/g, " ").trim(),
}));
console.log({ detail: dlg.body });
const shot1 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r19-jxg-msg-detail.png" });

await page.click('loc=role:button[name="去处理"]', { label: "去处理跳转" });
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  url: location.hash,
  title: document.title,
  thInput: [...document.querySelectorAll("input")].map((i) => i.value).filter((v) => /^TH-/.test(v || "")),
}));
console.log(JSON.stringify(state, null, 1));
const shot2 = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r19-jxg-jump.png" });
console.log({ shot1, shot2 });
