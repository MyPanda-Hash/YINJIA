// round-02:恢复窗口 → 重开 → 无金额=送货单 + 有金额需方联系人弹窗(下拉/新增)
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

// 先把窗口恢复到正常状态(最小化时截图会直接报错)
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) { log("restore: " + e.message); }
await sleep(800);

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 45000 });
await sleep(5000);
const st = await page.evaluate(() => ({ hash: location.hash, login: !!document.querySelector(".login-form"), rows: document.querySelectorAll(".el-table__body .el-table__row").length }));
log("state:", JSON.stringify(st));
if (st.login || st.hash.includes("/login")) {
  await page.evaluate(() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ins = [...document.querySelectorAll("input")];
    const acc = ins.find((i) => (i.placeholder || "").includes("账号"));
    const pwd = ins.find((i) => (i.placeholder || "").includes("密码"));
    if (acc) set(acc, "admin");
    if (pwd) set(pwd, "123456");
    [...document.querySelectorAll(".el-select")].find((s) => /登录工厂|YINJIA/.test(s.textContent || ""))?.click();
  });
  await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => /测试/.test(e.textContent || ""))?.click());
  await sleep(600);
  await page.click("text=进入系统", { label: "login" }).catch(() => {});
  await sleep(6000);
  await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 45000 });
  await sleep(5000);
}
await page.waitForSelector(".el-table__body .el-table__row", { timeout: 60000 }).catch(() => log("still no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1800);
log("rows now:", await page.evaluate(() => document.querySelectorAll(".el-table__body .el-table__row").length));

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

async function openPrint(menuText, marker) {
  await page.evaluate(() => {
    const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
    g?.querySelector(".tb-caret")?.click();
  });
  await sleep(900);
  const clicked = await page.evaluate((txt) => {
    const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item, li")]
      .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === txt)[0];
    if (!t) return false;
    t.click();
    return true;
  }, menuText);
  const ok = await page.waitForSelector(marker, { timeout: 25000 }).then(() => true).catch(() => false);
  await sleep(2500);
  return { clicked, opened: ok };
}

// ── ① 无金额 = 送货单 ──
log("打印订单无金额:", JSON.stringify(await openPrint("打印订单无金额", ".pup")));
const noAmountUi = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
}));
log("无金额弹窗:", JSON.stringify(noAmountUi));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-02-noamount-dialog.png" });

await page.click("text=确定并打印", { label: "print no-amount" }).catch((e) => log("confirm: " + e.message));
await sleep(5000);
const noAmountPaper = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const html = host ? host.innerHTML : "";
  return {
    printCalls: window.__printed || 0,
    h1: (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "",
    hasSign: html.includes('class="sign"') || html.includes("供　方") || html.includes("需　方"),
    hasNotes: html.includes("注意事项"),
    cards: (host ? host.querySelectorAll("h1").length : 0),
  };
});
log("送货单纸面:", JSON.stringify(noAmountPaper, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-02-delivery-note.png" });
console.log("done");
