const BASE = "http://127.0.0.1:8091";
const login = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ userName:"admin", password:"123456", factory:"YJ_TEST" }) })).json();
const token = login.data.token;
for (const panel of ["MATERIAL_RET","SALE_IN"]) {
  const r = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${panel}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const cfg = r.data || r;
  const detailCols = JSON.stringify(cfg).match(/主单位|数量\(主单位\)|材料规格|明细\.生产车间/g) || [];
  console.log(panel, "config keys:", Object.keys(cfg||{}).join(","), "| 命中列:", JSON.stringify(detailCols));
  const dump = JSON.stringify(cfg);
  const i = dump.indexOf("主单位");
  if (i > 0) console.log("  上下文:", dump.slice(Math.max(0,i-200), i+120));
}
