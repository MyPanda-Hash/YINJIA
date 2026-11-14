// round-01:送货单改名(无金额)+ 有金额版 供方单位名称/需方联系人弹窗(下拉可新增)
const task = await taskSpace("pu-print-sign-20261111");
console.log({ spaceId: task.spaceId });
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto("http://localhost:5173/#/login", { timeout: 40000 });
await sleep(2500);
if (await page.evaluate(() => !!document.querySelector(".login-form") || location.hash.includes("/login"))) {
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
}

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(3500);
await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1500);

// 打桩 print
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

async function openPrint(menuText) {
  await page.evaluate(() => {
    const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
    g?.querySelector(".tb-caret")?.click();
  });
  await sleep(800);
  const clicked = await page.evaluate((txt) => {
    const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
      .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === txt)[0];
    if (!t) return false;
    t.click();
    return true;
  }, menuText);
  await sleep(2500);
  return clicked;
}

// ── ① 无金额 = 送货单 ──
log("open 打印订单无金额:", await openPrint("打印订单无金额"));
await page.waitForSelector(".pup", { timeout: 30000 }).catch(() => log("dialog missing"));
await sleep(2000);
const noAmountUi = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
  fmtChecked: (document.querySelector(".el-radio-button.is-active")?.textContent || "").trim(),
}));
log("无金额弹窗:", JSON.stringify(noAmountUi));

await page.click("text=确定并打印", { label: "print no-amount" }).catch((e) => log("confirm: " + e.message));
await sleep(4500);
const noAmountPaper = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const html = host ? host.innerHTML : "";
  return {
    printCalls: window.__printed || 0,
    h1: (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "",
    hasSign: html.includes('class="sign"') || html.includes("供　方") || html.includes("需　方"),
    hasNotes: html.includes("注意事项"),
    title: document.title,
  };
});
log("送货单纸面:", JSON.stringify(noAmountPaper, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-01-delivery-note.png" });

// ── ② 有金额:需方联系人弹窗 ──
await sleep(2000);
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1200);
log("open 打印采购订单:", await openPrint("打印采购订单"));
await page.waitForSelector(".pup", { timeout: 30000 }).catch(() => log("dialog missing"));
await sleep(2500);
const amountUi = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  buyerBlock: !!document.querySelector(".pup-buyer"),
  selects: [...document.querySelectorAll(".pup-buyer .el-select")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  labels: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  tip: (document.querySelector(".pup-buyer .pup-tip")?.textContent || "").trim(),
}));
log("有金额弹窗:", JSON.stringify(amountUi, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-01-buyer-block.png" });
console.log("done");
