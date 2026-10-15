/**
 * 只读探针(2026-10-15):找金蝶商品档案里「所属分类」到底挂在哪个键上(列表 parent_* 语义确认),
 * 并验证 库存查询 IMS 的 material_category_name 能不能直接过滤「半成品」。
 * 用法: node tools/archive/_probe-kingdee-matcat-1015.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const J = (o) => JSON.stringify(o)

// 1) 商品列表:打印前 3 行完整(找分类线索),并统计 parent_name 分布
const r1 = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: '1', page_size: '5' })
console.log('=== 商品列表前 3 行完整 JSON ===')
for (const m of (r1.data?.rows || []).slice(0, 3)) console.log(J(m).slice(0, 1200), '\n')
const dist = new Map()
for (let p = 1; p <= 25; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(p), page_size: '200' })
  if (!r.ok) break
  const rows = r.data?.rows || []
  for (const m of rows) dist.set(String(m.parent_name || '(空)'), (dist.get(String(m.parent_name || '(空)')) || 0) + 1)
  if (rows.length < 200) break
  await sleep(150)
}
console.log('=== parent_name 分布 ===')
for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k} = ${v}`)

// 2) 商品详情:看有没有分类键
const id = (r1.data?.rows || [])[0]?.id
if (id) {
  const d = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material_detail', { id: String(id) })
  if (d.ok) {
    console.log('\n=== 商品详情键 ===')
    console.log(Object.keys(d.data || {}).join(', '))
    console.log('\n详情 JSON(截断):', J(d.data).slice(0, 3000))
  } else console.log('\n商品详情失败:', d.error)
}
await sleep(200)

// 3) IMS 库存查询:material_category_name 分布 + 半成品行
console.log('\n=== 库存查询 IMS:material_category_name 分布 ===')
const cat = new Map()
const semiRows = []
for (let p = 1; p <= 12; p++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '200' })
  if (!r.ok) { console.log('  第' + p + '页失败: ' + r.error); break }
  const rows = r.data?.rows || []
  for (const x of rows) {
    const c = String(x.material_category_name || '(空)')
    cat.set(c, (cat.get(c) || 0) + 1)
    if (/半成品|半制品|在制品/.test(c)) semiRows.push(x)
  }
  if (rows.length < 200) break
  await sleep(180)
}
for (const [k, v] of [...cat.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k} = ${v}`)
console.log(`\n=== 分类=半成品 的库存行 = ${semiRows.length} ===`)
for (const x of semiRows.slice(0, 40)) {
  console.log(`  · ${x.material_number} ${x.material_name} | 仓=${x.stock_number}/${x.stockid_name} | 批号=${x.batch_no || '-'} | qty=${x.qty} 可用=${x.valid_qty} 成本=${x.cost}`)
}

// 4) scm/inventory 里能不能看到半成品商品(按商品编码对照上一节)
console.log('\n=== scm/inventory 行样例(字段少,看有没有分类)===')
const r4 = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inventory', { page: '1', page_size: '3' })
console.log(r4.ok ? J(r4.data?.rows?.[0] || {}) : '❌ ' + r4.error)
