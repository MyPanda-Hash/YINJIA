/**
 * shipInspNg.test.js —— 出货检验「判定不合格 → 前往不合格品处理单」回归钉子
 *
 * 【用户原话】2026-11-20:
 *   「品质相关所有检验记录选择不合格都需要跳转至相关流程单据，当前出货检验（功能）就是转到
 *     不合格处理（制程）当前不合格处理单据存在缺少对应的关联字段，为当前不合格处理（制程）的单据
 *     增加字段可关联到出货检验(功能）和对应的生产工单。」
 * 2026-11-24(两轮):
 *   ①「当前的功能就转向当前的不合格处理(制程),表观就转向不合格处理(成品)」⇒ 目标分流;
 *   ②「是需要点击这个检验结论为不合格能跳出一个弹窗提示前往那个不合格单据。而不是点击后在弹窗打开不合格单据」
 *      ⇒ 动作条那颗「⧉ 去开不合格处理单」按钮**删除**,改为「检验结论选成不合格 → 提示窗 → 前往开单」。
 *
 * 【本文件钉住什么】
 *   ① 入口与目标纯函数:只有两张出货检验单 + 总结论=不合格 才算;功能→QC_BHC、表观→QC_BHCP;
 *   ② 纸面:检验结论下拉走 onSummaryChange,选「不合格」发 ng-verdict;**不再有** qr-band-ng 按钮;
 *   ③ 面板:接住 ng-verdict → 弹 ElMessageBox 提示窗(暂不/前往开单)→ 确认后建单并整页定位;
 *   ④ 不合格品处理单(制程)纸面必须有「出货检验单号」「工单号」两格,且参照格带着三项口径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  canOpenNgDisposition,
  isNgVerdict,
  NG_DISPOSITION_PANEL,
  NG_TARGETS,
  NG_VERDICT,
  ngTargetOf,
  SHIP_INSP_PANELS,
} from './shipInspNg.js'
import { qcSheetCfgs } from '../views/docSheetConfigs.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const VUE = read('./QcProcInspSheet.vue')
const LIST = read('../views/PanelxList.vue')
const JAVA = read('../../../../backend/src/main/java/com/yinjia/mes/controller/QcShipInspNgController.java')

test('① 入口面板 = 出货检验（功能）/（表观）两张,目标按来源分流(功能→QC_BHC / 表观→QC_BHCP)', () => {
  assert.deepEqual(SHIP_INSP_PANELS, ['QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.equal(NG_DISPOSITION_PANEL, 'QC_BHC')
  assert.deepEqual(Object.keys(NG_TARGETS), ['QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.equal(ngTargetOf('QC_PROC_INSP').panel, 'QC_BHC')
  assert.equal(ngTargetOf('QC_ASM_INSP').panel, 'QC_BHCP')
  assert.equal(ngTargetOf('QC_INSP'), null)
  assert.equal(NG_VERDICT, '不合格', '「不合格」是存储数据键(ADR-0001),不能被翻译成别的字')
  assert.equal(canOpenNgDisposition('QC_PROC_INSP', { 总结论: '不合格' }), true)
  assert.equal(canOpenNgDisposition('QC_ASM_INSP', { 总结论: '不合格' }), true)
})

test('① 结论不是不合格 / 其它检验面板 ⇒ 不算', () => {
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

test('② 纸面:检验结论选「不合格」即发 ng-verdict;动作条的旧按钮已删除', () => {
  // 下拉变更 → onSummaryChange → emit('ng-verdict')
  assert.match(VUE, /@change="onSummaryChange"/, '检验结论下拉改值要走 onSummaryChange')
  assert.match(VUE, /emit\('ng-verdict'\)/, '选成不合格要发 ng-verdict')
  assert.match(VUE, /NG_VERDICT/, '判据用存储数据键「不合格」,不换成译名')
  assert.match(VUE, /defineEmits\(\['dirty', 'open-items', 'ng-verdict'\]\)/, 'defineEmits 要登记 ng-verdict')
  // 2026-11-24 第二轮:动作条那颗按钮删掉(改由「选不合格弹提示窗」承载)
  assert.doesNotMatch(VUE, /qr-band-ng/, '旧的「去开不合格处理单」按钮样式钩子应已删除')
  assert.doesNotMatch(VUE, /emit\('open-ng'\)/, '旧的 open-ng 入口应已删除')
  assert.doesNotMatch(VUE, /ngDispositionOn/, '旧按钮的显隐判据应已删除')
})

test('③ 面板:接住 ng-verdict → 弹提示窗(暂不/前往开单) → 确认后建单并整页定位', () => {
  const fn = LIST.slice(LIST.indexOf('async function openNgDisposition'), LIST.indexOf('async function openDocByNo'))
  assert.ok(fn.length > 200, '缺 openNgDisposition 实现')
  // 顺序:先 hasUnsavedChanges → saveInlineDraft,再 POST(不先落库,服务端复核会判"结论不是不合格")
  assert.ok(fn.indexOf('hasUnsavedChanges()') < fn.indexOf("request.post('/qc/shipInsp/ng'"),
    '必须先保存再请求服务端')
  assert.match(fn, /saveInlineDraft\('保存', \{ silent: true \}\)/, '脏单要静默保存')
  assert.match(fn, /if \(!res \|\| res\.code !== 200\)/, 'body-code≠200 必须显式判(权限/业务拒绝走 HTTP 200)')
  assert.match(fn, /gotoPanel/, '跳转目标要读服务端 gotoPanel')
  assert.match(fn, /query: \{ docNo: targetNo \}/, '确认后要整页定位到那张单(?docNo=)')
  const ask = LIST.slice(LIST.indexOf('async function onNgVerdict'), LIST.indexOf('async function openDocByNo'))
  assert.ok(ask.length > 100, '缺 onNgVerdict(检验结论选不合格后的提示窗)')
  assert.match(ask, /ElMessageBox\.confirm\(/, '必须弹提示窗询问是否前往')
  assert.match(ask, /前往开单/, '提示窗要有「前往开单」')
  assert.match(ask, /await openNgDisposition\(\)/, '确认后走建单/跳转')
  assert.match(ask, /ngTargetOf\(panelCode\.value\)/, '提示文案要带目标单据名(制程/成品)')
  // 模板接线:纸面 emit 必须被面板接住;旧按钮入口不再接
  assert.match(LIST, /@ng-verdict="onNgVerdict"/, 'PanelxList 没接住纸面的 ng-verdict')
  assert.doesNotMatch(LIST, /@open-ng=/, 'PanelxList 不该再接旧按钮的 open-ng')
  // 内嵌处理单纸面的弹窗形态已撤销(2026-11-24 第二轮)
  assert.doesNotMatch(LIST, /NgDispositionDialog/, '不该再引入「弹窗内嵌处理单纸面」的组件')
})

test('③ 后端接口:只认两张出货检验单 + 总结论=不合格 + 按 出货检验单号 幂等 + 目标分流', () => {
  assert.match(JAVA, /new Source\("QC_PROC_INSP", "出货检验（功能）"/)
  assert.match(JAVA, /new Source\("QC_ASM_INSP", "出货检验（表观）"/)
  assert.match(JAVA, /"QC_BHC", "qc_bhc"/, '功能单目标是制程处理单')
  assert.match(JAVA, /"QC_BHCP", "qc_bhc_cp"/, '表观单目标是成品处理单')
  assert.match(JAVA, /"不合格"\.equals\(str\(h\.get\("总结论"\)\)\)/, '服务端必须复核总结论=不合格')
  assert.match(JAVA, /WHERE \[出货检验单号\] = \? AND ISNULL\(asp_cancel, 'N'\) <> 'Y'/, '缺按出货检验单号判重')
  assert.match(JAVA, /perm\.requirePanelView\(src\.panel\(\)\)/)
  assert.match(JAVA, /perm\.requirePanelView\(src\.target\(\)\)/, '目标单也要过查看权(按来源分流后的目标)')
  assert.match(JAVA, /head\.put\("出货检验单号", no\)/)
  assert.match(JAVA, /head\.put\("工单号", str\(h\.get\("工单号"\)\)\)/)
  // 入库扣减要按工单行+批次归集 ⇒ 处理单必须带这两个键
  assert.match(JAVA, /head\.put\("工单行号", lineNo\)/)
  assert.match(JAVA, /head\.put\("批次号", batch\)/)
  // ⚠ 2026-11-24 审查发现:只断言 head.put 不够 —— SELECT 漏取 [工单行号] 时 lineNo 恒 null,
  //   多行工单会把同一笔不合格重复扣到每条入库草稿上。判据必须落在 SELECT 列表上。
  const selAt = JAVA.indexOf('SELECT [单据编号] AS 单据编号')
  const sel = JAVA.slice(selAt, JAVA.indexOf('FROM dbo.', selAt))
  assert.ok(sel.length > 100, '缺建单前的头表查询')
  assert.match(sel, /ISNULL\(\[工单行号\], 0\) AS 工单行号/, 'SELECT 必须取出 工单行号(否则 lineNo 恒 null)')
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
  const rows = qcSheetCfgs.QC_BHC.rows || []
  const linkRow = rows.find((r) => (r.cells || []).some((c) => c.key === '出货检验单号'))
  assert.ok(linkRow && linkRow.kind === 'pairs', '出货检验单号必须落在 pairs 行里')
  assert.deepEqual((linkRow.cells || []).map((c) => c.key), ['出货检验单号', '工单号'],
    '出货检验单号 + 工单号 独占一行(2 格);挤进 4 格行会在窄窗把参照框压扁')
})

test('④ 不合格品处理单(成品)纸面:继承制程版式,只换标题/编号', () => {
  const cfg = qcSheetCfgs.QC_BHCP
  assert.ok(cfg, '缺 QC_BHCP 纸面配置(表观判不合格的去向)')
  assert.equal(cfg.titlePart1, '不合格品处理单')
  assert.equal(cfg.titlePart2, '成品')
  assert.ok(String(cfg.docno).includes('YJ-QR-59'), '成品单暂沿用 YJ-QR-59 系列编号')
  assert.deepEqual(cfg.rows.map((r) => r.kind), qcSheetCfgs.QC_BHC.rows.map((r) => r.kind),
    '成品单版式必须与制程单同形(继承)')
})
