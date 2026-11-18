const task = await taskSpace(51);
const page = task.page("p1");
// 点详情里的「去处理」→ 应跳到采购入库单列表并定位到 PI-2026-11-0021
await page.click('loc=role:button[name="去处理"]', { label: "去处理跳转" });
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  url: location.hash,
  title: document.title,
  docInput: [...document.querySelectorAll("input")].map((i) => i.value).filter((v) => /^PI-/.test(v || "")),
  statusTags: [...document.querySelectorAll(".el-tag")].map((n) => n.innerText.trim()).filter(Boolean).slice(0, 4),
}));
console.log(JSON.stringify(state, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r17-smm-jump.png" });
console.log({ shot });
