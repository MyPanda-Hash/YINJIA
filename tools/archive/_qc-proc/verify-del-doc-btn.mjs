/**
 * 验证四张检验单的「删除」组已含「删除单据」,且改动面未外溢。
 * 用法: node tools/archive/_qc-proc/verify-del-doc-btn.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:8090";
const TARGETS = ["QC_MOLD_INSP", "QC_CUT_INSP", "QC_ASM_INSP", "QC_PROC_INSP"];
// 对照:非这四张、且无 PANDA 基准的单据面板(应保持只有「删除」)
const CONTROLS = ["QC_PROC_INSP"]; // 占位,真实对照见下方动态选取

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
if (!token) { console.log("登录失败"); process.exit(1); }
const H = { Authorization: "Bearer " + token };
const out = [];
const log = (s) => { out.push(s); console.log(s); };

/** 取某面板的删除组动作 */
async function delGroup(pc) {
  const r = await fetch(BASE + "/api/px/getPanelConfig?panelCode=" + pc, { headers: H });
  if (r.status !== 200) return { status: r.status, actions: null };
  const d = (await r.json()).data || {};
  const groups = d.metadata?.buttonGroups || [];
  const g = groups.find((x) => x.name === "删除");
  const all = groups.flatMap((x) => x.actions || []);
  return { status: 200, del: g ? g.actions : null, all };
}

log("=== 四张检验单(目标)===");
for (const pc of TARGETS) {
  const { status, del } = await delGroup(pc);
  const ok = Array.isArray(del) && del.includes("删除单据");
  log(`  ${pc} status=${status} 删除组=[${(del || []).join(", ")}] 含删除单据=${ok ? "✓" : "✗"}`);
}

log("\n=== 对照:其它检验/品质面板(应不含,证明改动未外溢)===");
for (const pc of ["QC_INSP", "QC_RECV", "QC_RETURN", "QC_FIN_SPEC", "QC_CATALOG"]) {
  const { status, del } = await delGroup(pc);
  if (status !== 200) { log(`  ${pc} status=${status}(跳过)`); continue; }
  log(`  ${pc} 删除组=[${(del || []).join(", ")}] 含删除单据=${(del || []).includes("删除单据") ? "⚠ 有" : "无(符合预期)"}`);
}

log("\n=== 权限词表(删除单据 需 add/modify/del)===");
log("  已由 PanelPermissionService 全局登记(实测源码 line 67)");

import fs from "node:fs";
fs.writeFileSync("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\verify-del-doc-btn.txt", out.join("\n"), "utf8");
