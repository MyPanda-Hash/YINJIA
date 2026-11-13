// _smoke-8090.mjs —— 8090(正式库)只读冒烟:确认新接口与角色解析在打包版上生效
const BASE = 'http://127.0.0.1:8090'
const j = async (p, b, t) => {
  const r = await fetch(BASE + p, {
    method: b ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const lg = await j('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
console.log('login', lg.status, lg.json?.code)
const token = lg.json?.data?.token
const fv = await j('/api/px/fieldView?panelCode=QC_RECV', null, token)
console.log('fieldView', fv.status, JSON.stringify({
  roleCode: fv.json?.data?.roleCode,
  roleName: fv.json?.data?.roleName,
  headerRows: (fv.json?.data?.header || []).length,
  detailRows: (fv.json?.data?.detail || []).length,
  panelCount: fv.json?.data?.panelCount,
  overridden: (fv.json?.data?.detail || []).filter((r) => r.overridden).length,
}))
const cfg = await j('/api/px/getPanelConfig?panelCode=QC_RECV&view=system', null, token)
const cols = (cfg.json?.data?.metadata?.panelPageDto?.tablePages || []).flatMap((p) => (p.gridTabs || []).flatMap((g) => g.columns || []))
console.log('getPanelConfig(view=system)', cfg.status, '列数', new Set(cols).size)
