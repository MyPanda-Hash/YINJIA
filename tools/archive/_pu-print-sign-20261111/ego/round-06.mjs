// round-06:诊断——点「确定并打印」后到底发生了什么(读 toast / 弹窗状态 / 网络)
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
const before = await page.evaluate(() => ({
  dialogOpen: !!document.querySelector(".pup"),
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  buyer: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => s.querySelector("input")?.value || ""),
  qty: [...document.querySelectorAll(".pup .el-table__body .el-table__row .el-input-number input")].map((i) => i.value),
  buttons: [...document.querySelectorAll(".el-dialog__footer button")].map((b) => (b.textContent || "").trim()),
  busy: !!document.querySelector(".el-dialog__footer button.is-loading"),
}));
log("before:", JSON.stringify(before, null, 2));

// 记录所有 POST /puPrint 的响应
await page.evaluate(() => {
  window.__calls = [];
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = String(args[0]?.url || args[0] || "");
    const r = await origFetch(...args);
    if (url.includes("/puPrint")) {
      const t = await r.clone().text();
      window.__calls.push({ url, status: r.status, body: t.slice(0, 200) });
    }
    return r;
  };
});

await page.click("text=确定并打印", { label: "print amount" }).catch((e) => log("confirm err: " + e.message));
await sleep(600);
const t1 = await page.evaluate(() => ({ msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()), printed: window.__printed || 0 }));
log("t+0.6s:", JSON.stringify(t1));
await sleep(3000);
const t2 = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  printed: window.__printed || 0,
  calls: window.__calls || [],
  host: !!document.getElementById("yj-print-host"),
  dialogOpen: !!document.querySelector(".pup"),
}));
log("t+3.6s:", JSON.stringify(t2, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-06-diag.png" });
