/**
 * 项目实施计划「阶段隐藏」必须对审核人同样生效（2026-11-17 用户报障）。
 *
 * 用户原话（1117问题 #4）：「阶段隐藏后保存，审核人打开还是可以看到多个阶段」。
 *
 * 根因：`phaseHidden` 只是组件内 reactive，**从不落库**；审核人/重新打开时自然回到"全显示"。
 * 修法不引入新库字段：改为按数据推导 ——
 *   · 可编辑态：10 个阶段框全显示（否则没法填空白阶段）；
 *   · 只读态（已审核/已归档，即审批人看到的态）：只显示填过内容的阶段。
 * 于是"隐藏未使用阶段"变成**数据事实**，谁打开都一致，保存/刷新都不会丢。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('阶段框可见性按数据推导，而不是只认本地 phaseHidden', () => {
  const at = vue.indexOf('function phaseVisible(')
  assert.ok(at > 0, '缺 phaseVisible')
  const seg = vue.slice(at, at + 420)
  assert.match(seg, /if \(props\.editable\) return true/, '可编辑态全显示')
  assert.match(seg, /hasPhaseContent\(props\.head \|\| \{\}, num\)/, '只读态按内容判定')
  assert.match(seg, /if \(phaseHidden\[pi\]\) return false/, '手动隐藏仍生效')
})

test('模板用 phaseVisible(pi, ph.num) 渲染阶段框', () => {
  assert.match(vue, /v-if="phaseVisible\(pi, ph\.num\)"/, '阶段框 v-if 必须走 phaseVisible')
  assert.doesNotMatch(vue, /v-if="!phaseHidden\[pi\]"/, '不得再用裸 phaseHidden 判可见')
})

test('「显示全部」用统一计数并能恢复', () => {
  assert.match(vue, /const hiddenPhaseCount = computed\(/, '缺 hiddenPhaseCount')
  assert.match(vue, /v-if="hiddenPhaseCount"[^>]*@click\.stop="phaseHidden = \{\}; showAllPhases = true"/,
    '复原按钮要清本地隐藏并打开 showAllPhases')
})
