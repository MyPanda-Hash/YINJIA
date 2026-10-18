/**
 * 探针(2026-10-18):用**正式账套**凭证(deploy/config.json)只读探测金蝶「调拨/盘点」单据。
 *
 * 为什么要这一发:沙箱全历史 0 条,但沙箱不等于正式账。用户口径是「金蝶那边无数据就保持原样」,
 * 必须先确认**正式账**里也没有,结论才成立。
 *
 * ⚠ 全程只读(GET),不写金蝶任何单据。
 * 用法:node deploy/_probe-kd-prod-tfmove.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const cfg = {
  clientId: k.clientId, clientSecret: k.clientSecret,
  appKey: k.appKey || '', appSecret: k.appSecret || '',
  domain: k.domain, outerInstanceId: k.outerInstanceId || '',
}
const { token, domain } = await fetchAppToken(cfg)
cfg.domain = domain
console.log('正式账套授权成功 domain=' + domain)

const CASES = [
  ['调拨单', '/jdy/v2/scm/inv_tfmove'],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout'],
  ['调拨入库单', '/jdy/v2/scm/inv_tfin'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill'],
  ['盘盈单', '/jdy/v2/scm/inv_check_gail_bill'],
  ['盘亏单', '/jdy/v2/scm/inv_check_loss_bill'],
  ['采购入库(对照)', '/jdy/v2/scm/pur_inbound'],
  ['其他出库(对照)', '/jdy/v2/scm/inv_other_out'],
]

for (const [name, path] of CASES) {
  const r = await kingdeeTryGet(cfg, token, path, { page: 1, pagesize: 5 })
  if (!r.ok) { console.log(`[不可用] ${name} ${path} -> ${r.error}`); continue }
  const d = r.data || {}
  const total = d.total ?? d.count ?? 0
  const rows = d.rows || d.list || d.data || []
  let extra = ''
  if (rows.length && /调拨|盘点|盘盈|盘亏/.test(name)) {
    extra = '\n   表头字段: ' + Object.keys(rows[0]).join(', ')
    const ent = rows[0].material_entity || rows[0].entries || []
    if (ent.length) extra += '\n   分录字段: ' + Object.keys(ent[0]).join(', ')
  }
  console.log(`[可用] ${name.padEnd(16)} 全量=${total}` + extra)
}
process.exit(0)
