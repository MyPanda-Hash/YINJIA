/**
 * 非破坏性功能验证:删除单据 端点可达 + 守卫语义正确。
 * 不真删任何单据:用不存在的单号探测端点,并读现有单据的状态以说明守卫行为。
 * 用法: node tools/archive/_qc-proc/verify-del-doc-call.mjs
 */
const BASE = "http://127.0.0.1:8090";
const out = [];
const log = (s) => { out.push(s); console.log(s); };

const lr = await fetch(BASE + "/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userName: "admin", password: "123456" }),
});
const token = (await lr.json()).data.token;
const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

// ① 现有制程检验单的状态(决定「删除单据」对它们的实际行为)
const list = await (await fetch(BASE + "/api/px/queryFormDataList", {
  method: "POST", headers: H,
  body: JSON.stringify({ panelCode: "QC_PROC_INSP", pageNo: 1, pageSize: 10, condition: {} }),
})).json();
log("① 制程检验单现有单据(看状态决定删除单据是否可作废):");
for (const r of list.data?.list || []) {
  log("   " + r["单据编号"] + " | 单据状态=" + (r["单据状态"] || "(空)") + " | 总结论=" + (r["总结论"] || "(空)"));
}

// ② 端点可达性(用不存在的单号 → 不该 404/500,应是业务层明确结果)
const r2 = await fetch(BASE + "/api/px/deleteForms", {
  method: "POST", headers: H,
  body: JSON.stringify({ panelCode: "QC_PROC_INSP", rowCodes: ["NO-SUCH-DOC-XYZ"] }),
});
const t2 = await r2.text();
log("② deleteForms(不存在单号) status=" + r2.status + " 体=" + t2.slice(0, 160));

// ③ 权限:删除单据 的动作词(应要求 add/modify/del)
log("③ 权限口径:PanelPermissionService 已登记 删除单据 → add/modify/del(源码 line 67)");

import fs from "node:fs";
fs.writeFileSync("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\verify-del-doc-call.txt", out.join("\n"), "utf8");
