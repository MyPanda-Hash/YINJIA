/**
 * mergeGenerate.test.js —— 「合单生单」的钉子(2026-11-13 用户口径)
 *
 * 【用户原话】
 *   「采购订单新增一个合单生单在生单按钮下面,可以选择同一供应商的单据,进行合单,合成一张送料暂收单。
 *    并且要注意后面的逻辑(对应的行号有的是对应采购订单行号,是合单前的行号。有些对应行号的送料暂收后
 *    的行号是送料暂收的行号,是合单后的行号)」
 *
 * 【要钉住的四件事】(少一处就会出"合单后溯源断链"或"挂错金蝶源单"):
 *   ① 入口:只有**采购订单**的「生单 ▼」里多出「合单生单」,且必须同一供应商(前端先拦,不给到后端才发现);
 *   ② 出单:合单走 /px/push/merge,**一张**目标单(docs 全部并进去,不是逐张);
 *   ③ 行号:行级「采购单号」= 合单**前**的订单号(逐行不同),「采购订单行号」= 合单**前**的订单行号;
 *      暂收单自己的行 id / source_line_key 才是合单**后**的行号(占用用它);
 *   ④ 下游:检验/退回/入库逐行带「采购单号」,转ERP 行级 src_bill_no 用它(表头合单串不能当源单号)。
 *
 * 单测跑不了运行时,按仓库既有做法读源码钉住(同 approvalSeparation.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const glDialog = readFileSync(new URL('./GenerateLinesDialog.vue', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../../business/engine.js', import.meta.url), 'utf8')
const pushHandler = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/panel/PushGenerateHandler.java', import.meta.url), 'utf8')
const pxController = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java', import.meta.url), 'utf8')
const buttonService = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const kingdee = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/KingdeePushService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('① 入口:只有采购订单的「生单 ▼」多出「合单生单」,并且先按供应商分组拦截', () => {
  assert.match(panelx, /const MERGE_GENERATE_ACTION = '合单生单'/)
  assert.match(panelx, /const MERGE_GENERATE_PANELS = new Set\(\['PU_ORDER', 'SUPPLIER_PU_ORDER'\]\)/,
    '只挂采购订单(含供应商门户副本)')
  assert.match(panelx, /if \(canMergeGenerate\.value\) extra\.push\(MERGE_GENERATE_ACTION\)/,
    '下拉项由 canMergeGenerate 决定,别的地板面板不能出现')
  const branch = panelx.slice(panelx.indexOf("if (action === MERGE_GENERATE_ACTION)"))
  assert.match(branch.slice(0, 1400), /suppliers\.length > 1/, '前端先按「供应商」分组,混了多家直接拦')
  assert.match(branch.slice(0, 1400), /openGenerateDialog\(genMergeAction\.value, audited\.map\(docNoOfRow\), true\)/,
    '合单要走 merge=true 的对话框(第三参)')
})

test('① 后端:合单也校验同一供应商,且**先**校验供应商再校验数量', () => {
  const body = pushHandler.slice(pushHandler.indexOf('public Map<String, Object> generateMerged'))
  assert.match(body, /合单生单只允许\*\*同一供应商\*\*的单据/, '供应商不一致要有一句明确的话')
  assert.match(body, /至少要两张来源单据/, '合单至少两张')
  const supplierAt = body.indexOf('合单生单只允许')
  const capAt = body.indexOf('超出允许上限')
  assert.ok(supplierAt > 0 && capAt > supplierAt, '供应商校验要在数量校验之前(否则先报"某行超量",看不出是合单选错了)')
})

test('② 出单:合单只出**一张**目标单(docs 全部并进去),走 /px/push/merge', () => {
  assert.match(engine, /export async function pushFlowMerge\(\{ panelCode, action, docs, batchNo \}\)/, '引擎要有合单接口')
  assert.match(engine, /request\.post\('\/px\/push\/merge'/, '后端入口 /px/push/merge')
  assert.match(pxController, /@PostMapping\("\/push\/merge"\)/, '控制器要有 /push/merge')
  assert.match(panelx, /:merge="genMerge"/, '列表页要把合单开关传给对话框')
  assert.match(glDialog, /const merge = computed\(\(\) => !!props\.merge\)/)
  // 合单分支:一次 merge 调用 + 只回一张单(没有「生成清单/失败」那套逐张循环)
  const confirmBody = glDialog.slice(glDialog.indexOf('async function confirm('))
  assert.match(confirmBody, /props\.merge\s*\n?\s*\? await engine\.pushFlowMerge/, '合单走 pushFlowMerge')
  assert.match(confirmBody, /已合单生成/, '提示要说清是合单出的单')
  assert.match(confirmBody, /合单来源/, '提示里带上"哪几张订单合的"')
})

test('③ 行号:行级「采购单号」= 合单前的订单号;占用仍用合单后的暂收行 id', () => {
  const body = pushHandler.slice(pushHandler.indexOf('public Map<String, Object> generateMerged'))
  assert.match(body, /if \(rowHasPoNo\) row\.put\("采购单号", p\.sourceNo\(\)\)/,
    '每一行写自己的来源订单号(合单前的号),不能只写在表头')
  assert.match(body, /targetHead\.put\(colLabel\(tgtDef, "来源单号", "来源单号"\), String\.join\("、", orderNos\)\)/,
    '表头放全部订单号(给人看)')
  assert.match(body, /newNo \+ "#" \+ tgtId/, '占用/反查写的是**合单后**的暂收行(单号#行id)')
  assert.match(body, /p\.lineKey\(\)/, '占用按来源行键记(合单前那一行的已送量),两种行号各司其职')
})

test('④ 下游:检验/退回/入库逐行带采购单号;转ERP 行级 src_bill_no 用它', () => {
  assert.match(buttonService, /if \(r\.get\("采购单号"\) != null\) line\.put\("采购单号", r\.get\("采购单号"\)\)/,
    '检验审核自动生的入库/退回行要带行级采购单号')
  assert.match(buttonService, /" 采购单号,"[\s\S]{0,80}" 送检数量/, '入库行取数 SELECT 要把采购单号取回来')
  assert.match(kingdee, /String linePo = str\(line\.get\("采购单号"\)\)/, '转ERP 行级优先用本行订单号')
  assert.match(kingdee, /multiOrderHead/, '表头是"订单1、订单2"这种合单串时不能当 src_bill_no')
  assert.match(kingdee, /e\.put\("src_bill_no", hit\.billNo\(\)\)/, 'src_bill_no 写解析到的金蝶真实号')
})

test('多语言:合单相关文案都有英文译文', () => {
  for (const k of ['合单生单', '确定合单生单', '已合单生成', '张采购订单合成一张',
    '合单生单请先在左侧勾选至少两张采购订单',
    '合单生单只能选同一供应商的采购订单，当前勾了']) {
    const rx = new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'([^']*)'`)
    const m = en.match(rx)
    assert.ok(m, `en.js 缺词条:${k}`)
    assert.ok(!/[\u4e00-\u9fa5]/.test(m[1]), `en.js 的 ${k} 译文不应含中文`)
  }
})
