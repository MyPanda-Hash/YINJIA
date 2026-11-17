// _probe2.mjs —— 找明细列在配置里的真实位置
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const post = async (p, b) => (await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json()
const get = async (p, t) => (await fetch(BASE + p, { headers: { Authorization: `Bearer ${t}` } })).json()
const lj = await post('/api/auth/login', { userName: 'zz_fv_a', password: 'Tmp#FieldView2026', factory: 'YJ_TEST' })
const token = lj.data.token
const cj = await get('/api/px/getPanelConfig?panelCode=QC_RECV&view=system', token)
const d = cj.data
console.log('top:', Object.keys(d))
console.log('metadata:', Object.keys(d.metadata || {}))
const find = (obj, path = '', out = []) => {
  for (const [k, v] of Object.entries(obj || {})) {
    if (k === 'columns' && Array.isArray(v)) out.push(`${path}.columns(${v.length}) ${JSON.stringify(v.slice(0, 6))}`)
    else if (v && typeof v === 'object') find(v, `${path}.${k}`, out)
  }
  return out
}
console.log(find(d).join('\n'))
console.log('dataSchema keys:', Object.keys(d.dataSchema || {}), 'fields:', (d.dataSchema?.fields || []).length)
console.log('detail.tabs[0] fields:', (d.detail?.tabs?.[0]?.fields || []).length)
