// 仓库/仓位「厂区 > 仓 > 大区 > 分区」层次 端到端验证(8090 实跑;2026-10-08)
// 口径:厂区/仓 在仓库表(bs_wh);大区/分区 在仓位表(bs_wh_loc);仓位表不再有 厂区。
const BASE = 'http://localhost:8090'

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const parsed = await res.json()
  if (parsed.code && parsed.code !== 200) throw new Error(`API ${path} 失败: code=${parsed.code} ${parsed.message}`)
  return parsed
}
const login = await api('POST', '/api/auth/login', { userName: 'admin', password: '123456' })
const token = login.data.token
const q = (code) => api('POST', '/api/px/queryFormDataList', { panelCode: code, pageNo: 1, pageSize: 1000 }, token)
// ⚠ 网格列对象没有稳定的 dataName/prop/key 属性名,逐个兜底 + 兜底到 JSON 原文
const colName = (c) => c.dataName || c.prop || c.key || c.label || c.name || JSON.stringify(c)
// ⚠ 上面兜底可能落到 JSON 原文(带引号),故按"子串包含"判词,不能直接 includes 全等
const hasWord = (arr, w) => arr.some((n) => String(n).includes(w))

console.log('== 1. 仓位面板(WHLOC):应含 大区、已无 厂区 ==')
const cfg = await api('GET', '/api/px/getPanelConfig?panelCode=WHLOC', null, token)
const names = cfg.data.metadata.panelPageDto.tablePages[0].gridTabs[0].columns.map(colName)
console.log(`网格列  : ${names.join(' / ')}`)
console.log(`  网格含「大区」: ${hasWord(names, '大区') ? '✓' : '★缺'}`)
console.log(`  网格含「厂区」: ${hasWord(names, '厂区') ? '★仍在(应为否)' : '✓ 已移出本表'}`)

console.log('\n== 2. 仓库面板(WH):应有 厂区 ==')
const cfg2 = await api('GET', '/api/px/getPanelConfig?panelCode=WH', null, token)
const names2 = cfg2.data.metadata.panelPageDto.tablePages[0].gridTabs[0].columns.map(colName)
console.log(`网格列  : ${names2.join(' / ')}`)
console.log(`  网格含「厂区」: ${hasWord(names2, '厂区') ? '✓' : '★缺'}`)

console.log('\n== 3. 仓库档案(四个仓 + 其余账套仓库) ==')
const wh = (await q('WH')).data.list[0].detail.wh
for (const w of wh) {
  console.log(`  ${String(w.仓库编码).padEnd(9)} ${String(w.仓库名称).padEnd(18)} 厂区=${String(w.厂区 ?? '(空)').padEnd(4)} 分类=${String(w.仓库分类 ?? '').padEnd(4)} 停用=${w.停用}`)
}

console.log('\n== 4. 仓位层次全景(厂区/仓 取自仓库表,大区/分区 取自仓位表) ==')
const items = (await q('WHLOC')).data.list[0].detail.locations
console.log(`仓位总数: ${items.length}`)
const allKeys = [...new Set(items.flatMap((r) => Object.keys(r)))]
console.log(`全行键并集: ${allKeys.join(' / ')}`)
console.log(`  含「大区」键: ${allKeys.includes('大区') ? '✓' : '★缺'}      含「厂区」键: ${allKeys.includes('厂区') ? '★仍在(应为否)' : '✓ 已移除'}`)
const whMap = Object.fromEntries(wh.map((w) => [w.仓库编码, w]))
const agg = {}
for (const r of items) {
  const w = whMap[r.仓库编码] || {}
  const k = `${w.厂区 ?? '?'} | ${r.仓库} | ${r.大区 ?? '(不分区)'} | ${r.存储分区 ?? '(—)'}`
  agg[k] = (agg[k] || 0) + 1
}
for (const [k, v] of Object.entries(agg).sort()) console.log(`  ${k.padEnd(44)} ${String(v).padStart(4)}`)

console.log('\n== 5. 抽样(每「仓/大区/分区」首条) ==')
const seen = new Set()
for (const r of items) {
  const k = `${r.仓库}/${r.大区 ?? '-'}/${r.存储分区 ?? '-'}`
  if (seen.has(k)) continue
  seen.add(k)
  console.log(`  ${String(r.仓库).padEnd(4)} ${String(r.大区 ?? '-').padEnd(8)} ${String(r.存储分区 ?? '-').padEnd(7)} 编码=${String(r.仓位编码).padEnd(10)} 地址=${r.仓位地址}`)
}

console.log('\n== 6. 二维码三段(格式不变:仓库编码@仓位地址@仓位编码) ==')
for (const code of ['A1-09-1', 'AH18-1-1', 'B1-18-3', 'C2-16-3', 'D4-01-1']) {
  const r = items.find((x) => x.仓位编码 === code)
  console.log(r ? `  ${code.padEnd(10)} -> ${r.仓库编码}@${r.仓位地址}@${r.仓位编码}` : `  ${code.padEnd(10)} -> ★未找到`)
}
