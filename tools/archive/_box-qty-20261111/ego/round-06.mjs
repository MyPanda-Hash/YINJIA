// round-06:重走一遍——登录态确认 → 采购订单 → 选中行 → 打印材料码 → 填每箱数量 → 提示 → 打桩打印 → 读卡面
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(2500);

if (await page.evaluate(() => location.hash.includes("/login") || !!document.querySelector(".login-form"))) {
  log("re-login ...");
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
  await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => /测试/.test(e.textContent || ""))?.click());
  await sleep(600);
  await page.click("text=进入系统", { label: "login" }).catch(() => {});
  await sleep(6000);
  await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
  await sleep(3500);
}

// 关掉可能残留的弹窗
await page.evaluate(() => {
  document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} });
});
await sleep(800);

await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no panel rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1500);
log("panel:", JSON.stringify(await page.evaluate(() => ({
  rows: document.querySelectorAll(".el-table__body .el-table__row").length,
  first: (document.querySelector(".el-table__body .el-table__row")?.textContent || "").replace(/\s+/g, " ").slice(0, 60),
}))));

await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(900);
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印材料码")[0];
  if (!t) return false;
  t.click();
  return true;
});
log("clicked 打印材料码:", clicked);

// 等行真的出来(上次就是这里拿到空表)
const hasRows = await page.waitForFunction(
  () => document.querySelectorAll(".mlq .el-table__body .el-table__row").length > 0,
  undefined, { timeout: 25000 },
).then(() => true).catch(() => false);
log("dialog rows ready:", hasRows);
await sleep(1500);

const open = await page.evaluate(() => ({
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  supplier: (document.querySelector(".mlq-chip")?.textContent || "").replace(/\s+/g, " ").trim(),
  rows: [...document.querySelectorAll(".mlq .el-table__body .el-table__row")].map((r) =>
    [...r.querySelectorAll("td")].map((td) => (td.textContent || "").replace(/\s+/g, " ").trim())),
  inputs: [...document.querySelectorAll(".mlq .el-table__body .el-table__row .el-input-number input")].map((i) => ({ v: i.value, ph: i.placeholder, dis: i.disabled })),
}));
log("open:", JSON.stringify(open, null, 2));

if (!hasRows) { await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-06-empty.png" }); console.log("STOP: rows still empty"); process.exit(0); }

// 填 2450 / 200
await page.evaluate(() => {
  const row = document.querySelector(".mlq .el-table__body .el-table__row");
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
});
await sleep(1500);
const filled = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll(".mlq .el-table__body .el-table__row .el-input-number input")].map((i) => i.value),
  hints: [...document.querySelectorAll(".mlq-box-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  foot: (document.querySelector(".mlq-foot")?.textContent || "").replace(/\s+/g, " ").trim(),
}));
log("filled:", JSON.stringify(filled, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-06-filled.png" });
console.log("done");
