/**
 * 验证「制程检验单按产品编码取出货检验计划内容」。
 * 用法: node tools/archive/_qc-proc/verify-ship-plan.mjs [baseUrl]
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
if (!token) { console.log("登录失败(服务未就绪)"); process.exit(1); }
log("① 登录成功");
const H = { Authorization: "Bearer " + token };

// ② 面板上是否有「取出货检验计划」按钮 + 「检查频率」字段
const cfg = await (await fetch(BASE + "/api/px/getPanelConfig?panelCode=QC_PROC_INSP", { headers: H })).json();
const acts = (cfg.data?.metadata?.buttonGroups || []).flatMap((g) => g.actions || []);
log("② 制程检验单按钮含「取出货检验计划」=" + acts.includes("取出货检验计划"));
log("   按钮序: " + acts.slice(0, 21).join(" | "));
const df = (cfg.data?.detail?.tabs?.[0]?.fields || []).find((f) => f.dataName === "检查频率");
log("   检查频率字段: " + (df ? `存在 dataType=${df.dataType} options=${JSON.stringify(df.options || null)}` : "❌ 缺失"));

// ③ 正常取计划
const r1 = await fetch(BASE + "/api/qc/inspPlan/fromShipPlan?productCode=C-84-02", { headers: H });
const d1 = (await r1.json()).data || {};
log("③ fromShipPlan(C-84-02) status=" + r1.status + " planNo=" + d1.planNo + " rows=" + (d1.rows || []).length);
for (const row of d1.rows || []) {
  log("     [表区=" + row["表区"] + "] " + row["检验项目"] + " | 要求=" + row["检验要求"]
    + " | 方法=" + (row["检验方法"] || "").slice(0, 12) + " | 频率=" + row["检查频率"]
    + " | 仪器=" + row["检验仪器"]);
}

// ④ 边界:未知产品
const r2 = await fetch(BASE + "/api/qc/inspPlan/fromShipPlan?productCode=NO-SUCH-PROD", { headers: H });
const d2 = (await r2.json()).data || {};
log("④ 未知产品 status=" + r2.status + " planNo=" + d2.planNo + " rows=" + (d2.rows || []).length);

// ⑤ 边界:空产品编码
const r3 = await fetch(BASE + "/api/qc/inspPlan/fromShipPlan?productCode=", { headers: H });
const j3 = await r3.json();
log("⑤ 空产品编码 status=" + r3.status + " code=" + j3.code + " msg=" + j3.message);

// ⑥ 回归:既有「检验项目/检验方案」仍可用
const r4 = await fetch(BASE + "/api/qc/inspPlan/items?planCode=QP-CARBON-ROD", { headers: H });
const items = (await r4.json()).data || [];
log("⑥ 既有标准库 items(QP-CARBON-ROD) status=" + r4.status + " 行数=" + items.length);
const r5 = await fetch(BASE + "/api/qc/inspPlan/plans", { headers: H });
log("   既有 plans status=" + r5.status + " 方案数=" + ((await r5.json()).data || []).length);

import fs from "node:fs";
fs.writeFileSync("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\verify-ship-plan.txt", out.join("\n"), "utf8");
