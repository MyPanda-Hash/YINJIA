const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  return await res.json();
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.data.token;
const res = await fetch(BASE + "/sys/usageLog?start=2026-11-11&end=2026-11-12&size=15&page=1", { headers: { Authorization: "Bearer " + t } });
const j = await res.json();
console.log("total=" + j.data.total);
for (const r of j.data.rows) console.log(r.createdAt + " | " + r.userName + " | " + (r.panelName||"-") + " | " + r.actionName + " | " + (r.docNo||"-"));
console.log("\n=== 两张待转单当前状态 ===");
const d = await post("/px/queryFormDataList", { panelCode: "PURCHASE_IN", condition: {}, keyword: "PI-2026-11-0019", pageNo: 1, pageSize: 3 }, t);
for (const r of (d.data.list||[])) console.log(JSON.stringify({ 单据编号: r["单据编号"], 是否已转ERP: r["是否已转ERP"], ERP单号: r["ERP单号"], 单据状态: r["单据状态"], 采购订单号: r["采购订单号"] }));
