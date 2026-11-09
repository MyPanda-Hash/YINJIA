// 检验标准库「适用单据」纯函数单测(2026-10-21)
// 口径:存储 = 逗号分隔面板代号;空 = 未归档;显示 = 中文单据名。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { docCodesOf, docCodesToText, docLabelsOf } from './qcPlanApplicableDocs.js'

test('docCodesOf:数组/逗号串/中文逗号/空 都归一成去重代号', () => {
  assert.deepEqual(docCodesOf(['QC_ASM_INSP', 'QC_ASM_INSP', ' QC_PROC_INSP ']), ['QC_ASM_INSP', 'QC_PROC_INSP'])
  assert.deepEqual(docCodesOf('QC_FIRST_INSP,QC_ASM_INSP'), ['QC_FIRST_INSP', 'QC_ASM_INSP'])
  assert.deepEqual(docCodesOf('QC_FIRST_INSP，QC_PROC_INSP；QC_ASM_INSP'), ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.deepEqual(docCodesOf(''), [])
  assert.deepEqual(docCodesOf(null), [])
})

test('docCodesToText:表单多选 → 后端逗号串;空数组 → 空串(未归档)', () => {
  assert.equal(docCodesToText(['QC_ASM_INSP']), 'QC_ASM_INSP')
  assert.equal(docCodesToText(['QC_ASM_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP']), 'QC_ASM_INSP,QC_PROC_INSP')
  assert.equal(docCodesToText([]), '')
  assert.equal(docCodesToText(''), '')
})

test('docLabelsOf:代号 → 中文名;未知代号原样保留;多选顿号连接', () => {
  assert.equal(docLabelsOf('QC_ASM_INSP'), '组装成品检验单')
  assert.equal(docLabelsOf('QC_FIRST_INSP,QC_PROC_INSP'), '首件检验单、出货检验单功能')
  assert.equal(docLabelsOf('QC_X_UNKNOWN'), 'QC_X_UNKNOWN')
  assert.equal(docLabelsOf(''), '')
  assert.equal(docLabelsOf('QC_ASM_INSP', (s) => (s === '组装成品检验单' ? 'Assembly Inspection' : s)), 'Assembly Inspection')
})

test('适用单据选项覆盖三张工序检验单,且与后端 PANELS 同源', () => {
  // 和后端 QcInspPlanController.PANELS / PanelConfigService.WO_INSP_PANELS 保持同一份名单
  assert.deepEqual(
    ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP'].every((c) => docLabelsOf(c) !== c),
    true,
  )
})

test('弹窗接线:按当前面板取方案,提交时把多选拼成逗号串', () => {
  const src = fs.readFileSync(new URL('./QcInspPlanDialog.vue', import.meta.url), 'utf8')
  assert.match(src, /panelCode:\s*props\.panelCode/, '取方案时要带当前面板代号')
  assert.match(src, /docScope:\s*showAllDocs\.value\s*\?\s*'all'\s*:\s*''/, '勾显示全部时 docScope=all')
  assert.match(src, /适用单据:\s*docCodesToText\(f\['适用单据'\]\)/, '保存时多选数组要拼成逗号串')
  assert.match(src, /显示全部单据的方案/, '要有「显示全部单据的方案」开关')
  assert.match(src, /docLabelsOf\(row\['适用单据'\], tt\)/, '方案表要显示适用单据中文名(走 tt)')
})

test('带入类别:项目自己的检验内容优先于方案合并类型', () => {
  const dialogSrc = fs.readFileSync(new URL('./QcInspPlanDialog.vue', import.meta.url), 'utf8')
  // 置顶方案类型 =「外观、尺寸、重量」,三条项目各自带类别 ⇒ 不能整批贴方案类型
  assert.match(dialogSrc, /const own = String\(it\['检验内容'\] \?\? ''\)\.trim\(\)/)
  assert.match(dialogSrc, /\(type && !own \? \{ \.\.\.it, 检验类型: type \} : \{ \.\.\.it \}\)/)
  assert.match(dialogSrc, /\/\[、,，;；\]\/\.test\(raw\) \? '' : raw/)
  const panelSrc = fs.readFileSync(new URL('../views/PanelxList.vue', import.meta.url), 'utf8')
  assert.match(panelSrc, /String\(it\['检验内容'\] \|\| it\['检验类型'\] \|\| ''\)\.trim\(\)/)
})
