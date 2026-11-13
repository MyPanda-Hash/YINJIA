// _probe3.mjs —— 校验表头覆盖是否进了 dataSchema(供应商 hidden)
const BASE = 'http://127.0.0.1:8091'
const j = async (p, b, t) => (await fetch(BASE + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json;charset=UTF-8', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined })).json()
const lg = await j('/api/auth/login', { userName: 'zz_fv_a', password: 'Tmp#FieldView2026', factory: 'YJ_TEST' })
const token = lg.data.token
const fv = await j('/api/px/fieldView?panelCode=QC_RECV', null, token)
console.log('role=', fv.data.roleCode, 'rows=', (fv.data.header || []).filter((r) => r.overridden).map((r) => `${r.label}:${r.shown}`))
const cfgRole = await j('/api/px/getPanelConfig?panelCode=QC_RECV&view=role', null, token)
const cfgSys = await j('/api/px/getPanelConfig?panelCode=QC_RECV&view=system', null, token)
const f = (c) => (c.data.dataSchema.fields || []).map((x) => ({ n: x.dataName, hidden: !!x.hidden }))
const roleF = f(cfgRole), sysF = f(cfgSys)
console.log('role 表头 =', JSON.stringify(roleF))
console.log('system 表头 =', JSON.stringify(sysF))
