// round-03:有金额版——需方联系人下拉(可新增)+ 供方单位名称带入供应商
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) { log("restore: " + e.message); }
await sleep(600);

await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1200);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

// 打开「打印采购订单」(有金额)
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(900);
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item, li")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印采购订单")[0];
  if (!t) return false;
  t.click();
  return true;
});
log("open 打印采购订单:", clicked);
const opened = await page.waitForSelector(".pup", { timeout: 25000 }).then(() => true).catch(() => false);
log("dialog:", opened);
await sleep(2500);

const ui = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  fmtActive: (document.querySelector(".el-radio-button.is-active")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
  items: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  values: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => (s.querySelector("input")?.value || "")),
  tip: (document.querySelector(".pup-buyer .pup-tip")?.textContent || "").trim(),
  supplierChip: (document.querySelector(".pup-chip")?.textContent || "").replace(/\s+/g, " ").trim(),
}));
log("有金额弹窗:", JSON.stringify(ui, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-03-buyer-block.png" });

// 新增一个联系人:名字输入新值 + 电话输入新值
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
await sleep(700);
await page.keyboard.press("Enter").catch(() => {});
await sleep(900);
const typed = await page.evaluate(() => [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => s.querySelector("input")?.value || ""));
log("填入后:", JSON.stringify(typed));

// 打印
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
    supplierLine: (text.match(/供　方\s*单位名称：([^\s]*)/) || [])[1] || "",
    buyerLine: (text.match(/需　方\s*单位名称：([^<]*)联 系 人：([^\s]*)\s*联系方式：([0-9]*)/) || []).slice(1),
    msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("有金额纸面:", JSON.stringify(paper, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-03-amount-printed.png" });
console.log("done");
