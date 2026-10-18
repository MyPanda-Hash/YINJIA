import { readFileSync } from 'node:fs'
const tf = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/tfmove-full.json','utf8'))
const cb = JSON.parse(readFileSync('tools/archive/_kd-transfer-stocktake-fields/checkbill-full.json','utf8'))
// 金蝶字段 → MES 字段 对齐表(按语义)
const HEAD_TF = {
  bill_no:'单据编号', bill_date:'单据日期', remark:'备注',
  creator_name:'创建人', audit_time:'审核时间', auditor_name:'审核人',
  trans_type:'业务类型', dept_name:'部门',
}
const ENT_TF = {
  material_number:'存货编码', material_name:'存货名称', material_model:'规格型号',
  out_stock_number:'调出仓库编码', out_stock_name:'调出仓库', in_stock_number:'调入仓库编码', in_stock_name:'调入仓库',
  out_sp_number:'调出仓位编码', in_sp_number:'调入仓位编码',
  batch_no:'批号', unit_name:'计量单位', qty:'数量', comment:'明细备注',
}
const HEAD_CB = { bill_no:'单据编号', bill_date:'单据日期', remark:'备注', emp_name:'盘点人', stock_name:'仓库', creator_name:'创建人' }
const ENT_CB = { material_number:'存货编码', sp_number:'仓位编码', batch_no:'批号', unit_number:'计量单位', inv_qty:'账面数量', qty:'实盘数量', comment:'明细备注' }

function coverage(arr, map) {
  const d = arr[0].detail
  const headKeys = Object.keys(d).filter(k=>k!=='material_entity'&&k!=='custom_field')
  const ent = arr.map(x=>x.detail.material_entity||[]).flat()
  const entKeys = [...new Set(ent.flatMap(e=>Object.keys(e)))]
  // 分录实际有值的字段(非空)
  const nonEmpty = (k) => ent.filter(e => e[k]!=='' && e[k]!==null && e[k]!==undefined && e[k]!==0).length
  return { headKeys, entKeys, ent, nonEmpty }
}
for (const [name, arr, HM, EM] of [['调拨单',tf,HEAD_TF,ENT_TF],['盘点单',cb,HEAD_CB,ENT_CB]]) {
  const { entKeys, ent, nonEmpty } = coverage(arr, EM)
  console.log(`\n=== ${name} ===`)
  console.log(' MES 可承接的表头映射: ' + Object.entries(HM).map(([k,v])=>`${k}→${v}`).join(', '))
  console.log(' MES 可承接的分录映射: ' + Object.entries(EM).map(([k,v])=>`${k}→${v}`).join(', '))
  const unmappedByValue = entKeys.filter(k => !EM[k]).map(k=>`${k}(${nonEmpty(k)})`).filter(x=>!/\(0\)$/.test(x))
  console.log(' 金蝶有值但 MES 无对应列的分录字段: ' + (unmappedByValue.slice(0,40).join(', ') || '无'))
}
