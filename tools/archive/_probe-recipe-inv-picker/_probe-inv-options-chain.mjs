/**
 * 探针(只读):用**真实接口数据**跑**生产用的纯函数**,把"下拉选项怎么来 / 选中后带出什么"整条链走一遍。
 *  - invCarry.invRowsOf      : 档案响应 → 档案行(前端实际用的 flatten)
 *  - recipeRows.invOptionsOf : 档案行 → 下拉选项
 *  - recipeRows.uniqueInvRowOf + invFillFor : 选中一个编号 → 该带出的格
 * 不写库、不改文件;只读 8090 的 /api/px/queryFormDataList(panelCode=INV)。
 */
const BASE = 'http://127.0.0.1:8090/api'
const SRC = 'file:///C:/INCER/YINJIA-MES/frontend/src/core'
const { invRowsOf } = await import(`${SRC}/panel/invCarry.js`)
const { invOptionsOf, uniqueInvRowOf, invFillFor } = await import(`${SRC}/mold/recipeRows.js`)
const { MATERIAL_KINDS } = await import(`${SRC}/mold/materialKinds.js`)
const { groupOfMaterialType, slotsFromRows } = await import(`${SRC}/mold/recipeSheet.js`)

const lg = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.log('LOGIN FAIL'); process.exit(1) }

// 与弹窗 ensureInvRows() 发的请求逐字一致(panelCode INV / condition {} / pageSize 1000)
const t0 = Date.now()
const res = await (await fetch(`${BASE}/px/queryFormDataList`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1000 }),
})).json()
const rows = invRowsOf(res?.data)
const options = invOptionsOf(rows)
const kinds = {}
for (const r of rows) { const k = String(r['所属类别'] ?? '').trim(); kinds[k] = (kinds[k] || 0) + 1 }

console.log(`接口一发: totalSize=${res?.data?.totalSize} 档案行=${rows.length} 下拉选项=${options.length} ms=${Date.now() - t0}`)
console.log(`选项去重后数量 == 档案行数 ? ${options.length === rows.length}  (同编码多行才会不等)`)
console.log(`选项前 3 条: ${JSON.stringify(options.slice(0, 3))}`)
console.log(`选项里有空值/重值 ? 空=${options.filter((o) => !o.value).length} 重=${options.length - new Set(options.map((o) => o.value)).size}`)
console.log(`所属类别值域(${Object.keys(kinds).length} 类): ${JSON.stringify(kinds)}`)

console.log('--- 引擎认得的档案类别 vs 下拉候选 ---')
for (const k of Object.keys(kinds)) {
  const g = groupOfMaterialType(k) || '(引擎认不出)'
  console.log(`  ${k.padEnd(7)} ×${String(kinds[k]).padStart(3)} → ${g}${MATERIAL_KINDS.includes(k) ? '  [在下拉候选里]' : ''}`)
}
console.log(`MATERIAL_KINDS = ${JSON.stringify(MATERIAL_KINDS)}`)

console.log('--- 选中一个编号 ⇒ 带出什么(唯一命中判据 + 只补空格) ---')
for (const code of ['M-001', 'M-003', 'YJ-XH-001', 'M-999']) {
  const inv = uniqueInvRowOf(rows, code)
  const row = { 物料种类: '', 物料编号: code, 物料名称: '', 设计添加量: '0.5' }
  console.log(`  ${code.padEnd(11)} 档案命中=${inv ? '是' : '否'} 带出=${JSON.stringify(invFillFor(row, inv))} 含水率=${inv && inv['水分含量'] != null ? inv['水分含量'] : '(档案空)'}`)
  if (inv) {
    const filled = { ...row, ...invFillFor(row, inv) }
    const { slots, warnings } = slotsFromRows([filled])
    console.log(`             ⇒ 料位分组 ${slots.find((s) => s.rowIndex === 0)?.group || '(空)'} / 告警 ${JSON.stringify(warnings)}`)
  }
}
