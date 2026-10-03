// 验证:参照弹窗收窄(前端 engine.queryRefRows 的数组过滤路径,客户端模拟同款逻辑)
// 用法: node tools/archive/_verify-ledger-ref-narrow.mjs
const BASE = 'http://localhost:8090/api'
let token = ''
async function api(path, body, method = 'POST') {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || (j.code !== undefined && j.code !== 0 && j.code !== 200)) throw new Error(`${path} ${res.status} ${JSON.stringify(j).slice(0, 200)}`)
  return j.data ?? j
}
let fail = 0
const check = (label, ok, detail = '') => { console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`); if (!ok) fail++ }

token = (await api('/auth/login', { userName: 'admin', password: '123456' })).token

// engine.queryRefRows 对 singleDoc 参照面板(INV):cond={} 全量拉取后前端展平(页签键=detail 首页签 inv)
const res = await api('/px/queryFormDataList', { panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 200 })
const doc = (res.list || []).find(d => d?.detail)
const rows = Object.values(doc?.detail || {})[0] || []
console.log(`INV 档案行数=${rows.length}`)

// 新口径:仓库 YCL-01 联动 → 存货编码清单 ['SSC-Q3','YJ-TS-004'] → 弹窗候选
const codes = ['SSC-Q3', 'YJ-TS-004']
const narrowed = rows.filter(r => codes.some(c => String(r['存货编码']) === String(c)))
check('编码收窄:候选恰 2 行(一码一行,单一性)', narrowed.length === 2, JSON.stringify(narrowed.map(r => `${r['存货编码']}|${r['存货名称']}`)))

// 旧口径对照:同名「PP棉」「SSC-Q3」按名称过滤会放进整批同名异码
const names = ['SSC-Q3', 'PP棉']
const oldWay = rows.filter(r => names.some(n => String(r['存货名称']) === String(n)))
check(`旧名称口径会放进 ${oldWay.length} 行(同名异码整批) — 反证修复必要`, oldWay.length > 2, `PP棉 同名 ${oldWay.filter(r => r['存货名称'] === 'PP棉').length} 行`)

// 选中行回填:onQueryRefConfirm 存 row[refField]=存货编码(不再是名称)
const picked = narrowed.find(r => r['存货编码'] === 'YJ-TS-004')
check('选中回填值为编码 YJ-TS-004(非名称 PP棉)', picked && String(picked['存货编码']).trim() === 'YJ-TS-004')

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`)
process.exit(fail === 0 ? 0 : 1)
