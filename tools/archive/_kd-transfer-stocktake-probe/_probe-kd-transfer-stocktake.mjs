/**
 * 探针(2026-10-18):**金蝶云·星辰里到底有没有「调拨单 / 盘点单」的数据和字段**。
 *
 * 用途:用户口径「调拨单和盘点单现在对接金蝶,看是否需要补充字段,如果金蝶那边无数据或者无法对接就保持原样」——
 * 本探针只做**只读探测**,不写任何金蝶单据:
 *   ① 取授权 + app-token(配置见 deploy/push/config.json,当前=测试沙箱)
 *   ② 逐个试标准单据列表接口,看接口是否存在/有权限(不存在或无权限 ⇒ 无法对接)
 *   ③ 有数据的接口再拉一页明细,列出**真实字段名**
 *
 * 用法:node deploy/_probe-kd-transfer-stocktake.mjs
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfgFile = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8'))
const k = cfgFile.kingdee
const cfg = {
  clientId: k.clientId,
  clientSecret: k.clientSecret,
  appKey: k.appKey || '',
  appSecret: k.appSecret || '',
  domain: k.domain,
  outerInstanceId: k.sandboxInstanceId || k.outerInstanceId || '',
}

const { token, domain } = await fetchAppToken(cfg)
console.log('授权成功 domain=' + domain + ' token=' + String(token).slice(0, 8) + '…')
cfg.domain = domain

// 金蝶云·星辰标准接口(路径见 tools/archive/_kd-endpoints-qeasy.txt)
const TARGETS = [
  ['调拨单',        '/jdy/v2/scm/inv_tfmove'],
  ['调拨出库单',     '/jdy/v2/scm/inv_tfout'],
  ['调拨入库单',     '/jdy/v2/scm/inv_tfin'],
  ['盘点单',        '/jdy/v2/scm/inv_check_bill'],
  ['盘盈单',        '/jdy/v2/scm/inv_check_gail_bill'],
  ['盘亏单',        '/jdy/v2/scm/inv_check_loss_bill'],
  // 对照:已知能用的单据(验证 token/签名没问题)
  ['其他出库单(对照)', '/jdy/v2/scm/inv_other_out'],
]

const today = new Date().toISOString().slice(0, 10)
const start = '2026-09-01'

for (const [name, path] of TARGETS) {
  const r = await kingdeeTryGet(cfg, token, path, {
    page: 1, pagesize: 5, begin_time: start, end_time: today,
  })
  if (!r.ok) {
    console.log(`[无] ${name.padEnd(18)} ${path}  ->  ${r.error}`)
    continue
  }
  const d = r.data || {}
  const total = d.total ?? d.count ?? (Array.isArray(d) ? d.length : '-')
  const rows = d.rows || d.list || d.data || (Array.isArray(d) ? d : [])
  console.log(`[有] ${name.padEnd(18)} ${path}  ->  条数=${total} 取到=${rows.length}`)
  if (rows.length) {
    console.log('     首行字段: ' + Object.keys(rows[0]).join(', '))
    console.log('     首行样例: ' + JSON.stringify(rows[0]).slice(0, 600))
  }
}
process.exit(0)
