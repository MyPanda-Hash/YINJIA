// _probe.mjs —— 排查接口返回的真实结构(只读)
const BASE = process.argv[2] || 'http://127.0.0.1:8091'

const post = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: r.status, text: await r.text() }
}
const get = async (p, token) => {
  const r = await fetch(BASE + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: r.status, text: await r.text() }
}

const lg = await post('/api/auth/login', { userName: 'zz_fv_a', password: 'Tmp#FieldView2026', factory: 'YJ_TEST' })
console.log('login', lg.status)
const lj = JSON.parse(lg.text)
const token = lj?.data?.token
console.log('login.data keys', Object.keys(lj?.data || {}))
console.log('user', JSON.stringify(lj?.data?.user || {}, null, 1).slice(0, 800))

const ui = await get('/api/auth/userinfo', token)
console.log('\nuserinfo', ui.status, ui.text.slice(0, 600))

const fv = await get('/api/px/fieldView?panelCode=QC_RECV', token)
console.log('\nfieldView', fv.status, fv.text.slice(0, 700))

const cfg = await get('/api/px/getPanelConfig?panelCode=QC_RECV&view=system', token)
console.log('\ngetPanelConfig status', cfg.status, 'len', cfg.text.length)
const cj = JSON.parse(cfg.text)
const d = cj?.data || {}
console.log('config top keys', Object.keys(d))
console.log('gridTabs[0] keys', Object.keys((d.gridTabs || [])[0] || {}))
console.log('gridTabs[0].columns', JSON.stringify(((d.gridTabs || [])[0] || {}).columns || []).slice(0, 400))
console.log('detail keys', Object.keys(d.detail || {}))
console.log('detail.tabs[0] keys', Object.keys((d.detail?.tabs || [])[0] || {}))
