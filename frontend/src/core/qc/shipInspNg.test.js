/**
 * shipInspNg.test.js —— 出货检验「判定不合格 → 去开不合格品处理单(制程)」回归钉子(2026-11-20)
 *
 * 【用户原话】
 *   「品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
 *     不合格处理（制程）当前不合格处理单据存在缺少对应的关联字段，为当前不合格处理（制程）的单据
 *     增加字段可关联到出货检验(功能）和对应的生产工单。」
 *   追问确认:①入口只做 出货检验（功能）/（表观）两张;②纸面判定不合格出「去开不合格处理单」按钮,
 *   点了跳到不合格品处理单(制程)新单,(不自动派发)带出本检验单号 + 工单号;③目标单据 = QC_BHC。
 *
 * 【本文件钉住什么】
 *   ① 显隐判据是纯函数:只有两张出货检验单 + 总结论=不合格 才出按钮(空/历史自由文本不算);
 *   ② 纸面(QcProcInspSheet.vue)把按钮接到 emit('open-ng'),且**不受 editable 影响**
 *     (已审核的单也可能要补开处理单);
 *   ③ 面板(PanelxList.vue)接住 open-ng → 脏单先保存 → POST /api/qc/shipInsp/ng → 按 gotoPanel 跳;
 *   ④ 不合格品处理单(制程)纸面必须有「出货检验单号」「工单号」两格(用户点名的关联字段),
 *     且参照格带着 QC_PROC_INSP / refAllStatus / refExclude 三项口径。
 *
 * 任何一条被删或改回去,用户报障就会复发:要么按钮不见了,要么跳过去是空单,要么又变成"关联不了"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  canOpenNgDisposition,
  isNgVerdict,
  NG_DISPOSITION_ACTION,
  NG_DISPOSITION_PANEL,
  NG_VERDICT,
  SHIP_INSP_PANELS,
} from './shipInspNg.js'
import { qcSheetCfgs } from '../views/docSheetConfigs.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const VUE = read('./QcProcInspSheet.vue')
const LIST = read('../views/PanelxList.vue')
const JAVA = read('../../../../backend/src/main/java/com/yinjia/mes/controller/QcShipInspNgController.java')

test('① 入口面板 = 出货检验（功能）/（表观）两张,目标是 不合格品处理单(制程) QC_BHC', () => {
  assert.deepEqual(SHIP_INSP_PANELS, ['QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.equal(NG_DISPOSITION_PANEL, 'QC_BHC')
  assert.equal(NG_VERDICT, '不合格', '「不合格」是存储数据键(ADR-0001),不能被翻译成别的字')
  assert.equal(NG_DISPOSITION_ACTION, '去开不合格处理单')
  assert.equal(canOpenNgDisposition('QC_PROC_INSP', { 总结论: '不合格' }), true)
  assert.equal(canOpenNgDisposition('QC_ASM_INSP', { 总结论: '不合格' }), true)
})

test('① 结论不是不合格 / 其它检验面板 ⇒ 不出按钮', () => {
  for (const verdict of ['合格', '', '   ', null, undefined, '部分不合格', '不合格(历史手写)']) {
    assert.equal(isNgVerdict({ 总结论: verdict }), false, `结论「${verdict}」不该算不合格`)
  }
  assert.equal(canOpenNgDisposition('QC_PROC_INSP', {}), false)
  // 来料/首件/巡线/出厂报告本期明确不做(追问答:只做出货检验功能与表观)
  for (const code of ['QC_INSP', 'QC_FIRST_INSP', 'QC_LINE_PATROL', 'QC_OQC_REPORT', 'QC_BHC', '']) {
    assert.equal(canOpenNgDisposition(code, { 总结论: '不合格' }), false, code)
  }
  // 结论两侧有空白也认(库里的值可能被手工补过空格)
  assert.equal(isNgVerdict({ 总结论: ' 不合格 ' }), true)
})

test('② 纸面:按钮只按结论显隐(不受 editable 影响),点击 emit open-ng', () => {
  assert.match(VUE, /@click="emit\('open-ng'\)"/, '纸面按钮必须 emit open-ng')
  assert.match(VUE, /defineEmits\(\['dirty', 'open-items', 'open-ng'\]\)/, 'defineEmits 要登记 open-ng')
  assert.match(VUE, /const ngDispositionOn = computed\(\(\) => canOpenNgDisposition\(props\.panelCode, props\.head\)\)/)
  // 按钮必须在动作条里、但不能被 v-if="editable" 一起挡掉:它有自己的 v-if="ngDispositionOn"
  const band = VUE.slice(VUE.indexOf('<div class="qr-band">'), VUE.indexOf('<!-- ④ 检验明细矩阵'))
  assert.ok(band.includes('v-if="ngDispositionOn"'), '动作条的 NG 按钮缺自己的显隐判据')
  // ⚠ 别用 "v-if=editable 到 ngDispositionOn 的距离" 判:两者在同一动作条里本来就挨着,
  //   真正要钉的是 NG 按钮**不在**那个 <template v-if="editable"> 块内(AGENTS §5⑧:断言写歪会假红)。
  const editableBlock = band.slice(band.indexOf('<template v-if="editable">'), band.indexOf('</template>'))
  assert.ok(editableBlock.length > 0 && !editableBlock.includes('ngDispositionOn'),
    'NG 按钮不能被草稿态一起挡住(已审核的单也要能补开处理单)')
  const ngAt = band.indexOf('qr-band-ng')
  assert.ok(ngAt > 0)
  const ngOpenTag = band.slice(band.lastIndexOf('<span', ngAt), ngAt)
  assert.ok(ngOpenTag.includes('v-if="ngDispositionOn"'), 'NG 按钮的 v-if 必须挂在它自己的标签上')
  assert.ok(band.includes('qr-band-ng'), '缺跨单动作的样式钩子')
})

test('③ 面板:脏单先保存 → POST /api/qc/shipInsp/ng → 按 gotoPanel 跳那张单', () => {
  const fn = LIST.slice(LIST.indexOf('async function openNgDisposition'), LIST.indexOf('async function openDocByNo'))
  assert.ok(fn.length > 200, '缺 openNgDisposition 实现')
  // 顺序:先 hasUnsavedChanges → saveInlineDraft,再 POST(不先落库,服务端复核会判"结论不是不合格")
  assert.ok(fn.indexOf('hasUnsavedChanges()') < fn.indexOf("request.post('/qc/shipInsp/ng'"),
    '必须先保存再请求服务端')
  assert.match(fn, /saveInlineDraft\('保存', \{ silent: true \}\)/, '脏单要静默保存')
  assert.match(fn, /if \(!res \|\| res\.code !== 200\)/, 'body-code≠200 必须显式判(权限/业务拒绝走 HTTP 200)')
  assert.match(fn, /gotoPanel/, '跳转目标要读服务端 gotoPanel')
  assert.match(fn, /query: \{ docNo: targetNo \}/, '跳过去要定位到那张单(?docNo=)')
  // 模板接线:纸面 emit 必须被面板接住
  assert.match(LIST, /@open-ng="openNgDisposition"/, 'PanelxList 没接住 @open-ng')
})

test('③ 后端接口:只认两张出货检验单 + 总结论=不合格 + 按 出货检验单号 幂等', () => {
  assert.match(JAVA, /new Source\("QC_PROC_INSP", "出货检验（功能）"/)
  assert.match(JAVA, /new Source\("QC_ASM_INSP", "出货检验（表观）"/)
  assert.match(JAVA, /"不合格"\.equals\(str\(h\.get\("总结论"\)\)\)/, '服务端必须复核总结论=不合格')
  assert.match(JAVA, /WHERE \[出货检验单号\] = \? AND ISNULL\(asp_cancel, 'N'\) <> 'Y'/, '缺按出货检验单号判重')
  assert.match(JAVA, /perm\.requirePanelView\(src\.panel\(\)\)/)
  assert.match(JAVA, /perm\.requirePanelView\(TARGET\)/)
  assert.match(JAVA, /head\.put\("出货检验单号", no\)/)
  assert.match(JAVA, /head\.put\("工单号", str\(h\.get\("工单号"\)\)\)/)
})

test('④ 不合格品处理单(制程)纸面:出货检验单号(参照 QC_PROC_INSP) + 工单号两格', () => {
  const cells = (qcSheetCfgs.QC_BHC.rows || []).flatMap((r) => r.cells || [])
  const insp = cells.find((c) => c.key === '出货检验单号')
  const wo = cells.find((c) => c.key === '工单号')
  assert.ok(insp, 'QC_BHC 纸面缺「出货检验单号」格')
  assert.ok(wo, 'QC_BHC 纸面缺「工单号」格')
  assert.equal(insp.label, '出货检验单号', 'label 即数据键(DocSheet 按 key 落库)')
  assert.equal(insp.refAllStatus, true, '参照候选不能按表头「单据状态」过滤(历史遗留列)')
  assert.deepEqual(insp.refExclude, ['文档编号'], '来源单的 YJ-QR-154 不能覆盖本单的 YJ-QR-59')
  assert.deepEqual(insp.refCarry['产品规格'], ['规格型号'])
  // 2026-11-01 补的「不合格报告单号」不能被这次改动挤掉
  assert.ok(cells.some((c) => c.key === '不合格报告单号'), '不合格报告单号格子被弄丢了')
  // 两格在同一个 pairs 行里(2026-11-20 实测:4 格行在窄窗纸面 542px 时标签 110px 会把参照框压成
  //   18~34px 宽、行高从 40px 涨到 224px ⇒ 改成独占一行的 2 格;这条断言防有人再塞回 3/4 格)
  const rows = qcSheetCfgs.QC_BHC.rows || []
  const linkRow = rows.find((r) => (r.cells || []).some((c) => c.key === '出货检验单号'))
  assert.ok(linkRow && linkRow.kind === 'pairs', '出货检验单号必须落在 pairs 行里')
  assert.deepEqual((linkRow.cells || []).map((c) => c.key), ['出货检验单号', '工单号'],
    '出货检验单号 + 工单号 独占一行(2 格);挤进 4 格行会在窄窗把参照框压扁')
})
