/**
 * 项目实施计划「测试方案」三子区的排版（2026-11-18 用户报障）。
 *
 * 用户截图：测试方法的**长文本压住了**「测试标准：150字」那一行，字叠在一起。
 *
 * 根因：`.as-sub { flex:1; min-height:0 }` ⇒ 三个子区**等分**行高（row.h=160 ⇒ 每块 ~53px），
 *   而只读文本 `.as-ro-text` 没有溢出约束 ⇒ 内容一长就溢出格子、盖住下一块。
 *
 * 修法：子区改为**按内容自然高度**（flex:0 0 auto）+ 与等分时相当的最小高度 52px：
 *   内容短 ⇒ 三块各 ~52px，版式与设计一致；内容长 ⇒ 该块自己长高、把整行撑开（行是 min-height）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { planSheetCfg } from './docSheetConfigs.js'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

function cssBlock(selector) {
  // 必须匹配**行首**规则：文件里还有 `.approval-sheet .as-ro-text {` 这类带前缀的写法，
  // 用纯 indexOf 会先命中它（那条 word-break 是 break-word，断言会假红）。
  const at = vue.indexOf('\n' + selector + ' {')
  assert.ok(at > 0, `缺 ${selector} 样式`)
  return vue.slice(at, vue.indexOf('}', at))
}

test('子区不得等分高度（否则长文本溢出压住下一块）', () => {
  const block = cssBlock('.as-sub')
  assert.match(block, /flex:\s*0 0 auto/, '子区要按内容自然高度')
  assert.doesNotMatch(block, /flex:\s*1;/, '不得再用 flex:1 等分')
  assert.match(block, /min-height:\s*52px/, '保留与三等分相当的最小高度（版式不变）')
})

test('只读文本仍允许换行（长文本靠换行而不是溢出）', () => {
  const t = cssBlock('.as-ro-text')
  assert.match(t, /white-space:\s*pre-wrap/, '保留换行')
  assert.match(t, /word-break:\s*break-all/, '长串要能断行')
})

test('测试方案行仍是 3 个子区、行高 160（配置未动）', () => {
  const row = planSheetCfg.rows.find((r) => r.label === '测试方案')
  assert.ok(row, '缺测试方案行')
  assert.equal(row.h, 160, '行高仍是设计值')
  assert.deepEqual(row.subs.map((s) => s.label), ['测试条件', '测试方法', '测试标准'])
  // 2026-11-24：上限从 150 提到 500 —— 三列物理列都是 nvarchar(500)，写 150 会在内容写满时
  // 把该格锁死（与「测试产品打样要求 max:100」同一个坑，见 paperFieldCaps.test.js）。
  for (const s of row.subs) assert.equal(s.max, 500, '每格上限 = 列容量 500')
})
