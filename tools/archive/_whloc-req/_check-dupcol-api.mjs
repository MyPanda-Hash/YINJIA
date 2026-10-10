// 从接口侧核对 WHLOC 归档面板的网格列(应只有一列「存储分区」)
const API = 'http://127.0.0.1:8090'
const lg = await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${lg.data.token}` }
const r = await (await fetch(`${API}/api/px/getPanelConfig`, {
  method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'WHLOC' }),
})).json()
const meta = r?.data?.metadata || r?.data || {}
const tabs = meta?.panelPageDto?.tablePages || meta?.tablePages || []
const cols = tabs[0]?.columns || tabs[0]?.gridColumns || []
console.log('账套:', lg.data.user?.factory || '(YJ_TEST)')
console.log('网格列数:', cols.length)
console.log('列清单:', cols.map((c) => c.label || c.dataName).join(' | '))
const zones = cols.filter((c) => (c.label || c.dataName) === '存储分区')
console.log(`「存储分区」出现次数: ${zones.length}  ${zones.length === 1 ? '✓' : '★ 仍然重复!'}`)
console.log('存储分区 dataType:', zones.map((c) => c.dataType).join(','))
const areas = cols.filter((c) => (c.label || c.dataName) === '大区')
console.log(`「大区」出现次数: ${areas.length}  dataType=${areas.map((c) => c.dataType).join(',')}`)
console.log('含「厂区」列:', cols.some((c) => (c.label || c.dataName) === '厂区') ? '★ 有' : '无 ✓')
const qf = tabs[0]?.queryFields || []
console.log('查询字段:', qf.map((c) => c.dataName).join(' | '))
