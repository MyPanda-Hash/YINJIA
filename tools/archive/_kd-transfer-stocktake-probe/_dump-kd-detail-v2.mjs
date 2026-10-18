/**
 * 探针(2026-10-18):用 **v2 详情接口**拉 调拨/盘点/盘盈/盘亏 的**完整字段(表头 + 分录)**,
 * 这是「字段完全对接金蝶」的唯一权威依据。只读(GET)。
 *
 * 依据:官方目录 `tools/archive/_jdy-doc-catalog.json`
 *   调拨详情  GET /jdy/v2/scm/inv_tfmove_detail?id=...
 *   盘点详情  GET /jdy/v2/scm/inv_check_bill_detail?id=...&only_basic=false
 *   盘盈详情  GET /jdy/v2/scm/inv_check_gail_bill_detail?id=...
 *   盘亏详情  GET /jdy/v2/scm/inv_check_loss_bill_detail?id=...
 *
 * 产物:tools/archive/_kd-transfer-stocktake-fields/*-full.json
 * 用法:node deploy/_dump-kd-detail-v2.mjs [beginDate]
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const OUT = 'tools/archive/_kd-transfer-stocktake-fields'
mkdirSync(OUT, { recursive: true })

const k = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { clientId: k.clientId, clientSecret: k.clientSecret, appKey: k.appKey || '',
  appSecret: k.appSecret || '', domain: k.domain, outerInstanceId: k.outerInstanceId || '' }
const { token, domain } = await fetchAppToken(cfg)
cfg.domain = domain
console.log('正式账套授权成功 ' + domain)

const beginDate = process.argv[2] || '2026-09-01'
const CASES = [
  ['tfmove', '调拨单', '/jdy/v2/scm/inv_tfmove', '/jdy/v2/scm/inv_tfmove_detail'],
  ['checkbill', '盘点单', '/jdy/v2/scm/inv_check_bill', '/jdy/v2/scm/inv_check_bill_detail'],
  ['checkgail', '盘盈单', '/jdy/v2/scm/inv_check_gail_bill', '/jdy/v2/scm/inv_check_gail_bill_detail'],
  ['checkloss', '盘亏单', '/jdy/v2/scm/inv_check_loss_bill', '/jdy/v2/scm/inv_check_loss_bill_detail'],
]

for (const [key, name, listPath, detailPath] of CASES) {
  const lst = await kingdeeTryGet(cfg, token, listPath, { page: 1, pagesize: 10, begin_time: beginDate, end_time: '2030-12-31' })
  if (!lst.ok) { console.log(`\n[列表失败] ${name}: ${lst.error}`); continue }
  const rows = lst.data?.rows || lst.data?.list || []
  console.log(`\n===== ${name} ${beginDate} 之后 ${rows.length} 张 =====`)

  const got = []
  for (const row of rows) {
    const dt = await kingdeeTryGet(cfg, token, detailPath, { id: row.id, only_basic: 'false' })
    if (!dt.ok) { console.log(`  ${row.bill_no}: 详情失败 ${dt.error}`); continue }
    got.push({ bill_no: row.bill_no, list_row: row, detail: dt.data })
    const d = dt.data || {}
    const ents = d.material_entity || []
    const entKeys = ents.length ? Object.keys(ents[0]) : []
    console.log(`  ${row.bill_no}: 表头键=${Object.keys(d).length} 分录=${ents.length} 行, 分录键=${entKeys.length}`)
  }
  if (!got.length) continue
  writeFileSync(`${OUT}/${key}-full.json`, JSON.stringify(got, null, 2), 'utf8')

  const headKeys = new Map(), entKeys = new Map()
  for (const g of got) {
    for (const kk of Object.keys(g.detail || {})) headKeys.set(kk, (headKeys.get(kk) || 0) + 1)
    for (const it of (g.detail?.material_entity || [])) for (const kk of Object.keys(it)) entKeys.set(kk, (entKeys.get(kk) || 0) + 1)
  }
  console.log('  -- 表头字段(' + headKeys.size + '): ' + [...headKeys.entries()].map(([a, n]) => `${a}(${n})`).join(', '))
  console.log('  -- 分录字段(' + entKeys.size + '): ' + [...entKeys.entries()].map(([a, n]) => `${a}(${n})`).join(', '))
  const sample = got.map((g) => (g.detail?.material_entity || [])[0]).find(Boolean)
  if (sample) console.log('  -- 分录样例: ' + JSON.stringify(sample))
  const headSample = got[0].detail
  console.log('  -- 表头样例: ' + JSON.stringify(headSample).slice(0, 1500))
}
console.log('\n产物目录: ' + OUT)
process.exit(0)
