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
  const push = (arr) => Array.isArray(arr) && arr.forEach((f) => all.push(f));
  push(d.metadata); push(d.metadata?.fields); push(d.dataSchema); push(d.dataSchema?.fields);
  push(d.detail?.tabs); push(d.detail?.headerFields); push(d.detail?.fields);
  // 深挖一层:把含 label 的对象都收集
  const rec = (o, depth) => {
    if (!o || depth > 4) return;
    if (Array.isArray(o)) return o.forEach((x) => rec(x, depth + 1));
    if (typeof o === "object") {
      if (typeof o.label === "string" && (o.dataType || o.colName || o.refPanel)) all.push(o);
      Object.values(o).forEach((v) => rec(v, depth + 1));
    }
  };
  rec(d, 0);
  const want = ["产品管控类型", "产品管控等级", "外观要求", "产品形态"];
  const seen = new Set();
  const pick = [];
  for (const f of all) {
    const k = (f.label || "") + "|" + (f.colName || "");
    if (seen.has(k)) continue;
    if (want.includes(f.label) || want.includes(f.colName)) {
      seen.add(k);
      pick.push({
        label: f.label, colName: f.colName, alias: f.alias,
        dataType: f.dataType, refPanel: f.refPanel, refField: f.refField,
        optionsLen: (f.options || []).length, hasRefMap: !!(f.refMap && f.refMap.length),
      });
    }
  }
  return { status: r.status, metas: Object.keys(d), pick };
});
console.log("STATUS=" + cfg.status + " METAS=" + JSON.stringify(cfg.metas));
console.log("PICK=" + JSON.stringify(cfg.pick, null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-05.json", JSON.stringify(cfg, null, 2), "utf8");
await task.finish({ keep: [] });
