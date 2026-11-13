// round-08:重打(卡面仍应是 200) → 作废(释放预约) → 剩余可打回到 9450
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

// 展开「已打印记录」
const expanded = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  const head = item?.querySelector(".el-collapse-item__header");
  if (!head) return false;
  if (!item.classList.contains("is-active")) head.click();
  return true;
});
await sleep(1200);

// ① 重打
const reprintClicked = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  const btn = item ? [...item.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "重打") : null;
  if (!btn) return false;
  btn.click();
  return true;
});
log("reprint clicked:", reprintClicked);
await sleep(4500);
const re = await page.evaluate(() => ({
  printCalls: window.__printed || 0,
  cards: [...(document.getElementById("yj-print-host")?.querySelectorAll(".card") || [])].map((c) => (c.textContent || "").replace(/\s+/g, " ").trim()),
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
}));
log("reprint:", JSON.stringify(re, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-08-reprint.png" });

// ② 作废(弹确认框 → 点确定)
await sleep(1500);
const voidClicked = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  const btn = item ? [...item.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "作废") : null;
  if (!btn) return false;
  btn.click();
  return true;
});
log("void clicked:", voidClicked);
await sleep(1200);
const confirmed = await page.evaluate(() => {
  const box = document.querySelector(".el-message-box");
  if (!box) return false;
  const ok = [...box.querySelectorAll("button")].find((b) => /确定|OK/.test((b.textContent || "").trim()));
  if (!ok) return false;
  ok.click();
  return true;
});
log("void confirm:", confirmed);
await sleep(3500);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  row: [...document.querySelectorAll(".mlq .el-table__body .el-table__row")].map((r) =>
    [...r.querySelectorAll("td")].map((td) => (td.textContent || "").replace(/\s+/g, " ").trim())),
  recordsText: [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"))?.textContent.replace(/\s+/g, " ").slice(0, 80),
}));
log("after void:", JSON.stringify(after, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-08-after-void.png" });
console.log("done");
