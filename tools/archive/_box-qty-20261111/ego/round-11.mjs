// round-11:措辞定稿确认(提示行不再有双层括号)+ 终版截图
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(3000);
if (await page.evaluate(() => location.hash.includes("/login") || !!document.querySelector(".login-form"))) {
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
  await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
  await sleep(4000);
}
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(700);
await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1400);
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(900);
await page.evaluate(() => {
  [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印材料码")[0]?.click();
});
const ready = await page.waitForFunction(
  () => document.querySelectorAll(".mlq .el-table__body .el-table__row").length > 0, undefined, { timeout: 30000 },
).then(() => true).catch(() => false);
log("dialog ready:", ready);
if (!ready) process.exit(0);
await sleep(1000);

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
await sleep(1300);
const out = await page.evaluate(() => ({
  hint: [...document.querySelectorAll(".mlq-box-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  tips: [...document.querySelectorAll(".mlq-oneline")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  head: [...document.querySelectorAll(".mlq .el-table__header th")].map((t) => (t.textContent || "").trim()).filter(Boolean),
}));
log(JSON.stringify(out, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-11-final.png" });
console.log("done");
