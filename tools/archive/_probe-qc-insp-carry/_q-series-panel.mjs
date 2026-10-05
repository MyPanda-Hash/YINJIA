/**
 * _q-series-panel.mjs — 核对新面板「来料检验要求(系列)」的接口形态(面板配置 / detail 键 / 行数 / 权限)。
 * 用法:node tools/archive/_probe-qc-insp-carry/_q-series-panel.mjs [前端或后端地址]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }

const cfg = await (await fetch(`${BASE}/px/getPanelConfig?panelCode=QC_INSP_REQ_SERIES`, { headers: auth })).json()
const md = cfg?.data?.metadata || {}
const fields = cfg?.data?.detail?.tabs?.[0]?.fields || []
console.log('面板:', md.panelName || '(未下发)', '| singleDoc =', md.singleDoc, '| mode =', md.mode)
console.log('字段:', fields.map((f) => `${f.dataName}(${f.dataType}${f.options ? ':' + f.options.length + '值' : ''})`).join(' , '))
const dictField = fields.find((f) => f.dataName === '物料类别')
console.log('页签(物料类别词表):', JSON.stringify(dictField?.options))

const q = await (await fetch(`${BASE}/px/queryFormDataList`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ panelCode: 'QC_INSP_REQ_SERIES', pageNo: 1, pageSize: 1, condition: {} }),
})).json()
const detail = q?.data?.list?.[0]?.detail || {}
const key = Object.keys(detail)[0]
console.log('detail 键:', JSON.stringify(Object.keys(detail)), '| 行数:', Array.isArray(detail[key]) ? detail[key].length : '?')

const ext = await (await fetch(`${BASE}/px/extFields?panel=QC_INSP_REQ_SERIES`, { headers: auth })).json()
console.log('动态字段:', JSON.stringify(ext?.data?.fields || []), '| capacity:', ext?.data?.capacity)
console.log('每表扩展池:', JSON.stringify(Object.fromEntries(Object.entries(ext?.data?.tabPools || {}).map(([k, v]) => [k, `${v.used}/${v.capacity}(备用${v.from}-${v.to})`]))))
