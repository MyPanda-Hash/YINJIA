// round-10:第二轮口径验证——每箱数量必填拦截 → 填 2450/200 → 张数 13(12 整箱 + 1 零头) → 打印 → 记录里 标签张数/零头箱
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(3000);
if (await page.evaluate(() => location.hash.includes("/login") || !!document.querySelector(".login-form"))) {
  log("re-login (test ledger) ...");
  await page.evaluate(() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ins = [...document.querySelectorAll("input")];
    if (ins.find((i) => (i.placeholder || "").includes("账号"))) set(ins.find((i) => (i.placeholder || "").includes("账号")), "admin");
    if (ins.find((i) => (i.placeholder || "").includes("密码"))) set(ins.find((i) => (i.placeholder || "").includes("密码")), "123456");
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

// 关残留弹窗
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(800);
await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no panel rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1500);
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await sleep(900);
await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印材料码")[0];
  t?.click();
});
const ready = await page.waitForFunction(
  () => document.querySelectorAll(".mlq .el-table__body .el-table__row").length > 0,
  undefined, { timeout: 30000 },
).then(() => true).catch(() => false);
log("dialog ready:", ready);
if (!ready) { await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-10-empty.png" }); process.exit(0); }
await sleep(1200);

// ① 提示条:确认那条"预览里设份数"已消失
const tips = await page.evaluate(() => [...document.querySelectorAll(".mlq-oneline")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()));
log("tips:", JSON.stringify(tips));

// ② 必填拦截:只填本次打印数量,不填每箱数量 → 点确定应被拦
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
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
});
await sleep(900);
await page.click("text=确定并打印", { label: "confirm without box" }).catch(() => {});
await sleep(1500);
const blocked = await page.evaluate(() => ({
  printed: window.__printed || 0,
  msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
}));
log("required guard:", JSON.stringify(blocked, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-10-required.png" });

// ③ 填每箱 200 → 提示应是 13 张(12 整箱 + 零头 50)
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
  if (nums[1]) set(nums[1], "200");
});
await sleep(1200);
const hinted = await page.evaluate(() => ({
  hints: [...document.querySelectorAll(".mlq-box-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  inputs: [...document.querySelectorAll(".mlq .el-table__body .el-table__row .el-input-number input")].map((i) => i.value),
}));
log("hint:", JSON.stringify(hinted, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-10-hint.png" });

// ④ 真打印(print 打桩)→ 数卡片张数/数量
await page.click("text=确定并打印", { label: "confirm print" }).catch(() => {});
await sleep(5000);
const printed = await page.evaluate(() => {
  const cards = [...(document.getElementById("yj-print-host")?.querySelectorAll(".card") || [])]
    .map((c) => (c.textContent || "").replace(/\s+/g, " ").trim());
  const qtys = cards.map((t) => (t.match(/数\s*量：([0-9.]+)/) || [])[1]);
  return {
    printCalls: window.__printed || 0,
    count: cards.length,
    qtys,
    first: cards[0],
    last: cards[cards.length - 1],
    msgs: [...document.querySelectorAll(".el-message")].map((m) => (m.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("printed:", JSON.stringify(printed, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-10-printed.png" });

// ⑤ 已打印记录:标签张数 + 零头箱 tag
await sleep(2500);
await page.evaluate(() => {
  const item = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  if (item && !item.classList.contains("is-active")) item.querySelector(".el-collapse-item__header")?.click();
});
await sleep(1200);
const recs = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".mlq .el-collapse-item")].find((e) => (e.textContent || "").includes("已打印记录"));
  const head = item ? [...item.querySelectorAll("th")].map((t) => (t.textContent || "").trim()) : [];
  const rows = item ? [...item.querySelectorAll(".el-table__row")].map((r) => [...r.querySelectorAll("td")].map((td) => (td.textContent || "").trim())) : [];
  const tags = item ? [...item.querySelectorAll(".el-tag")].map((t) => (t.textContent || "").trim()) : [];
  return { head, rows, tags };
});
log("records:", JSON.stringify(recs, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-10-records.png" });
console.log("done");
