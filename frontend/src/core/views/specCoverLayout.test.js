/**
 * specCoverLayout.test.js —— 产品规格书封面的三项版式改动
 *
 * 【用户口径 2026-10-28 截图《产品规格书》】
 *   ①「把产品规格书的产品编号做成和产品类别一样的大表格进行填写，引用还是可以引用的」
 *   ②「原来的产品编号的位置改为自动生成的单据编号，现在的单据编号不是看不到吗？」
 *   ③「把产品规格书的表格做宽一点点，现在看起来有一点窄了」
 *
 * 【背景事实（实测）】规格书本身有自动单号：`SD-2026-10-0001/0002`（后端按 SD- 前缀发号）。
 *   但封面右上角那一格 2026-09-30 起被改成绑「产品编号」，于是**单据号在纸面上完全看不到了**
 *   —— 用户问「现在的单据编号不是看不到吗」说的就是这件事。
 *
 * 【改法】
 *   ① 封面字段表第 1 行加「产品编号」，值格仍是 prodPick 引用控件（能引用、能带回）；
 *   ② 右上角那格改绑「单据编号」（自动号，只读）；`coverDocNoKey` 保留但指向单据编号；
 *   ③ 字段表宽度给出下限（原来由内容撑开，实测偏窄）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cfgSrc = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')
const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

/** 取 RD_SPEC_DOC 配置块（从键名起到它的 cover.pages 之前） */
function specBlock() {
  const at = cfgSrc.indexOf('RD_SPEC_DOC: {')
  assert.ok(at >= 0, '找不到 RD_SPEC_DOC 配置')
  return cfgSrc.slice(at, at + 6000)
}

test('① 封面字段表第一行是「产品编号」（和产品类别一样的大表格）', () => {
  const block = specBlock()
  // 直接找 cover: { 之后的 fields 数组第一项（中间可能有注释，故不跨行锚 cover 开头）
  const coverAt = block.indexOf('cover: {')
  assert.ok(coverAt >= 0, '找不到 cover 配置')
  const tail = block.slice(coverAt)
  const fieldsAt = tail.indexOf('fields: [')
  assert.ok(fieldsAt >= 0, '找不到 cover.fields')
  const after = tail.slice(fieldsAt + 'fields: ['.length)
  // 跳过空白与注释，取第一个 { label: '...' }
  const m = after.match(/\{\s*label:\s*'([^']+)'/) || after.replace(/\/\*[\s\S]*?\*\//g, '').match(/\{\s*label:\s*'([^']+)'/)
  assert.ok(m, '找不到 cover.fields 第一项')
  assert.equal(m[1], '产品编号', '字段表第一行必须是产品编号（用户要它和产品类别同款大表格）')
})

test('① 产品编号那一行保留引用控件（引用还能用）', () => {
  // 值格渲染分支:prodPick 存在且 key 命中 ⇒ 仍走 openProdPick
  assert.match(panels, /rsp-cover-vl/, '值列容器要还在')
  const src = panels
  // 字段表里必须为「产品编号」这一行保留引用入口（prodPick 的 targetKey）
  assert.match(src, /prodPickCfg/, '引用配置入口要还在')
  // 引用控件的 key 判据必须认 cover 里的「产品编号」
  assert.match(cfgSrc, /targetKey:\s*'产品编号'/, 'prodPick.targetKey 仍是产品编号')
})

test('② 右上角编号格改绑自动单据编号（单据号不再看不见）', () => {
  const block = specBlock()
  const m = block.match(/coverDocNoKey:\s*'([^']+)'/)
  assert.ok(m, '找不到 coverDocNoKey')
  assert.equal(m[1], '单据编号', '右上角应显示自动生成的单据编号（用户问「单据编号不是看不到吗」）')
})

test('② 右上角那格的标识文案跟着改成「单据编号：」', () => {
  // 文案由 coverDocNoLabel 计算属性生成（模板里只渲染 tt(coverDocNoLabel)）
  assert.match(panels, /const coverDocNoLabel = computed\(/, '要有一个按 key 出文案的计算属性')
  const at = panels.indexOf('const coverDocNoLabel = computed(')
  const block = panels.slice(at, at + 500)
  assert.match(block, /'单据编号：'/, '绑单据编号时文案必须是「单据编号：」')
  // 模板里不能再写死「产品编号：」那一套三元
  assert.match(panels, /tt\(coverDocNoLabel\)/, '模板要渲染这个计算属性')
})

test('③ 封面字段表给出宽度下限（原来只由内容撑开，偏窄）', () => {
  const at = panels.indexOf('.rsp-cover-fields {')
  assert.ok(at >= 0, '找不到 .rsp-cover-fields 样式')
  const css = panels.slice(at, at + 2500)
  assert.match(css, /min-width/, '要给出 min-width 下限，否则窄内容时整表就只那么宽')
  // 仍然不能用 fixed 布局（历史事故：fixed + 百分比导致标签压值）
  assert.match(css, /table-layout:\s*auto/, '必须保持 auto 布局（fixed 会造成标签压值）')
})
