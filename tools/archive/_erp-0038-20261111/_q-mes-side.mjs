const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
const po = await post("/px/queryFormDataList", { panelCode: "PU_ORDER", condition: {}, keyword: "YJ-20261103-07", pageNo: 1, pageSize: 5 }, t);
console.log("=== MES 采购订单 YJ-20261103-07 totalSize=" + po.totalSize + " ===");
for (const r of (po.list||[])) {
  console.log(["单据编号","单据日期","供应商","单据状态","ERP单号"].map(k=>k+"="+(r[k]??"")).join(" | "));
  for (const x of ((r.detail&&r.detail.items)||[])) console.log("   行: 存货编码=" + x["存货编码"] + " 数量=" + x["数量"] + " 计量单位=" + x["计量单位"] + " 行号=" + (x["行号"]??"") + " 单价=" + (x["单价"]??""));
}
const sl = await post("/px/queryFormDataList", { panelCode: "QC_RECV", condition: {}, keyword: "SL-2026-11-0032", pageNo: 1, pageSize: 5 }, t);
console.log("\n=== 送料暂收单 SL-2026-11-0032 totalSize=" + sl.totalSize + " ===");
for (const r of (sl.list||[])) {
  console.log(["单号","单据编号","单据日期","供应商","采购订单号","批次号"].map(k=>k+"="+(r[k]??"")).join(" | "));
  for (const x of ((r.detail&&r.detail.items)||[])) console.log("   行: " + JSON.stringify(x));
}
