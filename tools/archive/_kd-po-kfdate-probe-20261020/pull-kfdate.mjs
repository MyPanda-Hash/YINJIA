/**
 * pull-kfdate.mjs — 只读核查(2026-10-20):金蝶**真实账套**的采购订单里,「生产日期」(`kf_date`)到底填没填。
 *
 * 为什么必须直连金蝶而不是查 MES 库:MES 的 bl_pu_order 里 保质期到期日/kf_period 等附加列全为 NULL,
 *   但对照组(批次号/产地/生产许可证号/商品是否开启批次)也全为 NULL ⇒ 不能据此断定"源数据是空的"。
 *   所以直接拉金蝶详情,统计 kf_date / batch_no 等键的**出现次数**与**非空率**。
 *
 * 🔴 全部 GET,只读;绝不 POST/写入。
 * 用法:node tools/archive/_kd-po-kfdate-probe-20261020/pull-kfdate.mjs [取样单数,默认30]
 * 产物:tools/archive/_kd-po-kfdate-probe-20261020/out-kfdate.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs'

const N = Number(process.argv[2] || 30)
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lines = []
const log = (s) => { console.log(s); lines.push(s) }

const { token } = await fetchAppToken(cfg)
log(`# 金蝶真实账套 采购订单「生产日期(kf_date)」核查  ${new Date().toISOString()}`)
log(`- clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId} domain=${cfg.domain}`)
log(`- 取样:采购订单(已审核 bill_status=C)前 ${N} 张,逐张拉详情`)

// ① 列表
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { bill_status: 'C', page: '1', page_size: String(Math.max(N, 20)) })
const rows = (list.rows || []).slice(0, N)
log(`- 列表返回:共 ${list.count} 张已审核采购订单;本次取样 ${rows.length} 张`)

// ② 逐张详情,统计行级键
const KEYS = ['kf_date', 'kf_type', 'kf_period', 'batch_no', 'valid_date', 'pro_place', 'pro_license', 'pro_reg_no',
  'material_is_batch', 'material_is_kf_period']
const stat = Object.fromEntries(KEYS.map((k) => [k, { present: 0, filled: 0, samples: [] }]))
let lineTotal = 0, docWithKf = 0, docWithBatch = 0
const keyUniverse = new Map() // 行级键 → 出现次数(看接口到底回哪些键)
const samples = []

for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: r.id })
  const ents = d.material_entity || []
  let docKf = false, docBatch = false
  for (const m of ents) {
    lineTotal++
    for (const k of Object.keys(m)) keyUniverse.set(k, (keyUniverse.get(k) || 0) + 1)
    for (const k of KEYS) {
      if (!(k in m)) continue
      stat[k].present++
      const v = m[k]
      if (v !== undefined && v !== null && v !== '') {
        stat[k].filled++
        if (stat[k].samples.length < 3) stat[k].samples.push(String(v).slice(0, 30))
        if (k === 'kf_date') docKf = true
        if (k === 'batch_no') docBatch = true
      }
    }
  }
  if (docKf) docWithKf++
  if (docBatch) docWithBatch++
  if (i < 3) samples.push({ bill_no: d.bill_no, bill_date: d.bill_date, lines: ents.length, first: ents[0] })
  await sleep(120)
}

log(`- 明细行合计:${lineTotal} 行`)
log(`- 有 kf_date 非空的单据数:${docWithKf} / ${rows.length}`)
log(`- 有 batch_no 非空的单据数:${docWithBatch} / ${rows.length}`)

log('')
log('## 行级键统计(出现 = 接口回了这个键;非空 = 值不是 \'\'/null)')
log('| 键 | 出现/总行 | 非空/总行 | 非空率 | 样例值 |')
log('|---|---|---|---|---|')
for (const k of KEYS) {
  const s = stat[k]
  const rate = lineTotal ? (s.filled / lineTotal * 100).toFixed(1) + '%' : '-'
  log(`| \`${k}\` | ${s.present}/${lineTotal} | ${s.filled}/${lineTotal} | ${rate} | ${s.samples.join(' / ') || ''} |`)
}

log('')
log('## 明细行接口实际返回的全部键(出现次数)')
log([...keyUniverse.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}(${c})`).join(', '))

log('')
log('## 前 3 张单据的 material_entity[0] 原始对象')
for (const s of samples) {
  log(`### ${s.bill_no} 单据日期=${s.bill_date} 行数=${s.lines}`)
  log(JSON.stringify(s.first, null, 1).slice(0, 2500))
}

writeFileSync(new URL('./out-kfdate.txt', import.meta.url), lines.join('\n'), 'utf8')
console.log('\n(已写入 out-kfdate.txt)')
