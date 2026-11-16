const BASE = "http://127.0.0.1:8090";
const login = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ userName:"admin", password:"123456", factory:"YJ_TEST" }) })).json();
if (!login?.data?.token) { console.log("login failed", JSON.stringify(login).slice(0,200)); process.exit(1); }
const token = login.data.token;
for (const panel of ["SALE_IN","MATERIAL_RET"]) {
  const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, { method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify({ panelCode: panel, page: 1, pageSize: 20, filters: {} }) })).json();
  const list = r.data?.list || r.data?.rows || [];
  console.log(panel, "code=", r.code, "行数=", Array.isArray(list) ? list.length : "?", (r.message||"").slice(0,80));
}
const cfg = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=SALE_IN`, { headers: { Authorization: `Bearer ${token}` } })).json();
console.log("SALE_IN config ok=", !!cfg.data, "turnErp button=", JSON.stringify(cfg.data).includes("转ERP"));
