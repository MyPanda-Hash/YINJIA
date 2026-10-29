/**
 * docNoPlaceholder.test.js —— 「编号」格的输入提示词不能长得像"已经有个固定编号"
 *
 * 【用户原话 2026-10-28】「出货检验计划表显示的编号的占位背景提示词会让人误会是固定的一个编号
 *   在这边，需要优化一下所有的单据编号的背景提示词」
 *
 * 【截图里看到什么】右上角：左侧黑字「编号：」，右边输入框里灰字**又是一个「编号：」**——
 *   两处一模一样，用户读到的是"这里已经印着一个编号"，不知道该不该填、填什么。
 *
 * 【根因】`RecordSheetPanels.vue` 的输入框 placeholder 写的是
 *   `docnoPrefix ? '编号：' : docNoKey` —— 带了前缀的面板就把**前缀本身**当提示词，
 *   于是标识与提示词同字重复；带前缀时还丢掉了"该填什么号"的信息。
 *
 * 【口径】提示词要说**填什么**（这份文档编号/单号），不再复述前缀；不带前缀的面板
 *   （设计原值是裸编号的 7 张数据记录表）本来就用 `docNoKey`，保持不变。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('RecordSheetPanels 编号输入框不再把「编号：」当提示词', () => {
  assert.ok(!/docnoPrefix\s*\?\s*'编号：'/.test(panels),
    '不能再用「编号：」当 placeholder —— 它会与左侧黑字前缀完全重复，看起来像个固定编号')
  assert.match(panels, /'请输入编号'/, '提示词应改成「请输入编号」这类"要你填"的说法')
})

test('提示词走 tt()，且 en 有词条（AGENTS 多语言红线）', () => {
  // 该行是多行标签写法，故直接在全文里找 placeholder 表达式
  assert.match(panels, /:placeholder="tt\(docnoPrefix \? '请输入编号' : docNoKey\)"/,
    '必须包在 tt() 里，且保留 docNoKey 分支')
  assert.match(en, /'请输入编号':/, '缺这条 ⇒ 英文界面下这里掉回中文')
})

test('不带前缀的面板（裸编号设计）仍用字段名做提示，不被本批影响', () => {
  // 保留 docNoKey 分支：那 7 张纸设计原值就是裸编号，提示词给字段名更准确
  assert.match(panels, /:placeholder="tt\(docnoPrefix \? '请输入编号' : docNoKey\)"/,
    'docNoKey 分支要保留（裸编号面板靠它出提示）')
})

test('DocSheet 的编号提示词也不与「项目编号：」前缀重复', () => {
  // DocSheet 的 input 是多行属性写法，取标签块再判
  const at = docSheet.indexOf("v-model=\"head['文档编号']\"")
  assert.ok(at >= 0, '找不到 DocSheet 的编号输入框')
  const block = docSheet.slice(at, at + 300)
  assert.ok(!/:placeholder="tt\(docnoLabelText\)"/.test(block),
    'placeholder 不该等于标识文案本身（会与左侧「项目编号：」重复）')
  assert.match(block, /请输入编号/, '统一改成"请输入编号"')
})
