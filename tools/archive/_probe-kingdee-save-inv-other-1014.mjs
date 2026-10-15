/**
 * 沙箱保存探针(2026-10-14):金蝶 `POST /jdy/v2/scm/inv_other_in` / `inv_other_out`(其他入库单/其他出库单)
 * 的保存接口字段,重点是**业务类型(trans_type 族)**到底怎么传。
 *
 * 背景:其他入/出库与前几个单据不同 —— 它们的表头**必有业务类型**
 *   (真实账套实测:其他入库 trans_type_id=12 / trans_type_number=QTRKLX01 / trans_type_name=其他入库;
 *     其他出库 trans_type_id=13 / QTCKLX01 / 其他出库)。而现有转ERP 代码对 pur_inbound/sal_out_bound
 *   是发 `trans_type:"2"` —— 三个候选键(id/number/name)哪个是保存接口认的,**必须实测**,猜错的表现是
 *   落库后业务类型为空或整单被拒。
 *
 * 🔴 只打**沙箱**(deploy/push/config.json → 华实创新 579046204055359488);绝不碰真实账套。
 *    会在沙箱新建测试单(草稿 Z),末尾列出单号/id 供清理。
 * 已知硬约束(上一支探针实测):保存接口 protobuf 校验,**数值/布尔一律传字符串**;
 *    成功响应 {data:{ids:[id], id_number_map:{id: 单号}}}。
 *
 * 用法: node tools/archive/_probe-kingdee-save-inv-other-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-save-inv-other-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeePost, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
const cfg = { ...k, outerInstanceId: k.outerInstanceId || k.sandboxInstanceId }
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date().toISOString().slice(0, 10)

const MATERIAL = { id: '2569796588071402496', number: 'C-95-13', name: '006项目/功能炭棒滤芯' }
const UNIT = { id: '1', number: '个' }
const STOCK = { id: '2569796666798488576', number: 'CK04' }
const EMP = { id: '2569801440696481792', number: 'ZY00099' }
const DEPT = { id: '100000', number: '100000' }
const SUPPLIER = { number: 'GYS00014', name: 'KG' }

const out = []
const say = (s) => { out.push(s); console.log(s) }
const BUILT = []
say('# 沙箱实测:其他入库单 / 其他出库单保存接口字段')
say('')
say(`- 时间:${new Date().toISOString()}  账套:沙箱 华实创新 outerInstanceId=${cfg.outerInstanceId}`)
say('')

async function saveAndDiff(docType, label, body) {
  const PATH = `/jdy/v2/scm/${docType}`
  const DETAIL = `${PATH}_detail`
  const r = await kingdeePost(cfg, token, PATH, {}, body)
  say(`\n## [${docType}] ${label}`)
  say('')
  say('```json')
  say(JSON.stringify(body, null, 1))
  say('```')
  say('')
  if (!r.ok) { say(`❌ 保存失败:${r.error}`); return null }
  const id = String(r.data?.ids?.[0] ?? '')
  const billNo = String(r.data?.id_number_map?.[id] ?? '')
  say(`✅ 保存成功:id=\`${id}\` 单号=\`${billNo}\``)
  BUILT.push({ docType, id, bill_no: billNo })
  await sleep(500)
  const d = await kingdeeTryGet(cfg, token, DETAIL, { id })
  if (!d.ok) { say(`(回读失败:${String(d.error).slice(0, 120)})`); return null }
  const dd = d.data || {}
  const e0 = (dd.material_entity || [])[0] || {}
  say(`落库:${dd.bill_no}(${dd.bill_date}) 状态=${dd.bill_status}`)
  say(`  **业务类型落库值**: trans_type_id=\`${dd.trans_type_id ?? ''}\` trans_type_number=\`${dd.trans_type_number ?? ''}\` trans_type_name=\`${dd.trans_type_name ?? ''}\``)
  const blank = (v) => v === undefined || v === '' || v === null || v === 0 || v === '0' || v === false
  const head = Object.keys(body).filter((x) => x !== 'material_entity')
  const ent = Object.keys((body.material_entity || [])[0] || {})
  say('\n| 发出键 | 落库有值? | 落库值 |')
  say('|---|---|---|')
  for (const key of head) say(`| \`${key}\` | ${blank(dd[key]) ? '**否(静默忽略)**' : '是'} | ${String(JSON.stringify(dd[key]) ?? '').slice(0, 50)} |`)
  for (const key of ent) say(`| (分录)\`${key}\` | ${blank(e0[key]) ? '**否(静默忽略)**' : '是'} | ${String(JSON.stringify(e0[key]) ?? '').slice(0, 50)} |`)
  return dd
}

const ent = (extra = {}) => [{ material_id: MATERIAL.id, qty: '1', unit_id: UNIT.id, stock_id: STOCK.id, ...extra }]

for (const docType of ['inv_other_in', 'inv_other_out']) {
  say(`\n\n# ══════ ${docType} ══════`)
  // ① 最小 + 业务类型三种候选键分别试
  await saveAndDiff(docType, '① 最小(只 bill_date + 一行)', { bill_date: today, material_entity: ent() })
  await sleep(600)
  await saveAndDiff(docType, '② 最小 + trans_type="2"(沿用 pur_inbound 口径)', { bill_date: today, trans_type: '2', material_entity: ent() })
  await sleep(600)
  await saveAndDiff(docType, '③ 最小 + trans_type_number/name(真实账套实测的业务类型)', {
    bill_date: today,
    trans_type_number: docType === 'inv_other_in' ? 'QTRKLX01' : 'QTCKLX01',
    trans_type_name: docType === 'inv_other_in' ? '其他入库' : '其他出库',
    material_entity: ent(),
  })
  await sleep(600)
  // ④ 全字段版:头(供应商/部门/经手人/备注) + 行(批次/单位族/成本)
  await saveAndDiff(docType, '④ 全字段版(头:业务类型三键 + 对方单位 + 部门/经手人;行:序号/单位族/批次/成本)', {
    bill_date: today,
    trans_type: '2',
    trans_type_id: docType === 'inv_other_in' ? '12' : '13',
    trans_type_number: docType === 'inv_other_in' ? 'QTRKLX01' : 'QTCKLX01',
    trans_type_name: docType === 'inv_other_in' ? '其他入库' : '其他出库',
    supplier_number: SUPPLIER.number, supplier_name: SUPPLIER.name,
    dept_number: DEPT.number, dept_id: DEPT.id,
    emp_number: EMP.number, emp_id: EMP.id,
    remark: `[MES:SAVEPROBE-${docType}]`,
    material_entity: [{
      seq: '1',
      material_id: MATERIAL.id, material_number: MATERIAL.number, material_name: MATERIAL.name,
      qty: '3', base_qty: '3',
      unit_id: UNIT.id, unit_number: UNIT.number,
      base_unit_id: UNIT.id, base_unit_number: UNIT.number,
      stock_id: STOCK.id, stock_number: STOCK.number,
      batch_no: 'SAVEPROBE', comment: '字段探针', cost: '12.5', unit_cost: '4.17',
    }],
  })
  await sleep(600)
}

say('\n\n## 本次在沙箱创建的测试单(供清理)')
say('')
say('| 单据 | id | 单号 |')
say('|---|---|---|')
for (const b of BUILT) say(`| ${b.docType} | \`${b.id}\` | ${b.bill_no} |`)

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-save-inv-other-1014.md', import.meta.url), out.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-save-inv-other-1014.md')
