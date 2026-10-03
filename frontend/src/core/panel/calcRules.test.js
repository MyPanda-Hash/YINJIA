import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCalcRules, evaluateFormula, formulaInputs, roundDecimal, toNum,
} from './calcRules.js'

/**
 * 这组断言守的是 2026-10-05 用户报的问题:
 * 「采购入库单的金额要自动计算。并且整个链路有关自动计算的字段都要检验,是否有自动计算」。
 *
 * 背景(实查得出,别退回旧写法):
 *  · 规则本身早就有了 —— 后端 PanelConfigService/PanelConfigService 按字段组合推导出
 *    `金额 = 实收数量 * 单价` 并下发 detail.tabs[].calc,但**只有前端在改单元格时算**,
 *    生单(来料检验单审核自动生成采购入库单)与保存两条落库路径从来不重算 ⇒
 *    库里 128/269 行「有量有价、金额为空」。
 *  · 现由后端 CalcRuleService 在保存前重算(落库真源),本模块负责界面即时反馈,
 *    两边**同一份规则、同一个求值口径**(公式语言/缺失按 0/入参全空则不写入)。
 */

/** 采购入库单下发的规则(照抄 API /px/getPanelConfig?panelCode=PURCHASE_IN 实测) */
const PIN_RULES = [
  { target: '金额', formula: '实收数量*单价', round: 2 },
  { target: '含税单价', formula: '单价*(1+税率%/100)', round: 4 },
  { target: '含税金额', formula: '实收数量*含税单价', round: 2 },
]

/** 采购订单下发的规则(含 税额/折扣金额,链上其它单据同款) */
const PO_RULES = [
  { target: '金额', formula: '数量*单价', round: 2 },
  { target: '含税单价', formula: '单价*(1+税率%/100)', round: 4 },
  { target: '含税金额', formula: '数量*含税单价', round: 2 },
  { target: '税额', formula: '金额*税率%/100', round: 2 },
  { target: '折扣金额', formula: '数量*单价*折扣%/100', round: 2 },
]

test('采购入库单:实收数量 × 单价 自动算出金额(用户报的核心场景)', () => {
  const row = { 实收数量: 120, 单价: 1.5 }
  applyCalcRules(PIN_RULES, row)
  assert.equal(row['金额'], 180)
  assert.equal(row['含税单价'], 1.5)      // 没填税率 → 含税单价 = 单价
  assert.equal(row['含税金额'], 180)
})

test('采购入库单:税率参与含税单价与含税金额', () => {
  const row = { 实收数量: 100, 单价: 2, '税率%': 13 }
  applyCalcRules(PIN_RULES, row)
  assert.equal(row['含税单价'], 2.26)     // 2 × 1.13
  assert.equal(row['金额'], 200)
  assert.equal(row['含税金额'], 226)
})

test('采购订单:金额/含税/税额/折扣金额五条规则一次算齐(链路口径)', () => {
  const row = { 数量: 10, 单价: 100, '税率%': 13, '折扣%': 5 }
  applyCalcRules(PO_RULES, row)
  assert.equal(row['金额'], 1000)
  assert.equal(row['含税单价'], 113)
  assert.equal(row['含税金额'], 1130)
  assert.equal(row['税额'], 130)
  assert.equal(row['折扣金额'], 50)
})

test('守卫:入参全空则不写入 —— 不能因为改了备注就把手工填的金额抹成 0', () => {
  const row = { 金额: 999, 备注: '改个备注' }
  const applied = applyCalcRules(PIN_RULES, row)
  assert.equal(row['金额'], 999, '实收数量与单价都空 ⇒ 金额原样保留')
  assert.equal(applied, 0)
})

test('守卫:只要有一个入参有值就照常算(缺失项按 0 参与运算)', () => {
  const row = { 实收数量: 5 }             // 单价没填
  applyCalcRules(PIN_RULES, row)
  assert.equal(row['金额'], 0)
})

test('缺失项按 0 参与运算,非数字同样按 0', () => {
  assert.equal(evaluateFormula('数量*单价', { 数量: '3', 单价: '2.5' }), 7.5)
  assert.equal(evaluateFormula('数量*单价', { 数量: 3 }), 0)
  assert.equal(evaluateFormula('数量*单价', { 数量: 3, 单价: 'abc' }), 0)
})

test('公式语言:括号优先级、除零归 0、未知变量归 0', () => {
  assert.equal(evaluateFormula('(1+2)*3', {}), 9)
  assert.equal(evaluateFormula('1+2*3', {}), 7)
  assert.equal(evaluateFormula('10/(5-5)', {}), 0)      // 除零 → 0,不出 Infinity
  assert.equal(evaluateFormula('不存在*2', {}), 0)
})

test('公式入参识别:数字字面量与运算符不算字段名', () => {
  assert.deepEqual(formulaInputs('单价*(1+税率%/100)'), ['单价', '税率%'])
  assert.deepEqual(formulaInputs('实收数量*单价'), ['实收数量', '单价'])
})

test('四舍五入按财务口径:15.5 × 1.13 不含二进制浮点尾巴', () => {
  assert.equal(roundDecimal(15.5 * 1.13, 4), 17.515)
  assert.equal(roundDecimal(0.1 + 0.2, 2), 0.3)
  assert.equal(roundDecimal(-1.005, 2), -1.01)          // 负数对称四舍五入
  assert.equal(roundDecimal('x', 2), 0)
  assert.equal(toNum(undefined), 0)
  assert.equal(toNum('12.5'), 12.5)
})

test('求值器不动态执行代码(旧实现用 Function,已废)', () => {
  // 公式里塞 JS 也只会被当成字段名 → 取不到值 → 0,不会被执行
  const row = { '1+1': 5 }
  assert.equal(evaluateFormula('1+1', row), 2, '数字字面量始终按算术算,与行里同名键无关')
  assert.equal(evaluateFormula('globalThis', row), 0)
})
