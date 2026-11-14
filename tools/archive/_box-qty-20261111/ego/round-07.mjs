// round-07:打桩 window.print → 确定并打印 → 读打印层卡面(数量必须是 200) → 记录打印单号
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

// 打桩:不弹系统打印框,只保留打印层供检查
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

await page.click("text=确定并打印", { label: "confirm print" }).catch((e) => log("confirm click: " + e.message));
await sleep(5000);

const res = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const cards = host ? [...host.querySelectorAll(".card")].map((c) => (c.textContent || "").replace(/\s+/g, " ").trim()) : [];
  const msgs = [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim());
  return { printCalls: window.__printed || 0, cards, msgs, hasHost: !!host };
});
log("print result:", JSON.stringify(res, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-07-printed.png" });

// 记录表里应出现这张打印单(打印后就地刷新)
await sleep(2500);
const recs = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  return {
    collapseText: (rows?.textContent || "").replace(/\s+/g, " ").slice(0, 120),
    tableRows: [...document.querySelectorAll(".mlq .el-table__row")].map((r) => [...r.querySelectorAll("td")].map((td) => (td.textContent || "").trim()).join(" | ")).slice(0, 8),
  };
});
log("records:", JSON.stringify(recs, null, 2));
console.log("done");
