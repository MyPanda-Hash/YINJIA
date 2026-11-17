const BASE = "http://127.0.0.1:8091";
const login = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ userName:"admin", password:"123456", factory:"YJ_TEST" }) })).json();
const token = login.data.token;
for (const panel of ["SALE_IN","MATERIAL_RET"]) {
  const body = { panelCode: panel, page: 1, pageSize: 20, filters: {} };
  const r = await (await fetch(`${BASE}/api/px/queryFormDataList`, { method:"POST",
    headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify(body) })).json();
  const d = r.data || {};
  const list = d.list || d.rows || d.items || [];
  console.log(`\n[${panel}] code=${r.code} msg=${String(r.message||"").slice(0,120)} 行数=${Array.isArray(list)?list.length:"?"} total=${d.total ?? d.count ?? "?"}`);
  if (Array.isArray(list) && list.length) console.log("  首行:", JSON.stringify(list[0]).slice(0, 400));
}
