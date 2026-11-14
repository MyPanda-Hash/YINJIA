const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  return j;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.data.token;
console.log("=== 对已转的 PI-2026-11-0038 点一次 转ERP(预期:命中「已转」守卫,不推金蝶) ===");
const r = await post("/px/callButton", { panelCode: "PURCHASE_IN", buttonName: "转ERP", formData: { 编号: "PI-2026-11-0038", 单据编号: "PI-2026-11-0038" }, buttonParam: {} }, t);
console.log(JSON.stringify(r, null, 1));
