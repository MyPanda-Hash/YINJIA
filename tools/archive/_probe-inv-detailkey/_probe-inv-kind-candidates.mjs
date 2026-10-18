/**
 * 探针(只读):配方计算弹窗「物料种类 → 物料编号候选」整链实测。
 * 同一份**真实接口响应**分别喂给 ①旧逻辑(写死 detail.items) ②生产用的 invRowsOf(已修),
 * 打印各类别的候选数 —— 本次报障(按种类收窄后恒 0 个候选)的端到端判据。
 * 只读 HTTP;不写库、不改文件。跑法: node tools/archive/_probe-inv-detailkey/_probe-inv-kind-candidates.mjs [base]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090') + '/api'
const SRC = new URL('../../../frontend/src/core/', import.meta.url).href
const { invRowsOf } = await import(`${SRC}panel/invCarry.js`)
const { invRowsOfKind } = await import(`${SRC}mold/recipeRows.js`)
const { MATERIAL_KINDS } = await import(`${SRC}mold/materialKinds.js`)

/** 旧逻辑逐字复刻(修复前 invCarry.invRowsOf:写死 detail.items) */
function oldInvRowsOf(res) {
  const list = Array.isArray(res) ? res : (res && Array.isArray(res.list) ? res.list : [])
  const out = []
  for (const r of list) {
    if (!r) continue
    const items = r.detail && r.detail.items
    if (Array.isArray(items)) out.push(...items.filter(Boolean))
    else out.push(r)
  }
  return out
}

const lg = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg?.data?.token
if (!token) { console.log('LOGIN FAIL'); process.exit(1) }
const post = async (body) => (await (await fetch(`${BASE}/px/queryFormDataList`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
}))).json()

const all = await post({ panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1000 })
const d = all?.data
const detKeys = Object.entries(d?.list?.[0]?.detail || {}).map(([k, v]) => `${k}${Array.isArray(v) ? `[${v.length}]` : ''}`)
console.log(`接口返回: totalSize=${d?.totalSize} detail 键=${detKeys.join(',') || '(无)'}`)
console.log(`拍平行数: 旧逻辑=${oldInvRowsOf(d).length}  新逻辑(invRowsOf)=${invRowsOf(d).length}\n`)

console.log('类别'.padEnd(14) + '接口行数  旧逻辑候选  新逻辑候选')
for (const k of MATERIAL_KINDS) {
  const r = await post({ panelCode: 'INV', condition: { 所属类别: k }, pageNo: 1, pageSize: 1000 })
  const raw = r?.data
  const oldN = invRowsOfKind(oldInvRowsOf(raw), k).length
  const newN = invRowsOfKind(invRowsOf(raw), k).length
  console.log(`${k.padEnd(12)}  ${String(raw?.totalSize).padStart(6)}  ${String(oldN).padStart(8)}  ${String(newN).padStart(9)}${oldN === 0 && newN > 0 ? '   ← 本次修复' : ''}`)
}
