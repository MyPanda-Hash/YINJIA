// 在面板配置 JSON 里直接定位「存储分区」的列条目(不猜路径)
const API = 'http://127.0.0.1:8090'
const lg = await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = lg.data.token
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
let raw
for (const [m, url, body] of [
  ['POST', `${API}/api/px/getPanelConfig`, { panelCode: 'WHLOC' }],
  ['GET', `${API}/api/px/getPanelConfig?panelCode=WHLOC`, null],
]) {
  const res = await fetch(url, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined })
  const txt = await res.text()
  if (res.ok && txt.includes('存储分区')) { raw = txt; console.log(`[取到配置] ${m} ${url} (${txt.length} 字节)`); break }
  console.log(`  ${m} ${url} → HTTP ${res.status}, 含存储分区=${txt.includes('存储分区')}`)
}
if (!raw) { console.log('★ 没取到含「存储分区」的配置'); process.exit(1) }
const j = JSON.parse(raw)
// 递归找所有"像列定义"的对象(有 dataName 或 label 且等于/含 存储分区)
const hits = []
;(function walk(o, path) {
  if (!o || typeof o !== 'object') return
  if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i}]`)); return }
  const nm = o.dataName ?? o.label ?? o.prop
  if (nm === '存储分区' || nm === '大区') hits.push({ path, name: nm, dataType: o.dataType, place: o.place, seq: o.seq, visible: o.visible, hidden: o.hidden })
  for (const k of Object.keys(o)) walk(o[k], `${path}.${k}`)
})(j, '$')
console.log('\n=== 命中的列定义 ===')
for (const h of hits) console.log('  ', JSON.stringify(h))
const z = hits.filter((h) => h.name === '存储分区')
const a = hits.filter((h) => h.name === '大区')
console.log(`\n存储分区 命中 ${z.length} 次;大区 命中 ${a.length} 次`)
console.log('原始 JSON 里 "存储分区" 字符串出现次数:', (raw.match(/存储分区/g) || []).length)
