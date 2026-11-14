const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
for (const [panel, kw] of [["QC_RECV","SL-2026-11-0014"],["QC_INSP","IJ-2026-11-"],["QC_INSP","PI-2026-11-0019"]]) {
  const d = await post("/px/queryFormDataList", { panelCode: panel, condition: {}, keyword: kw, pageNo: 1, pageSize: 20 }, t);
  console.log("\n=== " + panel + " keyword=" + kw + " totalSize=" + d.totalSize + " ===");
  for (const r of (d.list||[]).slice(0,8)) {
    console.log(["单号","单据编号","单据日期","供应商","采购订单号","来源单号","单据状态","检验结论"].map(k=>k+"="+(r[k]??"")).join(" | "));
    for (const x of ((r.detail&&r.detail.items)||[]).slice(0,4)) console.log("    行: " + JSON.stringify(x).slice(0,300));
  }
}
