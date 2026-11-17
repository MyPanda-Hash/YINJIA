/**
 * 内部样品单「样品状态」底色（2026-11-17 用户口径，Excel #4）。
 * 「待确认（填充红色）/ 已确认（黄色）/ 已安排（黄色）/ 已完成（绿色）」
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('stateTone 三档映射与用户口径一致', () => {
  const at = vue.indexOf('function stateTone(')
  assert.ok(at > 0, '缺 stateTone')
  const seg = vue.slice(at, at + 520)
  assert.match(seg, /'待确认'\) return 'red'/, '待确认 → 红')
  assert.match(seg, /'已确认'.*'已安排'\) return 'yellow'/, '已确认/已安排 → 黄（同一档）')
  assert.match(seg, /'已完成'\) return 'green'/, '已完成 → 绿')
  assert.match(seg, /return 'none'/, '未知值落灰，不猜色')
})

test('只读态渲染带色胶囊，编辑态套同色底', () => {
  assert.match(vue, /class="sg-state" :class="'st-' \+ stateTone\(row\[c\.key\]\)"/, '只读态要用胶囊')
  assert.match(vue, /c\.key === '样品状态' \? \('st-' \+ stateTone\(row\[c\.key\]\)\)/, '编辑态下拉要染色')
})

test('三档 CSS 都定义了（红/黄/绿）', () => {
  for (const [cls, color] of [['st-red', '#cf1322'], ['st-yellow', '#d48806'], ['st-green', '#389e0d']]) {
    assert.match(vue, new RegExp(`\\.sg-state\\.${cls} \\{[^}]*${color}`), `${cls} 要定义成 ${color}`)
  }
})
