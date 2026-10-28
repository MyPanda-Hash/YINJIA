const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const cfg = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || localStorage.getItem("token") || "";
  const r = await fetch("/api/px/getPanelConfig?panelCode=RD_MOLD_PROC", { headers: { Authorization: "Bearer " + tk } });
  const j = await r.json();
  const d = j?.data || {};
  const all = [];
  const walk = (arr) => (arr || []).forEach((f) => all.push(f));
  walk(d.headerFields);
  walk(d.detailFields);
  walk(d.fields);
  const want = ["产品管控类型", "产品管控等级", "外观要求", "产品形态"];
  const pick = all.filter((f) => want.includes(f.label) || want.includes(f.colName));
  return {
    status: r.status,
    topKeys: Object.keys(d),
    total: all.length,
    pick: pick.map((f) => ({
      label: f.label, colName: f.colName, alias: f.alias,
      dataType: f.dataType, refPanel: f.refPanel, refField: f.refField,
      optionsLen: (f.options || []).length,
    })),
  };
});
console.log("STATUS=" + cfg.status + " TOP=" + JSON.stringify(cfg.topKeys) + " TOTAL=" + cfg.total);
console.log("PICK=" + JSON.stringify(cfg.pick, null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-04.json", JSON.stringify(cfg, null, 2), "utf8");
await task.finish({ keep: [] });
