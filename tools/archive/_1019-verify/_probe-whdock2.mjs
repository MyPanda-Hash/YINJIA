const BASE = "http://127.0.0.1:8090"
const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const t = login.data.token
const post = async (body) => (await (await fetch(BASE + "/api/px/queryFormDataList", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) })).json())
const a = await post({ panelCode: "STOCK_DETAIL", condition: {}, pageNo: 1, pageSize: 3 })
console.log("无条件的行 keys:", Object.keys((a.data?.list||[])[0] || {}).join(","))
console.log("样本:", JSON.stringify((a.data?.list||[]).slice(0,2), null, 1).slice(0, 700))
const m = await post({ panelCode: "STOCK_DETAIL", condition: { _whCodes: "YCL-01,CP-02" }, pageNo: 1, pageSize: 50 })
const whs = [...new Set((m.data?.list||[]).map(r => r["仓库编码"]))] 
console.log("多选结果仓库:", JSON.stringify(whs), "共", (m.data?.list||[]).length, "行, totalSize=", m.data?.totalSize)
const n = await post({ panelCode: "STOCK_DETAIL", condition: { 仓库: "恒亿仓" }, pageNo: 1, pageSize: 3 })
console.log("按名称(恒亿仓):", (n.data?.list||[]).length, "行, totalSize=", n.data?.totalSize)
const n2 = await post({ panelCode: "STOCK_DETAIL", condition: { 仓库: "YCL-01" }, pageNo: 1, pageSize: 3 })
console.log("按名称位放编码(YCL-01):", (n2.data?.list||[]).length, "行, totalSize=", n2.data?.totalSize)
