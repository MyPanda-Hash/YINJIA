/**
 * rdGradeMergeIntoApprove.test.js —— 「定级分发」按钮并入「审批通过」
 *
 * 【用户原话 2026-10-28】
 *   「在审批人点击审批通过的时候弹窗能定级能选对接人，把**定级分发这个按钮去掉**，
 *     就是把定级分发的功能合并到审批通过里面」
 *
 * 【背景】上一轮（1ec909e4）已经让审批弹窗能选对接人并默认带出已有对接人，
 *   但侧栏**同时**还留着「定级分发」按钮 —— 两个地方都能定级/分发，入口重复。
 *   本轮把侧栏那个按钮去掉，只留审批通过一条路。
 *
 * 【为什么还要一个「补发对接人」】
 *   对接人在审批弹窗里是**选填**（clearable，且历史单审批时根本没有这个字段）；
 *   按钮一删，凡是「已审批/已归档但仍无对接人」的单就再也没有入口写 `备用1`
 *   ⇒ 永久卡死（实测正式账套有 2 张：LXA-2026-10-0013 / LXA-2026-10-0018，
 *   两张都没有下游实施计划）。所以保留一个**条件极窄**的补救入口：
 *   正常单据永远看不到它，只在缺对接人时出现，名字也不再叫「定级分发」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const buttonService = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('侧栏不再有「定级分发」按钮（模板与弹窗都清掉）', () => {
  // 模板里不该再有可见的「定级分发」按钮文案（注释里提到历史口径不算）
  assert.ok(!/\{\{ tt\('定级分发'\) \}\}/.test(panelx),
    '模板里不能再渲染「定级分发」按钮文字')
  assert.ok(!/<el-dialog v-model="gradeDispatchVisible"/.test(panelx),
    '「定级分发」弹窗要整个删掉，留着就是第二套入口')
  // 配套的状态与方法也要清（留着是死代码，且会误导下一个人以为入口还在）
  for (const dead of ['gradeDispatchVisible', 'gradeDispatchBusy', 'openGradeDispatch', 'confirmGradeDispatch']) {
    assert.ok(!new RegExp(`\\b${dead}\\b`).test(panelx), `${dead} 是已删除按钮的残留，应一并清掉`)
  }
})

test('审批通过弹窗同时承担定级与分发对接人（唯一入口）', () => {
  // 精确到本弹窗的 </el-dialog>，避免切到后面的弹窗（固定长度切片会跨窗撞键）
  const start = panelx.indexOf('<el-dialog v-model="apvVisible"')
  assert.ok(start >= 0, '找不到审批通过弹窗')
  const end = panelx.indexOf('</el-dialog>', start)
  const dlg = panelx.slice(start, end)
  assert.ok(dlg.length > 200, '找不到审批通过弹窗')
  assert.match(dlg, /apvLevel/, '弹窗里要有项目等级')
  assert.match(dlg, /apvLiaison/, '弹窗里要有对接人')
  // 提交时的载荷在 script 里（不在弹窗模板里）
  assert.match(panelx, /对接人: apvLiaison\.value/, '对接人要随 formData 发出去')
})

test('漏填/历史单有极窄的补救入口「补发对接人」，条件来自后端', () => {
  assert.match(panelx, /v-if="panelCode === 'RD_APPROVAL' && rdFlow\.canRepairLiaison"/,
    '补救按钮的显隐必须是后端判据 canRepairLiaison（前端自己算会与门禁漂移）')
  assert.match(panelx, /\{\{ tt\('补发对接人'\) \}\}/, '名字不能还是「定级分发」')
  assert.match(panelx, /const repairLiaisonTip = computed\(/, '置灰/说明理由要有一个提示计算属性')
  // 后端要真的把这个字段发下来
  assert.match(buttonService, /out\.put\("canRepairLiaison", settled && liaison\.isEmpty\(\) && canApprove\(user, "RD_APPROVAL"\)\)/,
    'canRepairLiaison = 已定形 ∧ 无对接人 ∧ 有审批权（正常单据恒 false ⇒ 永远看不到按钮）')
})

test('补救弹窗只填对接人，等级只读沿用（不再在弹窗里改级）', () => {
  assert.match(panelx, /<el-dialog v-model="repairLiaisonVisible"/, '要有一个独立的补救弹窗')
  const dlg = panelx.slice(
    panelx.indexOf('<el-dialog v-model="repairLiaisonVisible"'),
    panelx.indexOf('<el-dialog v-model="repairLiaisonVisible"') + 1800)
  assert.match(dlg, /rdFlow\.level/, '要把沿用的等级显示出来（只读文本，不是单选框）')
  assert.ok(!/<el-radio-group/.test(dlg), '补救弹窗里不该再有等级单选（改级仍只能弃审）')
  assert.match(dlg, /liaisonUser/, '要能选对接人')
})

test('新增 UI 文案有多语言词条（en 至少）', () => {
  assert.match(en, /'补发对接人':/)
  assert.match(en, /'本单已审批但没有对接人：补一个对接人后，他才能签核并确认项目责任人':/)
})
