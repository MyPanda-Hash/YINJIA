#!/usr/bin/env node
/**
 * 用真实数据模拟「交叉表(横向组头)」渲染结果,核对版式(无浏览器环境下取证)。
 * 与 QcProcInspSheet.vue 的分组/列/行逻辑保持同名同义。
 * 运行: node tools/archive/_qc-proc/verify-crosstab.mjs
 */
const BASE = "http://127.0.0.1:8090";
const MEASURE = ["测量值1", "测量值2", "测量值3", "测量值4", "测量值5"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const isMeasure = (rows) => rows.some((r) => MEASURE.some((m) => {
  const v = String(r[m] ?? "").trim();
  return v !== "" && v !== "0";
}));
const fmt = (v) => {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (s === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(s)) { const n = Number(s); return Number.isFinite(n) ? String(n) : s; }
  return s;
};

(async () => {
  const lr = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456" }),
  });
  const token = (await lr.json()).data.token;
  const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  // 找一张有明细的单据,取它的头 + 明细(明细在 descriptor 的 detailData.items)
  const lst = await (await fetch(BASE + "/api/px/queryFormDataList", {
    method: "POST", headers: H,
    body: JSON.stringify({ panelCode: "QC_PROC_INSP", pageNo: 1, pageSize: 20, condition: {} }),
  })).json();
  const nos = (lst.data?.list || []).map((x) => x["单据编号"]);
  let doc = {}, rows = [], picked = "";
  for (const no of nos) {
    const one = await (await fetch(BASE + "/api/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=" + encodeURIComponent(no), { headers: H })).json();
    const r = one.data?.detailData?.items || [];
    if (r.length) { doc = one.data?.data || {}; rows = r; picked = no; break; }
  }
  console.log("验证单据=" + picked);
  console.log("明细行数=" + rows.length);
  if (!rows.length) { console.log("(取不到明细)"); return; }

  // ── 分组(与组件同逻辑) ──
  const order = [], map = new Map();
  for (const r of rows) {
    const s = String(r["表区"] ?? "").trim();
    if (!s) continue;
    if (!map.has(s)) { map.set(s, []); order.push(s); }
    map.get(s).push(r);
  }
  const groups = order.map((s, i) => {
    const rs = map.get(s);
    const meas = isMeasure(rs);
    const cols = meas
      ? [{ k: "项目", label: "项目" }].concat(MEASURE.map((m) => ({ k: m, label: m, prop: m })))
      : rs.map((r, j) => ({ k: "i" + j, label: String(r["检验项目"] || ""), itemIdx: j }));
    return { sector: s, title: (LETTERS[i] || "") + "." + s, cols, rows: rs, measure: meas };
  });
  const rowCount = groups.reduce((n, g) => Math.max(n, g.measure ? g.rows.length : 1), 1);

  // ── 打印交叉表 ──
  const cellRow = (g, c, ri) => g.measure ? (g.rows[ri - 1] || null)
    : (c.itemIdx != null ? g.rows[c.itemIdx] || null : null);
  const cellText = (g, c, ri) => {
    const r = cellRow(g, c, ri);
    if (!r) return "";
    if (g.measure) return fmt(r[c.prop]);
    return fmt(r["实测数值"]) || fmt(r["单项判定"]);
  };

  console.log("\n════ 交叉表(横向组头)渲染结果 ════\n");
  // 第一层表头
  let l1 = "| 产品编码 | 型号（mm) | 批号 | 抽检总量 |";
  for (const g of groups) l1 += ` ${g.title}(跨${g.cols.length}列) |`;
  l1 += " 结果判断 |";
  console.log(l1);
  // 第二层表头
  let l2 = "| (合并) | (合并) | (合并) | (合并) |";
  for (const g of groups) l2 += " " + g.cols.map((c) => c.label).join(" | ") + " |";
  l2 += " (合并) |";
  console.log(l2);
  console.log("-".repeat(l2.length));
  // 数据行
  for (let ri = 1; ri <= rowCount; ri++) {
    let ln = ri === 1
      ? `| ${fmt(doc["产品编码"])} | ${fmt(doc["规格型号"])} | ${fmt(doc["批次号"])} | ${fmt(doc["抽检总量"])} |`
      : "| 〃 | 〃 | 〃 | 〃 |";
    for (const g of groups) {
      const vals = g.cols.map((c) => cellText(g, c, ri) || "·");
      ln += " " + vals.join(" | ") + " |";
    }
    ln += ri === 1 ? ` ${fmt(doc["总结论"])} |` : " 〃 |";
    console.log(ln);
  }
  console.log("\n行数=" + rowCount + "  组数=" + groups.length
    + "  各组列数: " + groups.map((g) => g.title + "=" + g.cols.length).join(", "));
})();
