// 原材料区(A仓) 仓位落地 端到端验证(8090 实跑;2026-10-08)
// 用 Node 而非 .ps1:Windows PowerShell 5.1 对无 BOM 的 UTF-8 脚本按 ANSI(GBK) 解析,
// 中文字符串字面量会被打乱(含筛选条件的键名),导致断言静默失真。Node 无此问题。
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

console.log('== 1. WHLOC 面板配置 ==')
const cfg = await api('GET', '/api/px/getPanelConfig?panelCode=WHLOC', null, token)
const m = cfg.data.metadata
console.log(`面板名    : ${m.panelName}`)
console.log(`qrLabelKey: ${m.qrLabelKey}   (期望 仓位编码)`)
const cols = m.panelPageDto.tablePages[0].gridTabs[0].columns
const colNames = cols.map((c) => c.dataName || c.prop || c.key || c.label || JSON.stringify(c)).filter(Boolean)
console.log(`网格列    : ${colNames.join(' / ') || '(取不到列名属性,见原始)'}`)
const qs = m.panelPageDto.tablePages[0].queryFields
console.log(`查询字段  : ${(qs.map((f) => f.dataName) || []).join(' / ')}`)

console.log('\n== 2. 仓位档案查询 ==')
const q = await api('POST', '/api/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 500 }, token)
console.log(`totalSize : ${q.data.totalSize}`)
const items = q.data.list[0].detail.locations
console.log(`明细行数  : ${items.length}`)

console.log('\n== 3. 键名核对(物理列改名 + 新增层次列是否都取到) ==')
const keys = Object.keys(items[0] || {})
console.log(`第1行键   : ${keys.join(' / ')}`)
const need = ['仓库', '仓库编码', '仓位编码', '仓位地址', '厂区', '区码', '存储分区', '排号', '位号', '层号']
for (const k of need) console.log(`  ${k.padEnd(6)} ${keys.includes(k) ? '✓' : '★缺'}`)
const stale = items.filter((r) => '库位编码' in r || '库位地址' in r || '库区' in r)
console.log(`残留 库位* 键的行数: ${stale.length}  (期望 0)`)

console.log('\n== 4. 按 仓库 / 存储分区 汇总 ==')
const byWh = {}
for (const r of items) byWh[r.仓库] = (byWh[r.仓库] || 0) + 1
for (const [k, v] of Object.entries(byWh).sort()) console.log(`  仓库 ${String(k).padEnd(14)} ${String(v).padStart(4)} 个`)
const aRows = items.filter((r) => r.仓库 === '原材料区A仓')
const byArea = {}
for (const r of aRows) byArea[r.存储分区] = (byArea[r.存储分区] || 0) + 1
for (const [k, v] of Object.entries(byArea).sort()) console.log(`    存储分区 ${String(k).padEnd(9)} ${String(v).padStart(4)} 个`)

console.log('\n== 5. 抽样(每存储分区首尾各 2 条) ==')
for (const area of ['炭粉区', '胶粉区', '货架区']) {
  const rows = aRows.filter((r) => r.存储分区 === area).sort((a, b) => a.仓位编码.localeCompare(b.仓位编码))
  if (!rows.length) continue
  console.log(`  [存储分区=${area}] 共 ${rows.length} 条`)
  for (const r of [rows[0], rows[1], rows[rows.length - 2], rows[rows.length - 1]]) {
    console.log(`    编码=${String(r.仓位编码).padEnd(10)} 排号=${String(r.排号).padEnd(5)} 位号=${String(r.位号).padEnd(3)} 层号=${String(r.层号 ?? '').padEnd(3)} 厂区=${r.厂区} 地址=${r.仓位地址}`)
  }
}

console.log('\n== 6. 二维码三段内容预演(仓库编码@仓位地址@仓位编码) ==')
for (const code of ['A1-09-1', 'A1-20-3', 'A1-21-1', 'A1-24-3', 'AH5-1-1', 'AH16-3-3']) {
  const r = aRows.find((x) => x.仓位编码 === code)
  console.log(r ? `  ${code.padEnd(10)} ->  ${r.仓库编码}@${r.仓位地址}@${r.仓位编码}` : `  ${code.padEnd(10)} ->  ★未找到`)
}

console.log('\n== 7. 仓库档案 CK-A ==')
const q2 = await api('POST', '/api/px/queryFormDataList', { panelCode: 'WH', pageNo: 1, pageSize: 100 }, token)
const wh = q2.data.list[0].detail.wh
console.log(`WH 仓库数 : ${wh.length}`)
for (const w of wh) console.log(`  ${String(w.仓库编码).padEnd(9)} ${w.仓库名称}`)
