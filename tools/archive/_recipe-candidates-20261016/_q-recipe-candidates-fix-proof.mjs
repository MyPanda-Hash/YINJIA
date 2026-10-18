/**
 * _q-recipe-candidates-fix-proof.mjs — 「配方计算候选为空」修复取证(只读)
 *
 * 同一份**活体**响应,分别喂给:
 *   · 旧逻辑(写死 detail.items —— 上线版本就是这个)
 *   · 新逻辑(invCarry.invRowsOf,走 detailRows.js 统一判据)
 * 再按「物料种类」收窄,看候选数从 0 变成多少。
 *
 * 用法: node tools/archive/_recipe-candidates-20261016/_q-recipe-candidates-fix-proof.mjs <baseUrl> [种类]
 *   例: node .../... http://36.140.66.163:8090 功能料-粉末
 */
import { invRowsOf } from '../../../frontend/src/core/panel/invCarry.js'
import { invRowsOfKind } from '../../../frontend/src/core/mold/recipeRows.js'

const base = (process.argv[2] || 'http://36.140.66.163:8090').replace(/\/$/, '')
const kind = process.argv[3] || '功能料-粉末'

const post = async (p, body, token) => (await (await fetch(base + '/api' + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}),
})).json())
const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
const token = lg.data.token

/** 上线版本里的实现(逐字:写死 detail.items) */
const oldRowsOf = (res) => {
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

for (const keyword of ['', '003', 'YJ']) {
  const res = await post('/px/queryFormDataList', { panelCode: 'INV', keyword, condition: {}, pageNo: 1, pageSize: 50 }, token)
  const data = res.data
  const first = (data?.list || [])[0] || {}
  const oldRows = oldRowsOf(data), newRows = invRowsOf(data)
  const oldHit = invRowsOfKind(oldRows, kind).length, newHit = invRowsOfKind(newRows, kind).length
  console.log(`\n== ${base} keyword=${JSON.stringify(keyword)} totalSize=${data?.totalSize} detail键=${JSON.stringify(Object.keys(first.detail || {}))}`)
  console.log(`   旧逻辑(写死 detail.items):拍平 ${oldRows.length} 行 → 「${kind}」候选 ${oldHit} 个`)
  console.log(`   新逻辑(invRowsOf)      :拍平 ${newRows.length} 行 → 「${kind}」候选 ${newHit} 个  ${newHit > 0 && oldHit === 0 ? '✅ 修复生效' : ''}`)
  if (newHit) console.log(`   候选样例: ${JSON.stringify(invRowsOfKind(newRows, kind).slice(0, 4).map((r) => `${r['存货编码']} ${r['存货名称']}`))}`)
}
