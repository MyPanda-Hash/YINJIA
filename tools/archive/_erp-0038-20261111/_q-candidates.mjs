const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
for (const no of ["CGRK-20260916-03218", "PI-2026-11-0019"]) {
  const d = await post("/px/queryFormDataList", { panelCode: "PURCHASE_IN", condition: {}, keyword: no, pageNo: 1, pageSize: 5 }, t);
  const r = (d.list||[]).find(x => x["单据编号"] === no);
  console.log("\n=== " + no + " ===");
  if (!r) { console.log("未查到"); continue; }
  console.log(["单据编号","单据日期","供应商","采购订单号","来源单号","来源单据","批次号","是否已转ERP","ERP单号","转ERP时间","单据状态","外部单据号"].map(k=>k+"="+(r[k]??"")).join(" | "));
  for (const x of ((r.detail&&r.detail.items)||[])) console.log("   行: " + JSON.stringify(x).slice(0, 400));
}
