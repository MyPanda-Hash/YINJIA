import { writeFileSync } from "node:fs";
const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
try {
  const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YJ_TEST" });
  console.log("测试账套登录 OK, factory=", login.user && login.user.factory);
  const d = await post("/px/queryFormDataList", { panelCode: "PURCHASE_IN", condition: {}, keyword: "PI-2026-11-00", pageNo: 1, pageSize: 100 }, login.token);
  console.log("测试账套 PI-2026-11-00* totalSize=" + d.totalSize);
  const keep = ["单据编号","单据日期","供应商","采购订单号","是否已转ERP","ERP单号","转ERP操作人","转ERP时间","单据状态"];
  for (const r of (d.list||[])) console.log(keep.map(k=>k+"="+(r[k]??"")).join(" | "));
} catch (e) { console.log("测试账套查询失败: " + e.message); }
