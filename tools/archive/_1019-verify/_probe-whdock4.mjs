const BASE = "http://127.0.0.1:8090"
const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const t = login.data.token
const post = async (b) => (await (await fetch(BASE + "/api/px/queryFormDataList", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(b) })).json())
const show = async (label, body) => { const r = await post(body); console.log(label, "->", r.code, "total=", r.data?.totalSize, "行=", (r.data?.list||[]).length, r.code !== 200 ? (r.message||"").slice(0,120) : "") }
await show("台账 无条件        ", { panelCode: "STOCK_LEDGER", condition: {}, pageNo: 1, pageSize: 5 })
await show("台账 仓库=恒亿仓    ", { panelCode: "STOCK_LEDGER", condition: { 仓库: "恒亿仓" }, pageNo: 1, pageSize: 5 })
await show("台账 存货=方解石    ", { panelCode: "STOCK_LEDGER", condition: { 存货: "方解石(20-40目）" }, pageNo: 1, pageSize: 5 })
await show("汇总 仓库=恒亿仓    ", { panelCode: "STOCK_SUMMARY", condition: { 仓库: "恒亿仓" }, pageNo: 1, pageSize: 5 })
await show("状况 仓库=恒亿仓    ", { panelCode: "STOCK_STATUS", condition: { 仓库: "恒亿仓" }, pageNo: 1, pageSize: 5 })
await show("明细 无条件        ", { panelCode: "STOCK_DETAIL", condition: {}, pageNo: 1, pageSize: 5 })
