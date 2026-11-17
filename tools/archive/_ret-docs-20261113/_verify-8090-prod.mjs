const BASE = "http://127.0.0.1:8090";
const login = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ userName:"admin", password:"123456", factory:"YJ" }) })).json();
const token = login.data.token;
for (const panel of ["SALE_IN","MATERIAL_RET","SALE_IN_DETAIL","SALE_IN_STATS","MATERIAL_RET_DETAIL","MATERIAL_RET_STATS"]) {
  const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, { method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
    body: JSON.stringify({ panelCode: panel, page: 1, pageSize: 5, filters: {} }) })).json();
  const list = r.data?.list || r.data?.rows || [];
  console.log(panel.padEnd(20), "code=", r.code, "行数=", Array.isArray(list) ? list.length : "?");
}
