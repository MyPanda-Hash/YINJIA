const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

await page.goto("http://127.0.0.1:8090/#/panelx/list/PROD_RET_LIST", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();

// 会话可能已失效(换了进程) ⇒ 需要时重登
const need = await page.evaluate(() => location.hash.includes("/login"));
console.log("NEED_LOGIN " + need);
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ins = [...document.querySelectorAll("input")];
    const a = ins.find((i) => (i.placeholder || "").includes("登录账号") || (i.placeholder || "").includes("账号"));
    const p = ins.find((i) => (i.placeholder || "").includes("登录密码") || (i.placeholder || "").includes("密码"));
    if (a) setVal(a, "admin");
    if (p) setVal(p, "123456");
  });
  await page.waitForTimeout(600);
  await page.click("text=进入系统", { label: "login 8090", timeout: 15000 }).catch((e) => console.log("login: " + e.message));
  await page.waitForTimeout(8000);
  await page.goto("http://127.0.0.1:8090/#/panelx/list/PROD_RET_LIST", { timeout: 40000 });
  await page.waitForTimeout(6000);
  await restore();
}

const st = await page.evaluate(() => ({
  url: location.href,
  hash: location.hash,
  title: document.title,
  headers: [...document.querySelectorAll(".el-table__header th .cell")].map((n) => (n.textContent || "").trim()).filter(Boolean),
  emptyText: (document.querySelector(".el-table__empty-text")?.textContent || "").trim(),
  bodyHead: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 420),
}));
console.log("8090_PROD_RET_LIST " + JSON.stringify(st, null, 2));

// 左导航叶子(打包版)
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".nav-group")].find((n) => (n.textContent || "").includes("WMS管理"));
  if (g) g.click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const m = [...document.querySelectorAll(".nav-module")].find((n) => (n.textContent || "").includes("库存核算"));
  if (m) { m.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); m.click(); }
});
await page.waitForTimeout(1800);
await restore();
const nav = await page.evaluate(() => {
  const g = document.querySelector(".fly-card .card-group");
  return g ? [...g.querySelectorAll(".card-item")].map((i) => (i.textContent || "").trim()) : [];
});
console.log("8090_NAV " + JSON.stringify(nav));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-12-8090-ret.png" });
console.log("DONE");
