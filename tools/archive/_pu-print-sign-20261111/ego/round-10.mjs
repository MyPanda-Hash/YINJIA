// round-10:重新登录(测试库) → 有金额打印弹窗 → 需方联系人下拉/新增 → 出纸核对 → 复开验证名单已记住
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) { log("restore: " + e.message); }
await sleep(500);

// 清掉旧 token,强制重新登录(前面的 403 说明会话已失效)
await page.evaluate(() => { try { localStorage.removeItem("mes_token"); } catch (e) {} });
await page.goto("http://localhost:5173/#/login", { timeout: 45000 });
await sleep(3500);
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
await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => /测试/.test(e.textContent || ""))?.click());
await sleep(700);
await page.click("text=进入系统", { label: "login" }).catch(() => {});
await sleep(7000);
log("after login:", await page.evaluate(() => location.hash));

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 45000 });
await sleep(4500);
await page.waitForSelector(".el-table__body .el-table__row", { timeout: 60000 }).catch(() => log("no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1800);

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-main")?.click();
});
const opened = await page.waitForSelector(".pup", { timeout: 25000 }).then(() => true).catch(() => false);
log("dialog:", opened);
await sleep(3000);

const ui = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  fmtActive: (document.querySelector(".el-radio-button.is-active")?.textContent || "").trim(),
  rows: [...document.querySelectorAll(".pup .el-table__body .el-table__row")].length,
  buyerItems: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  buyerVals: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => s.querySelector("input")?.value || ""),
  qty: [...document.querySelectorAll(".pup .el-table__body .el-table__row .el-input-number input")].map((i) => i.value),
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
}));
log("有金额弹窗:", JSON.stringify(ui, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-10-buyer-block.png" });
if (!ui.rows) { log("STOP: 没有明细行"); process.exit(0); }

// 新增联系人:直接在下拉里输入新名字/新电话(el-select 的 allow-create)
await page.evaluate(() => {
  const sels = [...document.querySelectorAll(".pup-buyer .el-select")];
  const setInput = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const nameInput = sels[0]?.querySelector("input");
  if (nameInput) { nameInput.focus(); setInput(nameInput, "测试联系人A"); }
});
await sleep(900);
await page.keyboard.press("Enter").catch(() => {});
await sleep(500);
await page.evaluate(() => {
  const sels = [...document.querySelectorAll(".pup-buyer .el-select")];
  const setInput = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const telInput = sels[1]?.querySelector("input");
  if (telInput) { telInput.focus(); setInput(telInput, "13900002222"); }
});
await sleep(900);
await page.keyboard.press("Enter").catch(() => {});
await sleep(800);
log("填入:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => s.querySelector("input")?.value || ""))));

// 打印
await page.click("text=确定并打印", { label: "print amount" }).catch((e) => log("confirm: " + e.message));
await sleep(6000);
const paper = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const html = host ? host.innerHTML : "";
  const text = host ? (host.textContent || "").replace(/\s+/g, " ") : "";
  return {
    printCalls: window.__printed || 0,
    h1: (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "",
    hasSign: html.includes('class="sign"'),
    signText: (text.match(/供　方.{0,120}/) || [])[0] || "",
    msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("有金额纸面:", JSON.stringify(paper, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-10-amount-printed.png" });
console.log("done");
