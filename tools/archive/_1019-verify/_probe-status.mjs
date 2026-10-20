const BASE = "http://127.0.0.1:8090"
const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const t = login.data.token
const r = await (await fetch(BASE + "/api/px/queryFormDataList", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ panelCode: "STOCK_STATUS", condition: { 仓库: "恒亿仓" }, pageNo: 1, pageSize: 5 }) })).json()
console.log((r.message || "").slice(0, 900))
