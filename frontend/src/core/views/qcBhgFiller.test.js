/**
 * qcBhgFiller.test.js —— 不合格报告(制程)QC_BHG 两处用户报障的回归钉子(2026-11-02)
 *
 * 【用户原话(附截图,红框圈住右上信息表的「填写部门 / 填写人」两行)】
 *   「当前这个不合格处理中的填写人应该默认当前创建的账号名称
 *     而且当前填写部门中的点击选择的框体明细超出表格」
 *
 * 【两个缺陷的根因(实查)】
 *   ① 填写人:`yj_field.editable=0` + ButtonService.QC_DOC_PREPARER[QC_BHG]=填写人
 *      ⇒ 它是**纯落款**:save() 把该键从入参剥掉、前端也改不了,而原来只有**提交审批**
 *      那一刻(writeBackSignCell)才写值 ⇒ 草稿期纸面上永远是空的(截图即证据)。
 *      更糟的是右上信息表那条渲染分支**只认 sheet 级 editable、不认字段元数据 readonly**,
 *      于是这一格还是个能打字的输入框 —— 填了也存不进去,"填了白填"。
 *   ② 填写部门:该字段是 DEPT 参照,信息表里渲染 .as-ref-ctl;而 .as-ref-ctl 写死
 *      width:200px(那是顶栏「文档编号」小格的尺寸),信息表值区只有
 *      250 - 100(标签) - 1(竖线) - 8(左内距) ≈ 141px ⇒ 虚线框右侧顶出纸面边框。
 *
 * 【本文件钉住的东西】前端默认值 / 信息表字段级只读 / 参照框宽度约束 / 后端创建人预填。
 * 任何一条被删或改回去,对应报障就会复发。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDocDefaults } from '../panel/docDefaults.js'
import { qcSheetCfgs } from './docSheetConfigs.js'

const VUE = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const JAVA = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')

const USER = { realName: '冯敏', userName: 'fengmin' }

/** 取 <style> 段(避免把 template 里的字符串算进来) */
const STYLE = (() => {
  const m = VUE.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  return m ? m[1] : ''
})()

test('① 新增不合格报告(制程):「填写人」默认当前登录人姓名', () => {
  const form = {}
  applyDocDefaults('QC_BHG', form, USER, { isNew: true })
  assert.equal(form['填写人'], '冯敏')
})

test('① 已有草稿(非新增)的「填写人」为空时也要带出 —— 用户报障那张就是 2026-09-10 的老草稿', () => {
  const draft = {}
  applyDocDefaults('QC_BHG', draft, USER, { isNew: false })
  assert.equal(draft['填写人'], '冯敏', '只补新增的话，打开既有空草稿仍然是空的')
})

test('① 已有值时一律不覆盖(不冒名),没有登录人时不写空姓名', () => {
  const filled = { 填写人: '陈秀丽' }
  applyDocDefaults('QC_BHG', filled, USER, { isNew: false })
  assert.equal(filled['填写人'], '陈秀丽', '别人填过的姓名不许被后来打开的人抢走')
  const noName = {}
  applyDocDefaults('QC_BHG', noName, { realName: '', userName: 'fengmin' }, { isNew: true })
  assert.equal(noName['填写人'], 'fengmin', '与 user store 的 realName getter 同口径:姓名优先、退回账号')
  const nobody = {}
  applyDocDefaults('QC_BHG', nobody, {}, { isNew: true })
  assert.equal(String(nobody['填写人'] ?? ''), '', '没有登录人时不能凭空写个空姓名进去')
})

test('① 后端:建单/保存时按创建人预填「填写人」(只填空值;提交审批仍刷成提交人)', () => {
  assert.match(JAVA, /PREPARER_CREATOR_PREFILL\s*=\s*java\.util\.Set\.of\("QC_BHG"\)/,
    '缺少「创建人预填」面板登记')
  assert.match(JAVA, /private void prefillPreparerName\(PanelRegistry\.PanelDef def, String no, String user\)/,
    '缺少预填实现')
  // 两个调用点:空白草稿分支(直接 return,走不到保存末尾)+ 保存末尾
  const calls = JAVA.match(/prefillPreparerName\(def, no, user\);/g) || []
  assert.ok(calls.length >= 2, `预填必须在两条路径都调(空白草稿 + 正常保存),实际 ${calls.length} 处`)
  assert.ok(JAVA.includes('AND ([" + col + "] IS NULL'), '必须只在空值时写,不能覆盖已有值')
})

test('② 信息表参照框宽度跟随格子(填写部门的「点击选择」不得顶出表格)', () => {
  const m = STYLE.match(/\.as-info-value \.as-ref-ctl\s*\{([\s\S]*?)\}/)
  assert.ok(m, '缺少 .as-info-value .as-ref-ctl 约束规则')
  assert.match(m[1], /width:\s*100%/, '宽度必须交给格子(原写死 200px 会溢出)')
  assert.match(m[1], /flex:\s*1 1 0/, 'flex-basis 必须归零,否则仍按内容宽撑开')
  assert.match(m[1], /min-width:\s*0/, 'flex item 默认 min-width:auto,不写就不肯缩')
  // 值区本身也要能收缩
  const value = STYLE.match(/\.as-info-value\s*\{([\s\S]*?)\}/)
  assert.ok(value, '缺少 .as-info-value 规则')
  assert.match(value[1], /min-width:\s*0/)
})

test('② 信息表格子认字段级只读:填写人渲染成纯文本,不再给「填了存不进」的输入框', () => {
  assert.match(VUE, /function infoLocked\s*\(/, '缺少 infoLocked(按 yj_field.readonly 判只读)')
  assert.match(VUE, /editable && !infoLocked\(info\)/, '信息表的编辑控件必须过字段只读')
  // 只读兜底分支仍是文本渲染(与签名格 signKeyLocked 同口径)
  assert.match(VUE, /<AnnotatedText v-else :text="head\[info\.key\] \|\| ''"/)
})

test('② QC_BHG 右上信息表仍是「填写部门 / 填写人 / 填写日期」三行(版式不变)', () => {
  const info = qcSheetCfgs.QC_BHG.info
  assert.deepEqual(info.map((i) => i.label), ['填写部门', '填写人', '填写日期'])
  // 填写部门是指向 DEPT 的参照字段(才会有「点击选择」框)—— 数据键中文、不随语言变
  assert.equal(info[0].key, '填写部门')
  assert.equal(info[1].key, '填写人')
})
