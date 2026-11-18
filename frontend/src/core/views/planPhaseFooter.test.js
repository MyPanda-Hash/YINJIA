/**
 * 项目实施计划：阶段框底部的「完成 / 申请终止」按钮可见性（2026-11-17 用户报障）。
 *
 * 用户原话：「查一下服务器上的项目实施计划的项目终止功能是否正常使用，
 *   有人反应说找不到终止按钮这些了」。
 *
 * 根因**不在后端**：/px/planTerm 正常（生产 LXB-2026-11-0002 实测 state=P2、留痕完整），
 * 两条审批动作也都在。问题在模板的**判据写窄了**：
 *   v-if="canStageComplete && head[ph.key + '_计划内容']"
 * 只认「计划内容」这一格，而生产数据里用户往往先填「计划开始/计划完成」、把「计划内容」留空
 * ⇒ 完成 + 申请终止 两颗按钮整条消失，界面上毫无提示。
 *
 * 正确判据是同文件已导入的 hasPhaseContent(head, num)：5 个字段（计划内容/计划开始/
 * 计划完成/实际完成/责任人）任一非空。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const stages = readFileSync(new URL('../progress/stageProgress.js', import.meta.url), 'utf8')

test('阶段底部按钮的判据必须用 hasPhaseContent（不能只认「计划内容」）', () => {
  const at = vue.indexOf('class="as-phase-footer"')
  assert.ok(at > 0, '找不到阶段底部按钮容器 as-phase-footer')
  // 往回取同一行的 v-if
  const lineStart = vue.lastIndexOf('\n', at) + 1
  const line = vue.slice(lineStart, vue.indexOf('\n', at))
  assert.match(line, /canStageComplete/, '仍要要求「可完成」状态（已审核+只读）')
  assert.match(line, /hasPhaseContent\(head, ph\.num\)/, '判据必须是 hasPhaseContent(head, ph.num)')
  assert.doesNotMatch(line, /head\[ph\.key \+ '_计划内容'\]/, '不得再只认「计划内容」单字段')
})

test('同文件的 data-filled 也用同一判据（两处口径一致）', () => {
  assert.match(vue, /:data-filled="hasPhaseContent\(head, ph\.num\)/, 'data-filled 必须用 hasPhaseContent')
  assert.match(vue, /import \{[^}]*hasPhaseContent[^}]*\} from '@core\/progress\/stageProgress'/, '必须导入')
})

test('hasPhaseContent 的语义：5 个字段任一非空即为已填', () => {
  assert.match(stages, /PHASE_FIELDS = \['计划内容', '计划开始', '计划完成', '实际完成', '责任人'\]/,
    '阶段字段清单不许改窄')
  assert.match(stages, /some\(\(field\) => text\(head\[`阶段\$\{no\}_\$\{field\}`\]\) !== ''\)/,
    '判据是「任一非空」')
})

test('申请终止入口仍在（阶段底部 v-if="!term"）', () => {
  assert.match(vue, /v-if="!term"[\s\S]{0,120}doTermRequest\(ph\.num\)/, '申请终止按钮不得丢失')
  assert.match(vue, /doTermAction\('终止审批通过'\)/, '审批通过入口不得丢失')
  assert.match(vue, /doTermAction\('撤回终止申请'\)/, '撤回入口不得丢失')
})
