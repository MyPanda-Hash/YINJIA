import { readFileSync } from 'node:fs'
const tf = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/tfmove-full.json','utf8'))
console.log('调拨单 ' + tf.length + ' 张;过滤 9.1 后已审核:')
const sel = tf.filter(x => String(x.detail.bill_date) >= '2026-09-01' && x.detail.bill_status === 'C')
console.log('符合 ' + sel.length + ' 张')
let n = 0
for (const x of sel) {
  const d = x.detail
  const ent = d.material_entity || []
  n += ent.length
  console.log(`  ${d.bill_no} ${d.bill_date} 分录${ent.length} ${ent.map(e=>`${e.material_number}/${e.batch_no}/qty=${e.qty}/${e.out_stock_number}->${e.in_stock_number}`).join(' | ')}`)
}
console.log('合计分录行: ' + n)
