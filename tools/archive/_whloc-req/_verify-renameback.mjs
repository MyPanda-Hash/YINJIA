// 验证「仓位 → 库位」回退(API + 面板元数据 + 二维码标签键)
const BASE = 'http://127.0.0.1:8090'
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json()
  if (j.code && j.code !== 200) throw new Error(`${path}: ${j.code} ${j.message}`)
  return j
}
const token = (await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' }, null)).data.token
const cfg = (await api('GET', '/api/px/getPanelConfig?panelCode=WHLOC', null, token)).data
const m = cfg.metadata
console.log('面板名            :', JSON.stringify(m.panelName), m.panelName === '库位' ? '✓' : '★')
console.log('qrLabelKey        :', JSON.stringify(m.qrLabelKey), m.qrLabelKey === '库位编码' ? '✓' : '★')
console.log('qrLabelScopeKey   :', JSON.stringify(m.qrLabelScopeKey), '| qrLabelKind =', m.qrLabelKind)
const tp = m.panelPageDto.tablePages[0]
console.log('查询字段          :', tp.queryFields.map((f) => f.dataName).join(' / '))
const cols = tp.gridTabs[0].columns.map((c) => (typeof c === 'string' ? c : c.dataName || c.label))
console.log('网格列            :', cols.join(' / '))

const q = (await api('POST', '/api/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 2000 }, token)).data
const items = q.list[0].detail.locations
console.log('行数              :', items.length)
console.log('行键并集          :', [...new Set(items.flatMap((r) => Object.keys(r)))].join(' / '))
const keys = [...new Set(items.flatMap((r) => Object.keys(r)))]
const bad = keys.filter((k) => k.includes('仓位'))
console.log('含「仓位」的键    :', bad.length ? '★ ' + bad.join(',') : '✓ 无(已全为库位)')
// 模拟前端二维码标签取键
const r0 = items.find((x) => x['库位编码'])
if (r0) {
  console.log('二维码三段        :', `${r0['仓库编码']}@${r0['库位地址']}@${r0['库位编码']}`)
} else console.log('★ 找不到行')
// WH 面板
const cfgW = (await api('GET', '/api/px/getPanelConfig?panelCode=WH', null, token)).data
const colsW = cfgW.metadata.panelPageDto.tablePages[0].gridTabs[0].columns.map((c) => (typeof c === 'string' ? c : c.dataName || c.label))
console.log('\nWH 网格列含库位   :', colsW.includes('库位') ? '✓' : '★缺', '| 含启用仓位管理(金蝶,应仍在):', colsW.includes('启用仓位管理') ? '✓' : '★缺')
