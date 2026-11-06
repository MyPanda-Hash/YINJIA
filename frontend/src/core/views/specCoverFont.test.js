/**
 * specCoverFont.test.js —— 产品规格书封面「一页一字号」不变量
 *
 * 【用户口径】
 *   2026-11-06 第一次:「把规格书的第一页的字体大小统一一下，应该是草稿状态显示的问题」
 *   2026-11-06 第二次(本次):「规格书框内字体大小不一致，草稿状态也要一致的」
 *
 * 【为什么会两轮】
 *   封面的值格有**四条渲染分支**，字号必须一致，但四条各自独立写 CSS：
 *     ① 单行 el-input        → `.el-input__inner`
 *     ② 多行 el-input(textarea，整体规格参数/产品主要性能) → `.el-textarea__inner`
 *     ③ 引用控件(产品编号 prodPick) → `.rsp-cover-docno-pick`(值 span 继承)
 *     ④ 只读/审批后纯 span   → `.rsp-cover-val`
 *   上一轮只修了 ①(给 `.rsp-cover-input :deep(.el-input__inner)` 加 `.rs-t` 前缀压过通用的
 *   13.5px)，**漏了 ②** —— textarea 的内层不是 `.el-input__inner`，仍被通用规则
 *   `.rs-t :deep(.el-textarea__inner){font-size:13.5px}` 命中。实测(8090 草稿态,A-54-12):
 *     产品编号/产品名称/…/版本 = 28.261px SimSun,
 *     整体规格参数/产品主要性能 = **13.5px Helvetica Neue** ← 就是用户看到的"大小不一致"。
 *
 * 【本测试守什么】四条分支的 font-size 必须写成**同一表达式**(都按 --cok 缩放)，
 *   且都用宋体；并且封面规则都必须带 `.rs-t` 前缀(否则被通用 13.5px 同特异性压掉)。
 *   这条不是"好看"问题：草稿态与审批后字号跳变，同一张单在"填写时"和"打印出来"是两个样。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

/** 取某个选择器的**全部**规则体(同一个选择器可能分多段写),拼起来查声明 */
function declsOf(selector) {
  const out = []
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g')
  for (const m of src.matchAll(re)) out.push(m[1])
  return out.join('\n')
}

const fontSizes = (sel) => [...declsOf(sel).matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim())

/** 四条值格分支：选择器 → 人类可读名 */
const BRANCHES = {
  '单行输入框': '.rs-t .rsp-cover-input :deep(.el-input__inner)',
  '多行域(textarea)': '.rs-t .rsp-cover-input.rsp-cover-area :deep(.el-textarea__inner)',
  '引用控件(产品编号)': '.rsp-cover-vl-pick',
  '只读值': '.rsp-cover-val',
}

test('封面四条值格分支(单行/多行/引用/只读)必须同一字号表达式', () => {
  const got = {}
  for (const [name, sel] of Object.entries(BRANCHES)) {
    const sizes = fontSizes(sel)
    assert.ok(sizes.length, `缺少「${name}」的字号规则(${sel}) —— 草稿态会退回通用 13.5px`)
    got[name] = sizes[0]
  }
  const uniq = [...new Set(Object.values(got))]
  assert.equal(uniq.length, 1,
    '封面值格出现多种字号:' + JSON.stringify(got, null, 1) + '\n草稿态(el-input/textarea/pick)与只读态(.rsp-cover-val)必须同号')
  assert.match(uniq[0], /calc\(27\.3px \* var\(--cok\)\)/,
    '封面字号必须按 --cok 缩放(设计 20.5pt ≈ 27.3 设计px),实际: ' + uniq[0])
})

test('封面四条值格分支都用宋体(字体族也要统一,否则"大小"看着仍不一致)', () => {
  for (const [name, sel] of Object.entries(BRANCHES)) {
    assert.match(declsOf(sel), /font-family:[^;]*SimSun/,
      `「${name}」没有指定宋体 —— 会退回 Helvetica Neue/Arial,与其它格不同族`)
  }
})

test('封面规则必须带 .rs-t 前缀(否则被通用表区 13.5px 规则同特异性压掉)', () => {
  // 通用规则是别的表区的命根子,不许为了封面把它删了
  assert.match(src, /\.rs-t :deep\(\.el-input__inner\)/, '通用表区单行输入框规则不应被删')
  assert.match(src, /\.rs-t :deep\(\.el-textarea__inner\)/, '通用表区多行域规则不应被删')
  // 封面这两条必须是 .rs-t 前缀(特异度高于通用规则)
  assert.match(src, /\.rs-t \.rsp-cover-input\.rsp-cover-area :deep\(\.el-textarea__inner\)/,
    '封面多行域的规则必须写成 `.rs-t .rsp-cover-input.rsp-cover-area :deep(.el-textarea__inner)`')
})
