import { readFileSync } from 'node:fs'
const gail = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkgail-full.json','utf8'))
const loss = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkloss-full.json','utf8'))
const cb   = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkbill-full.json','utf8'))
// 盘点单: 有盈亏单的比例
const withGain = cb.filter(x => x.detail.gain_bill_no).length
const withLoss = cb.filter(x => x.detail.loss_bill_no).length
console.log(`盘点单样本 ${cb.length} 张: 带盘盈单 ${withGain} 张, 带盘亏单 ${withLoss} 张`)
// 盘盈单分录: 数量正负
const gq = gail.flatMap(x => (x.detail.material_entity||[]).map(e => e.qty))
const lq = loss.flatMap(x => (x.detail.material_entity||[]).map(e => e.qty))
const stat = (a) => a.length ? `n=${a.length} min=${Math.min(...a)} max=${Math.max(...a)} 负值=${a.filter(v=>v<0).length} 零=${a.filter(v=>v===0).length}` : 'n=0'
console.log('盘盈单分录数量: ' + stat(gq))
console.log('盘亏单分录数量: ' + stat(lq))
// 盘盈单: 有无单价/成本/批次/仓位
const ge = gail.flatMap(x=>x.detail.material_entity||[])
const le = loss.flatMap(x=>x.detail.material_entity||[])
for (const [n, arr] of [['盘盈',ge],['盘亏',le]]) {
  const nonEmpty = (k) => arr.filter(e => e[k] !== '' && e[k] !== null && e[k] !== undefined && e[k] !== 0).length
  console.log(`${n}分录 ${arr.length} 行: 有单价 ${nonEmpty('price')}, 有成本 ${nonEmpty('cost')}, 有批次 ${nonEmpty('batch_no')}, 有仓位 ${nonEmpty('sp_number')}, 有源单 ${nonEmpty('src_bill_no')}`)
}
