const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
for (const p of ["PURCHASE_IN", "QC_RETURN", "PU_ORDER", "SALE_OUT", "MATERIAL_OUT", "FINISH_IN", "OTHER_IN", "OTHER_OUT"]) {
  try {
    const d = await post("/px/callButton", { panelCode: p, buttonName: "查询可转ERP", formData: {}, buttonParam: {} }, t);
    console.log("\n=== " + p + " 可转 " + (d && d.count) + " 张 ===");
    for (const r of ((d && d.list) || []).slice(0, 12)) console.log("   " + [r["单据编号"], r["单据日期"], r["往来单位"]].join(" | "));
  } catch (e) { console.log("\n=== " + p + " 查询失败: " + e.message); }
}
