/**
 * 沙箱保存探针(2026-10-14):金蝶 `POST /jdy/v2/scm/inv_product`(产品入库单)—— 定位「保存接口收哪些字段」。
 *
 * 为什么必须实测:用户要求「字段完全对照金蝶接口来写」。GET 详情有 31+78 个键,但**保存接口收哪些**是另一回事:
 * 仓库已有先例 —— inv_pick 保存只认 emp_id(不认 emp_number)、行上只认 stock_id(不认 stock_number),
 * 其余键**静默忽略**(不报错也不落库)。故本探针:发 body → 回读详情 → **逐键比对**「发出了但没落库」的键。
 *
 * 🔴 只打**沙箱**(deploy/push/config.json → 华实创新 579046204055359488),绝不碰真实账套(deploy/config.json)。
 *    会在沙箱新建测试单(草稿 Z 状态,允许);末尾打印单号/id 供清理。
 *
 * 已实测的两个关键事实(本探针据此写):
 *   ① 保存接口是 protobuf 校验:**所有数值/布尔都要传字符串**(否则 `proto: invalid value for string type: 1`);
 *   ② 保存成功响应形如 `{data:{ids:[id], id_number_map:{id: bill_no}}, errcode:0}`(单号要从 id_number_map 取)。
 *
 * 用法: node tools/archive/_probe-kingdee-save-inv-product-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-save-inv-product-1014.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeePost, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee
// 与后端 KingdeePushService.dynamicInstanceId() 同款映射:outerInstanceId 为空时用 sandboxInstanceId
const cfg = { ...k, outerInstanceId: k.outerInstanceId || k.sandboxInstanceId }
const PATH = '/jdy/v2/scm/inv_product'
const DETAIL = '/jdy/v2/scm/inv_product_detail'
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date().toISOString().slice(0, 10)

const MATERIAL = { id: '2569796588071402496', number: 'C-95-13', name: '006项目/功能炭棒滤芯' }
const UNIT = { id: '1', number: '个' }
const UNIT_KG = { id: '7', number: 'kg' }
const STOCK = { id: '2569796666798488576', number: 'CK04', name: '半成品仓' }
const EMP = { id: '2569801440696481792', number: 'ZY00099', name: 'LGH' }
const DEPT = { id: '100000', number: '100000', name: '华实创新（惠州）科技有限公司' }

const out = []
const say = (s) => { out.push(s); console.log(s) }
const BUILT = []
say('# 沙箱实测:产品入库单保存接口字段(inv_product)')
say('')
say(`- 时间:${new Date().toISOString()}`)
say(`- 账套:沙箱 华实创新 outerInstanceId=${cfg.outerInstanceId} clientId=${cfg.clientId}`)
say(`- 基础资料:商品 ${MATERIAL.number}(${MATERIAL.id}) / 单位 ${UNIT.number}(${UNIT.id}) / 仓库 ${STOCK.number}(${STOCK.id}) / 职员 ${EMP.number}(${EMP.id}) / 部门 ${DEPT.number}`)
say('')

/** 发一张单 → 回读 → 逐键比对 */
async function saveAndDiff(label, body) {
  const r = await kingdeePost(cfg, token, PATH, {}, body)
  say(`\n## ${label}`)
  say('')
  say('```json')
  say(JSON.stringify(body, null, 1))
  say('```')
  say('')
  if (!r.ok) { say(`❌ 保存失败:${r.error}`); return null }
  const id = String(r.data?.ids?.[0] ?? '')
  const billNo = String(r.data?.id_number_map?.[id] ?? '')
  say(`✅ 保存成功:id=\`${id}\` 单号=\`${billNo}\``)
  BUILT.push({ id, bill_no: billNo })
  await sleep(500)
  const d = await kingdeeTryGet(cfg, token, DETAIL, { id })
  if (!d.ok) { say(`(回读失败:${String(d.error).slice(0, 120)})`); return { id, billNo } }
  const dd = d.data || {}
  say(`落库单号 = ${dd.bill_no}(${dd.bill_date})  状态=${dd.bill_status}`)
  const sentHead = Object.keys(body).filter((x) => x !== 'material_entity')
  const sentEnt = Object.keys((body.material_entity || [])[0] || {})
  const e0 = (dd.material_entity || [])[0] || {}
  const blank = (v) => v === undefined || v === '' || v === null || v === 0 || v === '0' || v === false
  const tbl = (keys, get) => {
    const lines = ['| 发出键 | 落库有值? | 落库值 |', '|---|---|---|']
    for (const key of keys) {
      const v = get(key)
      lines.push(`| \`${key}\` | ${blank(v) ? '**否(静默忽略)**' : '是'} | ${String(JSON.stringify(v) ?? '').slice(0, 55)} |`)
    }
    return lines.join('\n')
  }
  say('\n**表头字段落库比对**\n')
  say(tbl(sentHead, (x) => dd[x]))
  say('\n**分录字段落库比对**\n')
  say(tbl(sentEnt, (x) => e0[x]))
  return { id, billNo, dd, e0 }
}

// ── ① 最小可保存集(定位必需字段)────────────────────────────────
const minimal = await saveAndDiff('① 最小可保存集(只 bill_date + 一行 material_id/qty/unit_id/stock_id)', {
  bill_date: today,
  material_entity: [{ material_id: MATERIAL.id, qty: '1', unit_id: UNIT.id, stock_id: STOCK.id }],
})
await sleep(600)

// ── ② 全字段版:把「真实账套里有数据」的键尽量塞进去,看哪些真落库 ────────
const full = await saveAndDiff('② 全字段版(表头 + 分录:部门/经手人/批次/辅助单位/序号/备注…)', {
  bill_date: today,
  trans_type: '2',
  dept_number: DEPT.number, dept_id: DEPT.id,
  emp_number: EMP.number, emp_id: EMP.id,
  remark: '[MES:SAVEPROBE-FULL]',
  material_entity: [{
    seq: '1',
    material_id: MATERIAL.id, material_number: MATERIAL.number, material_name: MATERIAL.name,
    qty: '2', base_qty: '2', inv_qty: '2',
    unit_id: UNIT.id, unit_number: UNIT.number, base_unit_id: UNIT.id, base_unit_number: UNIT.number,
    stock_id: STOCK.id, stock_number: STOCK.number,
    batch_no: 'SAVEPROBE',
    aux_unit_id: UNIT_KG.id, aux_qty: '1', aux_coefficient: '1', coefficient: '1',
    comment: '字段探针',
    material_model: 'TEST-MODEL',
  }],
})
await sleep(600)

// ── ③ 塞一个 GET 里**不存在**的检验字段,看保存接口态度(报错 or 静默忽略)──
const bogus = await saveAndDiff('③ 试探:塞入检验相关键(check_type / inspect_way / qc_type)—— 验证「金蝶产品入库单没有检验字段」', {
  bill_date: today,
  check_type: '1', inspect_way: '全检', qc_type: '抽检',
  material_entity: [{
    material_id: MATERIAL.id, qty: '1', unit_id: UNIT.id, stock_id: STOCK.id,
    check_type: '1', inspect_way: '全检',
  }],
})

// ── 清理线索 ────────────────────────────────────────────────
say('\n## 本次(含前一轮脚本)在沙箱创建的产品入库单')
say('')
say('| id | 单号 | 备注 |')
say('|---|---|---|')
for (const b of BUILT) say(`| \`${b.id}\` | ${b.bill_no} | 本次探针创建(草稿 Z) |`)
say('')
say('> 前一轮变体探针另创建过 `CPRK-20261014-00001`~`00006`(草稿),如要清理按单号删即可。')

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-save-inv-product-1014.md', import.meta.url), out.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/kingdee-save-inv-product-1014.md')
