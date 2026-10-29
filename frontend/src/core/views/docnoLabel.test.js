/**
 * docnoLabel.test.js —— 纸张右上角「编号」格的**标识文案**（2026-10-28 用户口径）
 *
 * 【用户原话】「立项申请的右上角的文件编号名字改为项目编号」
 *
 * 【改的是什么】只改**显示层那个名字**，数据键仍是「文档编号」（ADR-0001 红线：
 *   数据键永远中文、不随口径/语言变化）。落库列、`yj_field.col_name`、参照链路一律不动，
 *   所以老单据不用迁移、下游 RD_PLAN 按「文档编号」参照的关联一字不变。
 *
 * 【为什么要一个函数而不是写死】`DocSheet.vue` 里原本两处写死 `tt('文档编号：')` ——
 *   写死的词条改不了；且同族面板（RD_PLAN）不该跟着变，必须按面板区分。
 *   判定表收在 docSheetConfigs.js（可单测），组件只负责渲染。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { docnoLabel } from './docSheetConfigs.js'

const sheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('立项申请的右上角编号标识 = 「项目编号」', () => {
  assert.equal(docnoLabel('RD_APPROVAL'), '项目编号')
})

test('未登记的面板保持原口径（回空串 ⇒ 仍走「文档编号：」/ 裸值）', () => {
  for (const p of ['RD_PLAN', 'RD_MOLD_PROC', 'RD_SPEC_DOC', '']) {
    assert.equal(docnoLabel(p), '', `${p} 不该被本批口径波及`)
  }
})

test('DocSheet 的编号格标识由 docnoLabel 派生，不再写死「文档编号：」', () => {
  assert.match(sheet, /docnoLabel/, '要 import 并用 docnoLabel(props.panelCode)')
  // 反例守卫：写死词条 ⇒ 立项申请永远改不叫，且同族面板会被一起改掉
  assert.ok(!/tt\('文档编号：'\)/.test(sheet),
    "DocSheet 里不该再有写死的 tt('文档编号：')")
})

test('新增 UI 文案必须有多语言词条（en 至少，AGENTS 红线）', () => {
  assert.match(en, /'项目编号：':/, '缺这条 ⇒ 英文界面下这一格仍显示中文')
})
