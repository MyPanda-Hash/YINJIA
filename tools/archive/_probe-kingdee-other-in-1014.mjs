/**
 * 只读探针(2026-10-14):银嘉真实账套有没有「其他入库单」,以及同类出入库单据的全景。
 *
 * 由来:上一支探针(_probe-kingdee-4docs-1014)列了四类单据 + 旁证「其他出库单」(1149),
 *   用户追问「有没有其他入库单」。星辰确有 /jdy/v2/scm/inv_other_in(应用已登记),
 *   故本支把它查实,并把同族的「其他出库/调拨/组装/采购退货/销售退货/盘点」一起列出,
 *   避免下次再一问一查。
 *
 * 另附「其他入库单」的业务类型(trans_type)分布 —— 其他入库单通常是盘盈/赠品/借入/其他,
 *   知道里面装的是什么,才知道要不要拉进 MES(MES 的「其他入库单/其他出库单」面板已于
 *   2026-10-08 按用户口径下架,见 tools/migrate-drop-extra-docs-pu-req-20261008.sql)。
 *
 * 只读(全部 GET),不写任何单据。用法:
 *   node tools/archive/_probe-kingdee-other-in-1014.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const out = []
const say = (s) => { out.push(s); console.log(s) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const { token } = await fetchAppToken(cfg)

say('=== 银嘉真实账套:其他入库单 + 同类出入库单据全景(只读)===')
say(`账套: 惠州市银嘉环保科技有限公司 outerInstanceId=${cfg.outerInstanceId}`)
say(`时间: ${new Date().toISOString()}\n`)

const DOCS = [
  ['其他入库单', '/jdy/v2/scm/inv_other_in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout'],
  ['组装单', '/jdy/v2/scm/inv_assemble'],
  ['采购入库单', '/jdy/v2/scm/pur_inbound'],
  ['采购退货单', '/jdy/v2/scm/pur_ret'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound'],
  ['生产领料单(材料出库)', '/jdy/v2/scm/inv_pick'],
  ['产品入库单(成品入库)', '/jdy/v2/scm/inv_product'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill'],
]

say('=== ① 逐单据计数(已审核 C 口径)+ 最近 3 张 ===')
const fieldsOf = {}
for (const [label, path] of DOCS) {
  const r = await kingdeeTryGet(cfg, token, path, { bill_status: 'C', page: '1', page_size: '3' })
  if (!r.ok) { say(`\n--- ${label.padEnd(18)} ${path}\n    ❌ ${String(r.error).slice(0, 120)}`); await sleep(220); continue }
  const rows = r.data?.rows || []
  say(`\n--- ${label}  ${path}\n    count = ${r.data?.count}`)
  if (rows[0]) {
    fieldsOf[path] = Object.keys(rows[0])
    say(`    列表行字段(${fieldsOf[path].length}): ${fieldsOf[path].join(', ')}`)
    for (const row of rows) {
      const pick = ['bill_no', 'bill_date', 'bill_status', 'trans_type_name', 'supplier_name', 'customer_name', 'dept_name', 'emp_name', 'remark']
      say('    · ' + pick.filter((k) => row[k]).map((k) => `${k}=${row[k]}`).join('  '))
    }
  } else say('    (0 行)')
  await sleep(220)
}

say('\n=== ② 其他入库单:详情 + 业务类型分布 ===')
const list = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_other_in', { bill_status: 'C', page: '1', page_size: '100' })
if (list.ok) {
  const rows = list.data?.rows || []
  const dist = {}
  for (const r of rows) { const k = String(r.trans_type_name || '(空)'); dist[k] = (dist[k] || 0) + 1 }
  say(`  本页 ${rows.length} 张(共 ${list.data.count}),业务类型分布: ${Object.entries(dist).map(([k, v]) => `${k}:${v}`).join('  ') || '(无)'}`)
  if (rows[0]) {
    const d = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_other_in_detail', { id: String(rows[0].id) })
    if (d.ok) {
      const dd = d.data || {}
      say(`\n  样例单据 ${dd.bill_no} (${dd.bill_date}) 表头键(${Object.keys(dd).length}): ${Object.keys(dd).join(', ')}`)
      say(`  表头 JSON: ${JSON.stringify(dd, (k, v) => (typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v))?.slice(0, 1500)}`)
      const ents = dd.material_entity || []
      if (ents[0]) {
        say(`\n  分录 ${ents.length} 行,分录键(${Object.keys(ents[0]).length}): ${Object.keys(ents[0]).join(', ')}`)
        say(`  首条分录: ${JSON.stringify(ents[0], (k, v) => (typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v))?.slice(0, 1500)}`)
      }
    } else say(`  ❌ 详情: ${String(d.error).slice(0, 140)}`)
  }
} else say(`  ❌ 列表: ${String(list.error).slice(0, 140)}`)

const f = new URL('./_probe-kingdee-other-in-1014.out.txt', import.meta.url)
writeFileSync(f, out.join('\n') + '\n', 'utf8')
console.log('\n[产物已落盘] tools/archive/_probe-kingdee-other-in-1014.out.txt')
