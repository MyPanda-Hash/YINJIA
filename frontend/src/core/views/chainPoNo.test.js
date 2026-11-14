/**
 * chainPoNo.test.js —— 「采购链全链明细行都带采购订单号」的钉子(2026-11-13 用户口径)
 *
 * 【用户原话】
 *   「从采购订单->送料暂收->来料检验单->退货退料->特采->采购入库,明细行都要带采购订单号
 *    (不能只有表头有)。值要传递过来。还有考虑一下转erp的时候是通过明细转单号的还是表头。
 *    如果表头有多个单号会不会影响转erp」
 *
 * 【结论(本测试钉住的)】
 *   ① 头一跳(采购订单生单)就把订单号写进**每一行**(暂收行「采购单号」),下游逐站继承;
 *   ② 检验/退回行 → 采购入库行的行级订单号落在**已有的 源单编号**(金蝶 src_bill_no 同名);
 *   ③ 特采单是"一物料一单、只有表头"的纸面,订单号落表头「采购单号」,且**行级优先**(合单后表头可能是多单串);
 *   ④ 转ERP 采购入库单**按行**取源单编号(表头多单串被显式忽略),不再"整单一个订单号";
 *   ⑤ 唯一一处拿表头订单号做等值匹配的(退货回冲额度)改成**行级优先 + 表头兜底**,
 *      否则合单后表头是"订单1、订单2"⇒ 一条都匹配不上,退货额度放不回去。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const push = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java', import.meta.url), 'utf8')
const button = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const kingdee = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java', import.meta.url), 'utf8')
const batch = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/BatchService.java', import.meta.url), 'utf8')

test('① 采购订单生单:订单号写进每一行(暂收行「采购单号」),下游不覆盖', () => {
  assert.match(push, /if \(rowHasPoNo && isOrderSource\(sourcePanel\)\) row\.put\("采购单号", sourceNo\)/,
    '头一跳必须把订单号写进行')
  assert.match(push, /private static boolean isOrderSource\(String sourcePanel\)/, '判据要收成一个方法,别在内联里散落字符串')
  assert.match(push, /"PU_ORDER"\.equals\(sourcePanel\) \|\| "SUPPLIER_PU_ORDER"\.equals\(sourcePanel\)/,
    '只认采购订单(含供应商门户副本)—— 下游站点绝不能拿 sourceNo 覆盖,否则采购单号会被写成暂收单号')
})

test('② 检验/退回 → 入库:行级订单号落「源单编号」;特采单落表头「采购单号」且行级优先', () => {
  assert.match(button, /if \(r\.get\("采购单号"\) != null\) line\.put\("源单编号", r\.get\("采购单号"\)\)/,
    '检验审核自动生入库行 → 源单编号')
  assert.match(button, /if \(r\.get\("采购单号"\) != null\) line\.put\("采购单号", r\.get\("采购单号"\)\)/,
    '检验审核自动生退回行 → 采购单号')
  // 特采单:表头采购单号取退料行(行级)优先
  assert.match(button, /Object poNo = r\.get\("采购单号"\)/, '特采头采购单号必须行级优先')
  // 特采 → 入库行也落源单编号
  assert.match(button, /if \(poLine != null && !String\.valueOf\(poLine\)\.isBlank\(\)\) line\.put\("源单编号", poLine\)/,
    '特采审核自动生入库行 → 源单编号')
})

test('③ 转ERP:采购入库单按行取源单编号,表头多单串被显式忽略', () => {
  assert.match(kingdee, /boolean multiOrderHead = poNo\.contains\("、"\) \|\| poNo\.contains\(","\)/,
    '表头多单串要能被识别')
  assert.match(kingdee, /} else if \(isPur && !multiOrderHead\) \{/, '单订单才做表头预解析;合单跳过(逐行)')
  assert.match(kingdee, /String srcPo = !linePo\.isEmpty\(\) \? linePo : \(multiOrderHead \? "" : poNo\)/,
    '行级优先,多单表头绝不当源单号')
  assert.match(kingdee, /private PoLineRef resolveLinePoRef\(String poNo\)/, '逐行解析(含 MES号→ERP单号 兜底)')
})

test('④ 退货回冲:按行级「采购单号」匹配,表头只作兜底(合单表头串不能参与等值匹配)', () => {
  const body = batch.slice(batch.indexOf('public Map<String, Double> returnedByOrderLine'))
  assert.match(body, /d\.采购单号/, '要按行级采购单号匹配')
  assert.match(body, /r\.采购订单号 = \?/, '老单据(行级为空)仍要退回表头判断')
  assert.ok(body.indexOf('d.采购单号') < body.indexOf('r.采购订单号'),
    '行级在前、表头兜底在后')
  assert.match(body, /, srcNo, srcNo\)/, '两个占位符都要传单号')
})
