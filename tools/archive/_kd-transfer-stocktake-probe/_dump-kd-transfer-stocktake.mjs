/**
 * 探针(2026-10-18):拉**正式账套**的 调拨单 / 盘点单 / 盘盈单 / 盘亏单 完整字段清单与样例,
 * 供「字段完全对接金蝶」定字段用。只读(GET),不写金蝶任何单据。
 *
 * 产物:tools/archive/_kd-transfer-stocktake-fields/*.json + 控制台字段清单
 * 用法:node deploy/_dump-kd-transfer-stocktake.mjs [beginDate]
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

const CASES = [
  ['tfmove', '调拨单', '/jdy/v2/scm/inv_tfmove'],
  ['checkbill', '盘点单', '/jdy/v2/scm/inv_check_bill'],
  ['checkgail', '盘盈单', '/jdy/v2/scm/inv_check_gail_bill'],
  ['checkloss', '盘亏单', '/jdy/v2/scm/inv_check_loss_bill'],
]

const beginDate = process.argv[2] || '2026-09-01'

for (const [key, name, path] of CASES) {
  const r = await kingdeeTryGet(cfg, token, path, { page: 1, pagesize: 50 })
  if (!r.ok) { console.log(`[失败] ${name}: ${r.error}`); continue }
  const d = r.data || {}
  const rows = d.rows || d.list || d.data || []
  writeFileSync(`${OUT}/${key}-all.json`, JSON.stringify(d, null, 2), 'utf8')
  console.log(`\n===== ${name} ${path} 全量=${d.total ?? rows.length} 本页=${rows.length} =====`)

  // 表头字段:多行合并(有的行某些键缺失)
  const headKeys = new Map()
  const entKeys = new Map()
  for (const row of rows) {
    for (const kk of Object.keys(row)) headKeys.set(kk, (headKeys.get(kk) || 0) + 1)
    for (const arr of [row.material_entity, row.entries, row.details]) {
      if (Array.isArray(arr)) for (const it of arr) for (const kk of Object.keys(it)) entKeys.set(kk, (entKeys.get(kk) || 0) + 1)
    }
  }
  console.log(`-- 表头字段 ${headKeys.size} 个:`)
  console.log([...headKeys.entries()].map(([k2, n]) => `${k2}(${n}/${rows.length})`).join(', '))
  if (entKeys.size) {
    console.log(`-- 分录字段 ${entKeys.size} 个:`)
    console.log([...entKeys.entries()].map(([k2, n]) => `${k2}(${n})`).join(', '))
    const firstEnt = (rows.find((x) => (x.material_entity || x.entries || []).length) || {})
    const ent = (firstEnt.material_entity || firstEnt.entries || [])[0]
    if (ent) console.log('-- 分录样例: ' + JSON.stringify(ent).slice(0, 1200))
  }
  // 9.1 之后
  const win = await kingdeeTryGet(cfg, token, path, { page: 1, pagesize: 5, begin_time: beginDate, end_time: '2030-12-31' })
  if (win.ok) {
    const wd = win.data || {}
    console.log(`-- ${beginDate} 之后条数 = ${wd.total ?? (wd.rows || wd.list || []).length}`)
    const wr = wd.rows || wd.list || []
    if (wr.length) writeFileSync(`${OUT}/${key}-since-${beginDate}.json`, JSON.stringify(wd, null, 2), 'utf8')
  } else console.log(`-- ${beginDate} 之后查询失败: ${win.error}`)
}
process.exit(0)
