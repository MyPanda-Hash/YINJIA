import { readFileSync } from 'node:fs'
const tf = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/tfmove-full.json','utf8'))
const sel = tf.filter(x => String(x.detail.bill_date) >= '2026-09-01' && x.detail.bill_status === 'C')
console.log('表头字段实际值:')
for (const x of sel.slice(0,2)) {
  const d = x.detail
  console.log(' ' + JSON.stringify({bill_no:d.bill_no,bill_date:d.bill_date,trans_type:d.trans_type,dept_name:d.dept_name,remark:d.remark,creator_name:d.creator_name,audit_time:d.audit_time,auditor_name:d.auditor_name}))
}
console.log('\n批号为空的分录:')
for (const x of sel) for (const e of (x.detail.material_entity||[])) {
  if (!e.batch_no) console.log(`  ${x.detail.bill_no} ${e.material_number} batch_no="${e.batch_no}" is_batch=${e.material_is_batch} qty=${e.qty}`)
}
console.log('\n全部批号取值: ' + JSON.stringify([...new Set(sel.flatMap(x=>(x.detail.material_entity||[]).map(e=>e.batch_no||'(空)')))]))
console.log('全部调出仓库: ' + JSON.stringify([...new Set(sel.flatMap(x=>(x.detail.material_entity||[]).map(e=>e.out_stock_number)))]))
console.log('全部调入仓库: ' + JSON.stringify([...new Set(sel.flatMap(x=>(x.detail.material_entity||[]).map(e=>e.in_stock_number)))]))
