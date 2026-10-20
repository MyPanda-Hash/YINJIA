/**
 * sample-kfdate-wide.mjs — 只读核查(2026-10-20):全账套均匀抽样,确认「采购订单没填生产日期」不是取样偏差。
 *
 * 做法:翻完采购订单列表(已审核)拿到全部 id → **等距抽样**(默认 120 张)→ 逐张拉详情
 *   → 统计 kf_date / batch_no / pro_place / valid_date 等行级键的非空率,并按单据年月分组看有没有哪个时段填过。
 *
 * 🔴 全部 GET,只读。
 * 用法:node tools/archive/_kd-po-kfdate-probe-20261020/sample-kfdate-wide.mjs [抽样张数=120]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs'

const WANT = Number(process.argv[2] || 120)
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const lines = []
const log = (s) => { console.log(s); lines.push(s) }

const { token } = await fetchAppToken(cfg)

// ① 翻页拿全量列表
const all = []
for (let page = 1; page <= 200; page++) {
  const data = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { bill_status: 'C', page: String(page), page_size: '50' })
  for (const r of data.rows || []) all.push(r)
  if (page >= Number(data.total_page || 1)) break
}
log(`# 金蝶真实账套 采购订单 生产日期(kf_date) 全账套抽样  ${new Date().toISOString()}`)
log(`- 已审核采购订单总数:${all.length}`)

// ② 等距抽样
const stride = Math.max(1, Math.floor(all.length / WANT))
const picked = []
for (let i = 0; i < all.length && picked.length < WANT; i += stride) picked.push(all[i])
log(`- 等距抽样:每 ${stride} 张取 1,共 ${picked.length} 张(单号跨度 ${picked[0]?.bill_no} … ${picked[picked.length - 1]?.bill_no})`)

// ③ 逐张详情
let lineTotal = 0, kfFilled = 0, batchFilled = 0, proPlace = 0, validDate = 0, proLicense = 0
const byMonth = new Map() // yyyy-MM → {docs, lines, kfFilled}
const kfSamples = []
for (const r of picked) {
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: r.id })
  const ym = String(d.bill_date || '').slice(0, 7) || '(空)'
  const st = byMonth.get(ym) || { docs: 0, lines: 0, kfFilled: 0 }
  st.docs++
  for (const m of d.material_entity || []) {
    lineTotal++; st.lines++
    const kf = m.kf_date
    if (kf !== undefined && kf !== null && kf !== '') { kfFilled++; st.kfFilled++; if (kfSamples.length < 10) kfSamples.push(`${d.bill_no} ${m.material_number} ${kf}`) }
    if (m.batch_no) batchFilled++
    if (m.pro_place) proPlace++
    if (m.valid_date) validDate++
    if (m.pro_license) proLicense++
  }
  byMonth.set(ym, st)
  await sleep(110)
}

log(`- 明细行合计:${lineTotal}`)
log('')
log('## 非空统计(行级)')
log(`| 键 | 非空行数 | 非空率 |`)
log(`|---|---|---|`)
const pct = (n) => (lineTotal ? (n / lineTotal * 100).toFixed(2) + '%' : '-')
log(`| \`kf_date\`(生产日期) | ${kfFilled} | ${pct(kfFilled)} |`)
log(`| \`batch_no\`(批次号) | ${batchFilled} | ${pct(batchFilled)} |`)
log(`| \`pro_place\`(产地) | ${proPlace} | ${pct(proPlace)} |`)
log(`| \`valid_date\`(有效期至) | ${validDate} | ${pct(validDate)} |`)
log(`| \`pro_license\`(生产许可证号) | ${proLicense} | ${pct(proLicense)} |`)
log('')
log('## 按单据年月分布')
log('| 年月 | 单据数 | 明细行 | kf_date 非空行 |')
log('|---|---|---|---|')
for (const [ym, s] of [...byMonth.entries()].sort()) log(`| ${ym} | ${s.docs} | ${s.lines} | ${s.kfFilled} |`)
log('')
log(`## kf_date 非空样例(最多 10 条)`)
log(kfSamples.length ? kfSamples.join('\n') : '(无 —— 抽样范围内没有任何一行填了生产日期)')

writeFileSync(new URL('./out-kfdate-wide.txt', import.meta.url), lines.join('\n'), 'utf8')
console.log('\n(已写入 out-kfdate-wide.txt)')
