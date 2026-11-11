// round-05:点「打印」组主按钮(= 打印采购订单,有金额)→ 需方联系人下拉/新增 → 出纸核对
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) { log("restore: " + e.message); }
await sleep(500);
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1200);
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1600);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

// 「打印」组的主按钮 = 打印采购订单(有金额);caret 里才是 预览/导出/无金额/材料码
const mainClicked = await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  const main = g?.querySelector(".tb-main");
  if (!main) return false;
  main.click();
  return true;
});
log("click .tb-main(打印):", mainClicked);
const opened = await page.waitForSelector(".pup", { timeout: 25000 }).then(() => true).catch(() => false);
log("dialog opened:", opened);
if (!opened) { await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-05-nodialog.png" }); process.exit(0); }
await sleep(2500);

const ui = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  fmtActive: (document.querySelector(".el-radio-button.is-active")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
  items: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  values: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => (s.querySelector("input")?.value || "")),
}));
log("有金额弹窗:", JSON.stringify(ui, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-05-buyer-block.png" });

// 新增一个联系人
await page.evaluate(() => {
  const sels = [...document.querySelectorAll(".pup-buyer .el-select")];
  const setInput = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const nameInput = sels[0]?.querySelector("input");
  const telInput = sels[1]?.querySelector("input");
  if (nameInput) { nameInput.focus(); setInput(nameInput, "测试联系人A"); }
  if (telInput) { telInput.focus(); setInput(telInput, "13900002222"); }
});
await sleep(1000);
await page.keyboard.press("Enter").catch(() => {});
await sleep(900);
log("填入后:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => s.querySelector("input")?.value || ""))));

await page.click("text=确定并打印", { label: "print amount" }).catch((e) => log("confirm: " + e.message));
await sleep(5000);
const paper = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const html = host ? host.innerHTML : "";
  const text = host ? (host.textContent || "").replace(/\s+/g, " ") : "";
  return {
    printCalls: window.__printed || 0,
    h1: (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "",
    hasSign: html.includes('class="sign"'),
    signText: (text.match(/供　方.*?联系方式：[0-9]*/) || [])[0] || "",
    msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("有金额纸面:", JSON.stringify(paper, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-05-amount-printed.png" });
console.log("done");
