const BASE = "http://127.0.0.1:8090"
const [wz, ck] = [process.argv[2], process.argv[3]]
const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const t = login.data.token
const r = await (await fetch(`${BASE}/api/stock/monthClose/detail?period=2026-10&wzdm=${encodeURIComponent(wz)}&ckdm=${encodeURIComponent(ck)}`, { headers: { Authorization: "Bearer " + t } })).json()
const d = r.data || {}
console.log(`== ${wz} @ ${ck} · 上月 ${d["上月期间"]}(${d["上月状态"]}) ==`)
for (const row of (d["单据明细"] || [])) console.log([row["单据日期"], row["单据类型"], row["单据编号"], "[" + row["批号"] + "]", row["数量"]].join(" | "))
console.log("共", (d["单据明细"]||[]).length, "行")
