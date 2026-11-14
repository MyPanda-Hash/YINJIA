// round-09:钩 XHR 抓「打开有金额打印弹窗」期间的每个请求(找那个 500)
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

// 安装 XHR 记录器
await page.evaluate(() => {
  if (window.__xhrHook) return;
  window.__xhrLog = [];
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__m = m; this.__u = u; return open.call(this, m, u, ...rest); };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("loadend", () => {
      try {
        if (String(this.__u || "").includes("/api/")) {
          window.__xhrLog.push({ m: this.__m, u: String(this.__u), s: this.status, b: String(this.responseText || "").slice(0, 220) });
        }
      } catch (e) {}
    });
    return send.apply(this, args);
  };
  window.__xhrHook = true;
});

// 关掉当前弹窗,重新打开「打印」(有金额)
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1000);
await page.evaluate(() => { window.__xhrLog = []; });
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-main")?.click();
});
await page.waitForSelector(".pup", { timeout: 25000 }).catch(() => log("no dialog"));
await sleep(3500);

const res = await page.evaluate(() => ({
  log: window.__xhrLog || [],
  rows: [...document.querySelectorAll(".pup .el-table__body .el-table__row")].length,
  empty: (document.querySelector(".pup .el-table__empty-text")?.textContent || "").trim(),
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
}));
log("xhr:", JSON.stringify(res.log.filter((x) => /puPrint|descriptor|label/i.test(x.u)), null, 2));
log("failures:", JSON.stringify(res.log.filter((x) => x.s >= 400), null, 2));
log("rows:", res.rows, "empty:", JSON.stringify(res.empty), "msgs:", JSON.stringify(res.msgs));
