/**
 * contrast-kfdate.mjs — 只读对照(2026-10-20):同一个「生产日期」(`kf_date`)在**采购入库单 / 销售订单 / 产品入库单**上填不填。
 * 目的:采购订单 0% 是"整个账套都不填这个字段"还是"只有采购订单不填",给结论一个横向参照。
 * 🔴 全部 GET,只读。
 * 用法:node tools/archive/_kd-po-kfdate-probe-20261020/contrast-kfdate.mjs [每类取样数=30]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs'

const N = Number(process.argv[2] || 30)
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const log = (s) => { console.log(s); out.push(s) }

const DOCS = [
  { label: '采购入库单', list: '/jdy/v2/scm/pur_inbound', detail: '/jdy/v2/scm/pur_inbound_detail' },
  { label: '销售订单', list: '/jdy/v2/scm/sal_order', detail: '/jdy/v2/scm/sal_order_detail' },
  { label: '产品入库单', list: '/jdy/v2/scm/inv_product', detail: '/jdy/v2/scm/inv_product_detail' },
]

const { token } = await fetchAppToken(cfg)
log(`# 金蝶真实账套 「生产日期 kf_date」横向对照(每类前 ${N} 张已审核单据)  ${new Date().toISOString()}`)
log('| 单据 | 取样单数 | 明细行 | kf_date 非空行 | 非空率 | 有值的单据数 |')
log('|---|---|---|---|---|---|')

for (const d of DOCS) {
  let docs = 0, lines = 0, kf = 0, docsWithKf = 0
  try {
    const list = await kingdeeGet(cfg, token, d.list, { bill_status: 'C', page: '1', page_size: String(N) })
    for (const r of (list.rows || []).slice(0, N)) {
      const det = await kingdeeGet(cfg, token, d.detail, { id: r.id })
      const ents = det.material_entity || []
      docs++
      let has = false
      for (const m of ents) {
        lines++
        const v = m.kf_date
        if (v !== undefined && v !== null && v !== '') { kf++; has = true }
      }
      if (has) docsWithKf++
      await sleep(110)
    }
  } catch (e) {
    log(`| ${d.label} | 拉取失败:${e.message} | - | - | - | - |`)
    continue
  }
  const rate = lines ? (kf / lines * 100).toFixed(2) + '%' : '-'
  log(`| ${d.label} | ${docs} | ${lines} | ${kf} | ${rate} | ${docsWithKf} |`)
}

writeFileSync(new URL('./out-contrast.txt', import.meta.url), out.join('\n'), 'utf8')
console.log('\n(已写入 out-contrast.txt)')
