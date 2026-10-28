const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });

// 直接问后端配置接口:两格到底下发成什么(参照 / 下拉 / alias)
const cfg = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || localStorage.getItem("token") || "";
  const r = await fetch("/api/px/panelConfig?panelCode=RD_MOLD_PROC", { headers: { Authorization: "Bearer " + tk } });
  const j = await r.json();
  const d = j?.data || {};
  const fields = d.fields || d.headerFields || [];
  const pick = fields.filter((f) => ["产品管控类型", "产品管控等级", "外观要求", "产品形态"].includes(f.label || f.colName || f.key));
  return { total: fields.length, pick: pick.map((f) => ({ label: f.label, colName: f.colName, alias: f.alias, dataType: f.dataType, refPanel: f.refPanel, refField: f.refField, stdLib: f.stdLib })) };
});
console.log("CFG_TOTAL=" + cfg.total);
console.log("CFG_PICK=" + JSON.stringify(cfg.pick, null, 1));

// 纸面上这两格的实际渲染形态
const cells = await page.evaluate(() => {
  const out = [];
  const tds = [...document.querySelectorAll("td")];
  for (const td of tds) {
    const t = (td.textContent || "").trim();
    if (["产品管控类型", "产品管控等级", "产品形态"].includes(t)) {
      const next = td.nextElementSibling;
      out.push({
        label: t,
        valueCellHtml: next ? next.innerHTML.slice(0, 240) : "",
        hasRefCtl: !!(next && next.querySelector(".rs-ref-ctl")),
        hasSelect: !!(next && next.querySelector(".el-select")),
      });
    }
  }
  return out;
});
console.log("CELLS=" + JSON.stringify(cells, null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-03.json", JSON.stringify({ cfg, cells }, null, 2), "utf8");
await task.finish({ keep: [] });
