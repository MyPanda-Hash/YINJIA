#!/usr/bin/env node
/**
 * 用真实数据模拟「按表区纵向分区」的渲染结果,验证逻辑正确(不依赖浏览器)。
 * 从 8090 拉制程检验单 ZC-2026-10-0001 的明细,跑与前端同名的算法,打印分区结果。
 * 运行: node tools/archive/_qc-proc/verify-sections.mjs
 */
const BASE = "http://127.0.0.1:8090";

// ── 与 PanelxList.vue 同名同逻辑的实现 ──
function sectorOrder(rows) {
  const out = [];
  for (const r of rows) {
    const v = String(r["表区"] ?? "").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
function sectorLetter(order, sector) {
  const i = order.indexOf(sector);
  if (i < 0) return "";
  let n = i, s = "";
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0);
  return s;
}
function sectionCols(allCols, rows) {
  const out = [];
  for (const prop of allCols) {
    if (prop === "表区" || prop === "行号") continue;
    const hasVal = rows.some((r) => {
      const v = r[prop];
      return v !== undefined && v !== null && String(v).trim() !== "";
    });
    if (hasVal) out.push(prop);
  }
  return out;
}

(async () => {
  const lr = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456" }),
  });
  const token = (await lr.json()).data.token;
  const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  // 明细列(全量,照 archCols)
  const cfg = await (await fetch(BASE + "/api/px/getPanelConfig?panelCode=QC_PROC_INSP", { headers: H })).json();
  const allCols = (cfg.data?.detail?.tabs?.[0]?.fields || []).map((f) => f.dataName);
  console.log("面板明细列(" + allCols.length + "): " + allCols.join(", "));

  // 单据明细
  const doc = await (await fetch(BASE + "/api/px/queryFormDataList", {
    method: "POST", headers: H,
    body: JSON.stringify({ panelCode: "QC_PROC_INSP", pageNo: 1, pageSize: 5, condition: {} }),
  })).json();
  const list = doc.data?.list || [];
  if (!list.length) { console.log("无单据"); return; }
  const no = list[0]["单据编号"];

  // 取明细(用面板的 doc 接口)
  const one = await (await fetch(BASE + "/api/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=" + encodeURIComponent(no), { headers: H })).json();
  let rows = one.data?.detail?.items || one.data?.["detail"]?.items || [];
  if (!rows.length) {
    // 退化:直接从列表行的 detail 取
    const r2 = await (await fetch(BASE + "/api/px/queryFormDataList", {
      method: "POST", headers: H,
      body: JSON.stringify({ panelCode: "QC_PROC_INSP", pageNo: 1, pageSize: 1, condition: {}, withDetail: true }),
    })).json();
    const row = (r2.data?.list || [])[0];
    rows = row?.detail?.items || [];
  }
  console.log("\n单据 " + no + " 明细行数=" + rows.length);
  if (!rows.length) { console.log("(取不到明细,跳过)"); return; }

  // ── 分区 ──
  const order = sectorOrder(rows);
  const byCat = new Map();
  for (const r of rows) {
    const v = String(r["表区"] ?? "").trim();
    if (!v) continue;
    if (!byCat.has(v)) byCat.set(v, []);
    byCat.get(v).push(r);
  }
  console.log("\n════ 分区渲染结果(与页面一致) ════");
  for (const s of order) {
    const rs = byCat.get(s);
    if (!rs || !rs.length) continue;
    const letter = sectorLetter(order, s);
    const cols = sectionCols(allCols, rs);
    console.log("\n【" + letter + "." + s + "】 " + rs.length + " 行, " + cols.length + " 列");
    console.log("   列头: " + cols.join(" | "));
    rs.forEach((r, i) => {
      const vals = cols.map((c) => {
        const v = r[c];
        return (v === undefined || v === null || String(v).trim() === "") ? "—" : String(v).slice(0, 14);
      });
      console.log("   " + (i + 1) + ". " + vals.join(" | "));
    });
  }
})();
