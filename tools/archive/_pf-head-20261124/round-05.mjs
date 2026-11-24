const OUT = "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-projectflow-head-20261124";

const task = await taskSpace("yinjia projectflow head");
const page = task.page("p1");

await page.goto("http://localhost:5173/#/rd/projectFlow", { timeout: 20000 });
await page.waitForSelector(".pf-kpis", { timeout: 20000 });
await page.waitForFunction(() => document.querySelectorAll(".pf-kpi").length > 0, undefined, { timeout: 15000 }).catch(() => {});

const info = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const rect = (s) => {
    const e = q(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const txt = document.body.innerText;
  return {
    url: location.href,
    pageTitle: document.title,
    head: !!q(".pf-head"),
    title: !!q(".pf-title"),
    sub: !!q(".pf-sub"),
    source: !!q(".pf-source"),
    oldHintInText: txt.includes("按立项申请单号查这条项目走到哪一步"),
    oldSourceInText: txt.includes("数据来源：立项申请"),
    kpiCount: document.querySelectorAll(".pf-kpi").length,
    kpiLabels: Array.from(document.querySelectorAll(".pf-kpi-label")).map((e) => e.innerText.trim()),
    kpisRect: rect(".pf-kpis"),
    barRect: rect(".pf-bar"),
    cardRect: rect(".pf-card"),
    tableRows: document.querySelectorAll(".pf-table .el-table__row").length,
    firstKpiTop: (() => {
      const e = q(".pf-kpi");
      return e ? Math.round(e.getBoundingClientRect().top) : null;
    })(),
    pageTopPad: (() => {
      const e = q(".pf-page");
      if (!e) return null;
      const cs = getComputedStyle(e);
      return { padding: cs.padding, firstChild: e.firstElementChild && e.firstElementChild.className };
    })(),
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    tabs: Array.from(document.querySelectorAll("[class*='tab']"))
      .map((e) => (e.innerText || "").trim())
      .filter((t) => t && t.length < 24)
      .slice(0, 10),
  };
});

await page.screenshot({ path: OUT + "/round-05.png", fullPage: true });
await page.screenshot({ path: OUT + "/round-05-viewport.png" });
console.log(JSON.stringify({ taskSpaceId: task.spaceId, page: page.label, info }, null, 2));
