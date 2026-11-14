// round-09:切英文复检(列头/占位词/提示全英文) + 后端校验(每箱数量 > 本次打印数量 必须被拒)
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

await page.evaluate(() => { try { localStorage.setItem("mes_locale", "en"); } catch (e) {} });
await page.reload();
await sleep(6000);
await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await sleep(3500);
if (await page.evaluate(() => location.hash.includes("/login") || !!document.querySelector(".login-form"))) {
  log("re-login (en) ...");
  await page.evaluate(() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ins = [...document.querySelectorAll("input")];
    const acc = ins.find((i) => (i.placeholder || "").toLowerCase().includes("account") || (i.placeholder || "").includes("账号"));
    const pwd = ins.find((i) => (i.placeholder || "").toLowerCase().includes("password") || (i.placeholder || "").includes("密码"));
    if (acc) set(acc, "admin");
    if (pwd) set(pwd, "123456");
    [...document.querySelectorAll(".el-select")].find((s) => /factory|YINJIA/i.test(s.textContent || ""))?.click();
  });
  await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => /测试|test/i.test(e.textContent || ""))?.click());
  await sleep(600);
  await page.click("text=/进入系统|Sign in/i", { label: "login" }).catch(() => {});
  await sleep(6000);
  await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
  await sleep(4000);
}
await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => log("no rows"));
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1500);
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => /print/i.test((x.querySelector(".tb-main")?.textContent || "").trim()));
  g?.querySelector(".tb-caret")?.click();
});
await sleep(900);
await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && /material qr/i.test((e.textContent || "").trim()))[0];
  t?.click();
});
const ok = await page.waitForSelector(".mlq .el-table__body .el-table__row", { timeout: 25000 }).then(() => true).catch(() => false);
log("en dialog rows:", ok);
await sleep(1000);
const en = await page.evaluate(() => {
  const row = document.querySelector(".mlq .el-table__body .el-table__row");
  const nums = row ? [...row.querySelectorAll(".el-input-number input")] : [];
  return {
    headers: [...document.querySelectorAll(".mlq .el-table__header th")].map((t) => (t.textContent || "").trim()).filter(Boolean),
    placeholder: nums[1] ? nums[1].placeholder : "",
    tips: [...document.querySelectorAll(".mlq-oneline")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("en ui:", JSON.stringify(en, null, 2));

// 填数看英文提示
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
await sleep(1200);
const enHint = await page.evaluate(() => [...document.querySelectorAll(".mlq-box-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()));
log("en hint:", JSON.stringify(enHint));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-09-en.png" });

// 后端校验:每箱数量 > 本次打印数量 必须被拒(直连接口,不真的落库)
const guard = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const r = await fetch("/api/px/puLabel/print", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, "Accept-Language": "en" },
    body: JSON.stringify({
      orderNo: "YJ-20261013-01", batchNo: "20261111", prodDate: "",
      lines: [{ 采购订单行id: 4826, 打印数量: 100, 每箱数量: 200 }],
    }),
  });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 400) };
});
log("guard:", JSON.stringify(guard, null, 2));

// 恢复中文界面
await page.evaluate(() => { try { localStorage.setItem("mes_locale", "zh-CN"); } catch (e) {} });
console.log("done");
