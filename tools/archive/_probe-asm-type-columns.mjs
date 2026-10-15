/*
 * _probe-asm-type-columns.mjs — 组装成品检验单「表区 → 检验类型」正名后的**接口侧**取证(2026-10-17,一次性探针)
 *
 * 只读 · 不点保存。断言:
 *   ① 面板配置的明细列里,「检验类型」是**第一列**,且「表区」已不存在;
 *   ② 该列在明细字段里可见(hidden 不为真)、可填;
 *   ③ 老后端(还没换 jar)也能照新元数据取数 —— 单据列表 + 单据明细键变成 检验类型,不再报列名无效。
 *
 * 用法: node tools/archive/_probe-asm-type-columns.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.data.token }

const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${PANEL}`, { headers: H }).then((r) => r.json())).data
const cols = (cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []).map((f) => (typeof f === 'string' ? f : f.dataName))
console.log('   明细列(config): ' + cols.join('|'))
ok('①「检验类型」是明细第一列', cols[0] === '检验类型', cols[0])
ok('①「表区」已不在明细列里', !cols.includes('表区'), cols.join('|'))
const fields = (cfg?.detail?.tabs || []).flatMap((t) => t.fields || [])
const f = fields.find((x) => x.dataName === '检验类型')
ok('② 明细字段里有 检验类型', !!f, JSON.stringify(f || {}))
ok('② 该列可见可填(hidden 不为真 / visible 不为假 / 非只读)',
  !!f && f.hidden !== true && f.visible !== false && f.readonly !== true, JSON.stringify(f || {}))
// 列头显示名(多语言走翻译表):中文态应原样,英文态应是 Inspection Type 之类
const aliases = cfg?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columnAliases || {}
console.log('   columnAliases: ' + JSON.stringify(aliases))

/* ③ 取数:老 jar 也要能按新列名取到单(证明"先跑迁移、后换 jar"这段时间应用不炸) */
const list = await fetch(`${BASE}/api/px/queryFormDataList`, {
  method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ panelCode: PANEL, pageNo: 1, pageSize: 5 }),
}).then((r) => r.json())
ok('③ 单据列表取数成功(未报列名无效)', list.code === 200, JSON.stringify(list).slice(0, 200))
const rows = list.data?.rows || list.data?.list || []
console.log('   取到单据 ' + rows.length + ' 张:' + rows.map((r) => r['单据编号']).join(','))
/* 明细取证:挨张找**有明细行**的单(空明细看不到键,不能当证据)。
   单张单据的取数与列表同一条接口(condition 里按单据编号过滤),明细在 row.detail.items。 */
let checked = 0
for (const r of rows) {
  const no = r['单据编号']
  const det = await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelCode: PANEL, condition: { 单据编号: no }, pageNo: 1, pageSize: 1 }),
  }).then((x) => x.json()).catch((e) => ({ code: -1, message: String(e) }))
  const one = (det.data?.rows || det.data?.list || [])[0] || {}
  const items = one.detail?.items || one.detail?.rows || []
  if (!items.length) continue
  checked++
  console.log(`   单据 ${no} 明细 ${items.length} 行;首行键 = ${Object.keys(items[0]).join(',')}`)
  console.log(`   例:检验类型=${items[0]['检验类型']} / 检验项目=${items[0]['检验项目']}`)
  ok('③ 明细行带「检验类型」键(且没有「表区」键)',
    Object.prototype.hasOwnProperty.call(items[0], '检验类型') && !Object.prototype.hasOwnProperty.call(items[0], '表区'),
    Object.keys(items[0]).join(','))
  break
}
if (!checked) console.log('   (这几张单明细都为空,明细键取证跳过)')

console.log(fail === 0 ? `\n[PASS] ${pass} 项(组装成品检验单:检验类型列已就位)` : `\n[FAIL] ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
