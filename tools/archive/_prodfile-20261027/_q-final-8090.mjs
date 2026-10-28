const task = await taskSpace("prodfile-8090-20261027");
const page = task.page("p1");

const BASE = "http://127.0.0.1:8090/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 30000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  // 只看**纸张表头格**(rs-label 的 td),排除左侧菜单/工具栏等其它文案
  const labels = [...document.querySelectorAll("td.rs-label, td.rs-th, th.rs-th")]
    .map((e) => (e.textContent || "").trim()).filter(Boolean);
  const uniq = [...new Set(labels)];
  return {
    labelCells: uniq.filter((x) => /管控|形态|外观/.test(x)),
    allLabelCount: uniq.length,
    // 再核一次配置接口(排除"前端调的是另一个接口"这条)
  };
});
console.log("LABELS=" + JSON.stringify(out, null, 1));

const api = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || "";
  const r = await fetch("/api/px/getPanelConfig?panelCode=RD_MOLD_PROC", { headers: { Authorization: "Bearer " + tk } });
  const txt = await r.text();
  const i = txt.indexOf("产品管控");
  return {
    status: r.status,
    hasCtrlLevel: txt.includes("产品管控等级"),
    hasCtrlType: txt.includes("产品管控类型"),
    ctx: i >= 0 ? txt.slice(i - 60, i + 200) : "",
  };
});
console.log("API=" + JSON.stringify(api, null, 1));

await task.finish({ keep: [] });
