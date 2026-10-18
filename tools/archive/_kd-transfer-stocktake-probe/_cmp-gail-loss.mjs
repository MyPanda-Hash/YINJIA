import { readFileSync } from 'node:fs'
const gail = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkgail-full.json','utf8'))
const loss = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkloss-full.json','utf8'))
const cb   = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkbill-full.json','utf8'))
for (const [n, arr] of [['盘盈单',gail],['盘亏单',loss],['盘点单',cb]]) {
  const d0 = arr[0].detail
  console.log(`\n=== ${n} ===`)
  console.log(' 表头键: ' + Object.keys(d0).filter(k=>k!=='material_entity'&&k!=='custom_field').join(', '))
  const ent = arr.find(x=>(x.detail.material_entity||[]).length)?.detail.material_entity?.[0] || {}
  console.log(' 分录键: ' + Object.keys(ent).filter(k=>k!=='custom_entity_field').join(', '))
}
