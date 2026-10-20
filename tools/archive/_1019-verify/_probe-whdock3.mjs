const BASE = "http://127.0.0.1:8090"
const login = await (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "admin", password: "123456" }) })).json()
const t = login.data.token
const post = async (body) => (await (await fetch(BASE + "/api/px/queryFormDataList", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) })).json())
const q = async (cond) => { const r = await post({ panelCode: "STOCK_DETAIL", condition: cond, pageNo: 1, pageSize: 20 }); return { total: r.data?.totalSize, n: (r.data?.list||[]).length, whs: [...new Set((r.data?.list||[]).map(x => x["仓库编码"]))] } }
console.log("无条件        :", JSON.stringify(await q({})))
console.log("YCL-01        :", JSON.stringify(await q({ _whCodes: "YCL-01" })))
console.log("CP-02         :", JSON.stringify(await q({ _whCodes: "CP-02" })))
console.log("YCL-01,CP-02  :", JSON.stringify(await q({ _whCodes: "YCL-01,CP-02" })))
console.log("CP-02,YCL-01  :", JSON.stringify(await q({ _whCodes: "CP-02,YCL-01" })))
