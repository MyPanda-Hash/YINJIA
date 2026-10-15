/**
 * 验证「选生产工单 → 生成制程检验单」(2026-10-15)。
 * 用法: node tools/archive/_qc-proc/verify-wo-picker.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:8090";
const out = [];
const log = (s) => { out.push(s); console.log(s); };

async function login() {
  for (let i = 0; i < 25; i++) {
    try {
      const r = await fetch(BASE + "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: "admin", password: "123456" }),
      });
      const j = await r.json();
      if (j.data && j.data.token) return j.data.token;
    } catch { /* 未就绪 */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

const token = await login();
if (!token) { console.log("服务未就绪"); process.exit(1); }
log("① 登录成功");
const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

// ② 按钮门面
const cfg = await (await fetch(BASE + "/api/px/getPanelConfig?panelCode=QC_PROC_INSP", { headers: H })).json();
const acts = (cfg.data?.metadata?.buttonGroups || []).flatMap((g) => g.actions || []);
log("② QC_PROC_INSP 含「选生产工单」=" + acts.includes("选生产工单"));
log("   按钮序: " + acts.slice(14, 22).join(" | "));
const hf = (cfg.data?.header?.tabs?.[0]?.fields || []).concat(cfg.data?.dataSchema?.fields || []);
log("   数据契约含 工单行号=" + JSON.stringify(cfg.data?.dataSchema?.fields || []).includes("工单行号"));

// ③ 工单行列表
const r1 = await fetch(BASE + "/api/qc/procInsp/woLines?pageNo=1&pageSize=5", { headers: H });
const d1 = (await r1.json()).data || {};
log("③ /woLines status=" + r1.status + " total=" + d1.totalSize + " 本页=" + (d1.list || []).length);
for (const w of (d1.list || []).slice(0, 3)) {
  log(`     ${w["工单号"]} #${w["工单行号"]} | ${w["产品编码"]} | ${w["产品名称"]} | 批次=${w["批次号"]} | 线=${w["生产线"]} | 排产=${w["排产数量"]} | 已建=${w["已建单号"] || "-"}`);
}
const first = (d1.list || [])[0];

// ④ 关键字过滤
const r2 = await fetch(BASE + "/api/qc/procInsp/woLines?keyword=" + encodeURIComponent(first["产品编码"]) + "&pageNo=1&pageSize=5", { headers: H });
const d2 = (await r2.json()).data || {};
log(`④ /woLines 关键字=${first["产品编码"]} → total=${d2.totalSize}(应 ≥1 且都含该编码)`);
log("   命中: " + (d2.list || []).map((w) => w["工单号"] + "#" + w["工单行号"] + ":" + w["产品编码"]).join(", "));

// ⑤ 建单 + 幂等
const post = async () => (await (await fetch(BASE + "/api/qc/procInsp/fromWoLine", {
  method: "POST", headers: H, body: JSON.stringify({ 工单号: first["工单号"], 工单行号: first["工单行号"] }),
})).json());

const g1 = await post();
log("⑤ 首次生成 status=ok 编号=" + g1.data?.["编号"] + " 已存在=" + g1.data?.["已存在"] + " gotoPanel=" + g1.data?.["gotoPanel"]);
const g2 = await post();
log("   二次生成 编号=" + g2.data?.["编号"] + " 已存在=" + g2.data?.["已存在"]
  + " → 幂等 " + (g2.data?.["编号"] === g1.data?.["编号"] ? "✓ 同一张" : "✗ 又建了一张"));

// ⑥ 落库校验(重点:工单行号 不再被静默丢弃)
const no = g1.data?.["编号"];
const fd = await (await fetch(BASE + "/api/px/getFormDescriptor?panelCode=QC_PROC_INSP&code=" + no, { headers: H })).json();
const h = fd.data?.data || {};
log("⑥ 表头落库: 工单号=" + h["工单号"] + " 工单行号=" + h["工单行号"] + " 产品编码=" + h["产品编码"]
  + " 产品名称=" + h["产品名称"] + " 规格型号=" + h["规格型号"] + " 批次号=" + h["批次号"]
  + " 生产线=" + h["生产线"] + " 生产车间=" + h["生产车间"] + " 检验类别=" + h["检验类别"] + " 检验员=" + h["检验员"]);
log("   明细行数=" + ((fd.data?.detailData?.items) || []).length + "(应 0)");
log("   ✔ 工单行号 落库=" + (String(h["工单行号"] || "") !== "" ? "是" : "否(仍被丢弃!)"));

// ⑦ 边界:不存在的工单行 / 缺参
const r7 = await fetch(BASE + "/api/qc/procInsp/fromWoLine", {
  method: "POST", headers: H, body: JSON.stringify({ 工单号: "MO-NO-SUCH", 工单行号: 999 }),
});
const j7 = await r7.json();
log("⑦ 不存在工单行 status=" + r7.status + " code=" + j7.code + " msg=" + j7.message);
const r8 = await fetch(BASE + "/api/qc/procInsp/fromWoLine", {
  method: "POST", headers: H, body: JSON.stringify({}),
});
const j8 = await r8.json();
log("   缺参 status=" + r8.status + " code=" + j8.code + " msg=" + j8.message);

import fs from "node:fs";
fs.writeFileSync("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\verify-wo-picker.txt", out.join("\n"), "utf8");
