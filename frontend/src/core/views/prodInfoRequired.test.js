/**
 * 产品信息表必填校验（2026-11-12 用户口径）
 *
 * 用户原话：「除了项目编号和项目名称，一、二、三区都是需要填写的，三区最少一行数据，
 *   剩下的那些数值以及字段都是需要填写的，在没有填写完就提交审批的情况下，
 *   弹窗提示一次，并高亮显示未填写内容」。
 *
 * 两条硬约束在这里钉住（改坏了要立刻变红）：
 *  ① 提交/保存时**弹窗**一次列出全部缺失项（而不是原来的单条 toast）；
 *  ② 弹窗之外必须**高亮**缺失格（validateInlineDraft 内部对每个缺失点调焦点高亮）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const mig = readFileSync(new URL('../../../../tools/migrate-prodinfo-required-20261112.sql', import.meta.url), 'utf8')

test('必填缺失走弹窗（ElMessageBox），且列出条目而不是合并成一句', () => {
  assert.match(list, /function promptMissingRequired\(/, '缺 promptMissingRequired')
  const body = list.slice(list.indexOf('function promptMissingRequired('), list.indexOf('function validateInlineDraft('))
  assert.match(body, /ElMessageBox\.alert\(/, '必须用弹窗')
  assert.match(body, /<ol/, '要逐条列出缺失项')
  assert.match(body, /\.catch\(\(\) =>/, '用户关闭弹窗会 reject，必须兜住')
  // 校验失败点必须调用它
  assert.match(list, /promptMissingRequired\(pre, validation\)/, '校验失败要调用弹窗提示')
})

test('校验失败仍要高亮所有缺失格（翻页 + rs-focus）', () => {
  assert.match(list, /focusMissingFields\(missing\.map\(\(m\) => m\.key\)\)/, '要一次性高亮全部缺失项')
  const sheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /async function focusFields\(/, 'RecordSheetPanels 要暴露 focusFields')
  assert.match(sheet, /\.rs-focus \{[\s\S]{0,120}outline: 2px solid #f56c6c/, '高亮样式要在')
})

test('三区「至少一行」由 tab.isRequired 驱动（不改库）', () => {
  assert.match(list, /tab\.isRequired && nonEmpty === 0/, '缺「至少一行明细」判定')
  assert.match(list, /请至少添加一行/, '缺提示文案')
})

test('迁移把一/二区置必填，且项目编号/项目名称保持豁免、炭棒尺寸(标签格)不标', () => {
  for (const l of ['客户名称', '客户编码', '客户料号', '产品管控等级', '产品功能类别', '产品形态', '应用场景', '产品整体尺寸', '炭棒外径', '炭棒内径', '炭棒长度']) {
    assert.ok(mig.includes(`(N'${l}')`), `迁移里缺 ${l}`)
  }
  assert.match(mig, /SET required = 0[\s\S]{0,200}IN \(N'项目编号', N'项目名称'\)/, '项目编号/项目名称必须回退为不必填')
  assert.match(mig, /SET required = 0[\s\S]{0,160}label = N'炭棒尺寸'/, '炭棒尺寸是标签格，不能标必填')
  assert.match(mig, /RAISERROR/, '迁移要有自检')
})
