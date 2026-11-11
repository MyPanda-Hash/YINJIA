// round-02:填每箱数量 → 看整箱/零头提示 → 打桩 window.print 后"确定并打印",读打印层卡面数量
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(3000);

// 会话可能过期 → 回到登录页就重新登录(仍然选测试库)
const onLogin = await page.evaluate(() => location.hash.includes("/login") || !!document.querySelector(".login-form"));
log("on login page:", onLogin);
if (onLogin) {
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
  });
  await page.evaluate(() => { [...document.querySelectorAll(".el-select")].find((s) => /登录工厂|YINJIA/.test(s.textContent || ""))?.click(); });
  await sleep(800);
  await page.evaluate(() => {
    const item = [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => /测试/.test(e.textContent || ""));
    item?.click();
  });
  await sleep(600);
  await page.click("text=进入系统", { label: "login" }).catch((e) => log("login click: " + e.message));
  await sleep(6000);
  await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
  await sleep(4000);
}

await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1200);
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(800);
await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印材料码")[0];
  t?.click();
});
const opened = await page.waitForSelector(".mlq", { timeout: 30000 }).then(() => true).catch(() => false);
log("dialog opened:", opened);
await sleep(2500);

// 打桩 window.print(不弹系统打印框,只留打印层供检查)
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

// ① 填本次打印数量 2450、每箱数量 200(第一行)
const fill = await page.evaluate(() => {
  const row = document.querySelector(".mlq .el-table__body .el-table__row");
  if (!row) return { ok: false };
  const nums = [...row.querySelectorAll(".el-input-number input")];
  const set = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    s.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };
  if (nums[0]) set(nums[0], "2450");
  if (nums[1]) set(nums[1], "200");
  return { ok: true, inputs: nums.length, values: nums.map((n) => n.value) };
});
log("fill:", JSON.stringify(fill));
await sleep(1200);

const state = await page.evaluate(() => ({
  hint: [...document.querySelectorAll(".mlq-box-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  foot: (document.querySelector(".mlq-foot")?.textContent || "").replace(/\s+/g, " ").trim(),
  values: [...document.querySelectorAll(".mlq .el-table__body .el-table__row")].map((r) =>
    [...r.querySelectorAll(".el-input-number input")].map((i) => i.value)),
}));
log("state:", JSON.stringify(state, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-02-filled.png" });

// ② 确定并打印(print 已被打桩)
await page.click("text=确定并打印", { label: "confirm print" }).catch((e) => log("confirm: " + e.message));
await sleep(4000);

const printed = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const cards = host ? [...host.querySelectorAll(".card")].map((c) => (c.textContent || "").replace(/\s+/g, " ").trim()) : [];
  const toast = [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim());
  return { printCalls: window.__printed || 0, cards, toast, hasHost: !!host };
});
log("printed:", JSON.stringify(printed, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-02-after-print.png" });
console.log("done");
