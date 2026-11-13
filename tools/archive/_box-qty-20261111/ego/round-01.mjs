// round-01:登录(YJ_TEST 测试库)→ 采购订单 → 选中一行 → 打印 → 打印材料码 → 量弹窗/列/横滚
const task = await taskSpace("material-label-box-qty-20261111");
console.log({ spaceId: task.spaceId });
const page = task.page("p1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

await page.goto("http://localhost:5173/#/login", { timeout: 40000 });
await page.waitForSelector(".el-input__inner", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

// ① 选登录工厂 = 测试库(打印会落库,一律走测试账套)
const factoryInfo = await page.evaluate(() => ({
  selects: [...document.querySelectorAll(".el-select")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
  inputs: [...document.querySelectorAll("input")].map((i) => i.placeholder || i.type),
}));
console.log("login form:", JSON.stringify(factoryInfo));

// 打开工厂下拉,列出选项
await page.evaluate(() => {
  const sel = [...document.querySelectorAll(".el-select")].find((s) => /登录工厂|YINJIA/.test(s.textContent || ""));
  (sel || document.querySelector(".el-select"))?.click();
});
await page.waitForTimeout(900);
const opts = await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].map((e) => (e.textContent || "").trim()));
console.log("factory options:", JSON.stringify(opts));
const target = opts.find((o) => /测试/.test(o)) || opts[0];
await page.evaluate((label) => {
  const item = [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => (e.textContent || "").trim() === label);
  item?.click();
}, target);
await page.waitForTimeout(700);

// ② 账号密码 + 进入系统
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
await page.waitForTimeout(500);
await page.click("text=进入系统", { label: "login" }).catch((e) => console.log("click login: " + e.message));
await page.waitForTimeout(6000);
const afterLogin = await page.evaluate(() => ({ url: location.href, hash: location.hash, text: (document.body.innerText || "").slice(0, 120) }));
console.log("after login:", JSON.stringify(afterLogin));

// ③ 采购订单面板
await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER", { timeout: 40000 });
await page.waitForSelector(".el-table__row", { timeout: 60000 }).catch(() => console.log("no rows yet"));
await page.waitForTimeout(3000);
const panel = await page.evaluate(() => ({
  rows: document.querySelectorAll(".el-table__body .el-table__row").length,
  firstRow: (document.querySelector(".el-table__body .el-table__row")?.textContent || "").replace(/\s+/g, " ").slice(0, 160),
  groups: [...document.querySelectorAll(".tb-group .tb-main")].map((e) => (e.textContent || "").trim()),
}));
console.log("panel:", JSON.stringify(panel));

// 选中第一行
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { const td = r.querySelector("td"); td?.click(); r.click(); }
});
await page.waitForTimeout(1200);

// ④ 打印下拉 → 打印材料码
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-caret")?.click();
});
await page.waitForTimeout(900);
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tb-menu *, .el-dropdown-menu__item")]
    .filter((e) => e.children.length === 0 && (e.textContent || "").trim() === "打印材料码")[0];
  if (!t) return false;
  t.click();
  return true;
});
console.log("clicked 打印材料码:", clicked);

const opened = await page.waitForSelector(".mlq", { timeout: 30000 }).then(() => true).catch(() => false);
console.log("dialog opened:", opened);
await page.waitForTimeout(2500);
await norm();

if (opened) {
  const info = await page.evaluate(() => {
    const dlg = document.querySelector(".el-dialog");
    const body = document.querySelector(".el-dialog__body");
    const wrap = document.querySelector(".mlq .el-table__body-wrapper .el-scrollbar__wrap")
      || document.querySelector(".mlq .el-table__body-wrapper");
    const head = [...document.querySelectorAll(".mlq .el-table__header th")].map((t) => (t.textContent || "").trim());
    const rows = [...document.querySelectorAll(".mlq .el-table__body .el-table__row")].map((r) =>
      [...r.querySelectorAll("td")].map((td) => (td.textContent || "").replace(/\s+/g, " ").trim()));
    return {
      dialogWidth: dlg ? Math.round(dlg.getBoundingClientRect().width) : 0,
      winWidth: window.innerWidth,
      winHeight: window.innerHeight,
      bodyScrollH: body ? body.scrollHeight : 0,
      bodyClientH: body ? body.clientHeight : 0,
      tableHScroll: wrap ? { scrollW: wrap.scrollWidth, clientW: wrap.clientWidth } : null,
      head,
      rowCount: rows.length,
      firstRows: rows.slice(0, 3),
      boxHints: document.querySelectorAll(".mlq-box-hint").length,
      title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
    };
  });
  console.log("dialog:", JSON.stringify(info, null, 2));
  await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-01-dialog.png" });
  console.log("shot ok");
}
