/* 一次性探针:看 QC_ASM_INSP 面板配置里明细字段挂在哪个路径。 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const H = { Authorization: 'Bearer ' + login.data.token }
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`, { headers: H }).then((r) => r.json())).data
const walk = (o, path = '', depth = 0, out = []) => {
  if (depth > 6 || o == null || typeof o !== 'object') return out
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (Array.isArray(v)) {
      out.push(`${path}.${k}[] (len=${v.length})`)
      if (v.length && typeof v[0] === 'object') walk(v[0], `${path}.${k}[0]`, depth + 1, out)
    } else if (typeof v === 'object') walk(v, `${path}.${k}`, depth + 1, out)
  }
  return out
}
console.log('--- metadata 结构 ---')
console.log(walk(cfg.metadata).filter((s) => /field|column|tab|detail|dataSchema/i.test(s)).join('\n'))
const dto = cfg.metadata?.panelPageDto
console.log('\n--- panelPageDto keys ---', Object.keys(dto || {}))
for (const k of Object.keys(dto || {})) {
  const v = dto[k]
  if (Array.isArray(v)) console.log(`  ${k}: array(${v.length})`, v[0] ? Object.keys(v[0]) : '')
  else if (v && typeof v === 'object') console.log(`  ${k}: object`, Object.keys(v))
}
const tabs = dto?.detail?.tabs || dto?.tabs || []
console.log('\n--- 明细页签 ---', tabs.map((t) => t.key || t.label))
const names = new Set()
for (const t of tabs) for (const f of t.fields || []) names.add(f.dataName || f.label)
console.log('明细字段:', [...names].join(' | '))
