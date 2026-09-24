// 三段式只读探针:①沙箱已推入库单的字段实况 ②真实账套带源单入库单的字段结构(只读!)
// ③真实账套采购订单号格式。真实账套只调 kingdeeGet,零写入。
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs'

const sbCfg = JSON.parse(readFileSync('deploy/push/config.json', 'utf8')).kingdee   // 沙箱
const rlCfg = JSON.parse(readFileSync('deploy/config.json', 'utf8')).kingdee        // 真实(outerInstanceId 自动轮换)

const INBOUND = '/jdy/v2/scm/pur_inbound'
const ORDER = '/jdy/v2/scm/pur_order'

function dumpEntity(tag, row) {
  const keys = Object.keys(row).sort()
  const srcKeys = keys.filter((k) => /src|order|bill_no|seq|来源|订单/i.test(k))
  console.log(`  [${tag}] 行字段(${keys.length} 个),源单/订单相关:`)
  for (const k of srcKeys) {
    const v = row[k]
    if (v !== null && v !== '' && v !== undefined) console.log(`    ${k} = ${JSON.stringify(v)}`)
  }
  const empties = srcKeys.filter((k) => row[k] === null || row[k] === '' || row[k] === undefined)
  console.log(`    (空的: ${empties.join(', ') || '无'})`)
}

// ── ① 沙箱:找我们推的入库单(按 remark [MES:PI-2026-09-0128]) ──
console.log('════ ① 沙箱(tf.jdy.com)════')
{
  const { token } = await fetchAppToken(sbCfg)
  const list = await kingdeeGet(sbCfg, token, INBOUND, { page: '1', page_size: '20' })
  const rows = list.rows || []
  console.log('沙箱入库单共', rows.length, '张(近20):')
  for (const r of rows) console.log(' ', r.bill_no, '| date=' + r.bill_date, '| remark=' + String(r.remark || '').slice(0, 40))
  const ours = rows.find((r) => /MES:PI-/.test(String(r.remark || '')))
  if (ours) {
    const d = await kingdeeGet(sbCfg, token, `${INBOUND}_detail`, { id: ours.id })
    console.log('→ 我们推的', ours.bill_no, '明细首行:')
    dumpEntity('沙箱', (d.material_entity || [])[0] || {})
    const head = { ...d }; delete head.material_entity
    const hk = Object.keys(head).filter((k) => /src|order|bill_no|订单/i.test(k))
    console.log('  头上源单/订单相关:', hk.map((k) => `${k}=${JSON.stringify(head[k])}`).join(', ') || '(无)')
  }
}

// ── ② 真实账套:找一张带源单的入库单(只读) ──
console.log('════ ② 真实账套(只读,零写入)════')
{
  const { token } = await fetchAppToken(rlCfg)
  const list = await kingdeeGet(rlCfg, token, INBOUND, { page: '1', page_size: '20' })
  const rows = list.rows || []
  console.log('真实账套入库单近', rows.length, '张:')
  for (const r of rows.slice(0, 8)) console.log(' ', r.bill_no, '| date=' + r.bill_date, '| bill_source=' + (r.bill_source ?? '-'))
  // 逐张取详情找带源单行的(有 src_bill_no 即算)
  let shown = 0
  for (const r of rows) {
    if (shown >= 2) break
    try {
      const d = await kingdeeGet(rlCfg, token, `${INBOUND}_detail`, { id: r.id })
      const ents = d.material_entity || []
      const withSrc = ents.find((e) => e.src_bill_no || e.src_inter_id)
      console.log(`→ ${r.bill_no} 明细 ${ents.length} 行${withSrc ? ',带源单行:' : '(无 src_bill_no),首行:'}`)
      dumpEntity(r.bill_no, withSrc || ents[0] || {})
      shown++
    } catch (e) { console.log('  详情失败', r.bill_no, e.message) }
  }
}

// ── ③ 真实账套:采购订单号格式(只读) ──
console.log('════ ③ 真实账套 采购订单号格式(只读)════')
{
  const { token } = await fetchAppToken(rlCfg)
  const list = await kingdeeGet(rlCfg, token, ORDER, { page: '1', page_size: '5' })
  for (const r of (list.rows || [])) console.log(' ', r.bill_no, '| date=' + r.bill_date, '| supplier=' + (r.supplier_name || r.supplier_number || '-'))
}
