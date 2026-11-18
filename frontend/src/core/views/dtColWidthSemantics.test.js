/**
 * 明细表列宽口径（2026-11-18 修「炭棒配方管控清单 配方表整表比纸宽出一倍」）。
 *
 * 【根因】`<col span=N style="width:W">` 按 HTML 语义是**每列都 W**（总宽 W×N）。
 *   而配置里的 `w` 一直是"该列**总**宽"（所有可见列 w 之和 = 纸宽 780，
 *   `wideSheetNarrow.test` 正是这么钉的）⇒ 某列同时有 span 与 w 时被放大 N 倍：
 *   实测 物料种类 127×2=254、物料编号 181×4=724、物料名称 164×3=492，整表 780 → 1779px。
 *
 * 【修法】宽度先按 span 均分：`(w × K) / span` ⇒ 该列总宽恒等于 w×K；
 *   同时 `dtColSum` / `dtFillK` 也改成"按列总宽累加"，三处口径必须一致
 *   （否则表格 width 与 colgroup 总宽不一致，浏览器会二次拉伸）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

test('colgroup 宽度必须按 span 均分', () => {
  const at = vue.indexOf('v-for="(c, i) in visCols(dt)"')
  assert.ok(at > 0, '找不到明细表 colgroup')
  const seg = vue.slice(at, at + 420)
  assert.match(seg, /\(c\.span \|\| 1\)/, 'span 属性仍在')
  assert.match(seg, /\/ \(c\.span \|\| 1\)/, '宽度必须除以 span（否则总宽被放大 N 倍）')
})

test('dtColSum / dtFillK 与 colgroup 同口径（不乘 span）', () => {
  const sumAt = vue.indexOf('function dtColSum(dt)')
  assert.ok(sumAt > 0, '缺 dtColSum')
  const sumSeg = vue.slice(sumAt, sumAt + 400)
  assert.doesNotMatch(sumSeg, /\(c\.span \|\| 1\) \*/, 'dtColSum 不得再乘 span')
  assert.match(sumSeg, /sum \+ \(c\.w \|\| 100\)/, 'dtColSum 按列总宽累加')

  const fillAt = vue.indexOf('function dtFillK(dt)')
  const fillSeg = vue.slice(fillAt, fillAt + 500)
  assert.doesNotMatch(fillSeg, /\(c\.span \|\| 1\) \*/, 'dtFillK.want 不得再乘 span')
})

test('配置侧仍守「可见列 w 之和 = 纸宽」的旧口径（本修复不靠改配置）', () => {
  // 该断言由 wideSheetNarrow.test 负责；这里只确认配方表三个 span 列的 w 没被改成"每单元宽"
  const cfg = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')
  const i = cfg.indexOf("bar: '配方表'")
  const seg = cfg.slice(i, i + 3000)
  assert.match(seg, /key: '物料种类'[^}]*span: 2, w: 127/, '物料种类 应为 span2 + 总宽127')
  assert.match(seg, /key: '物料编号'[^}]*span: 4, w: 181/, '物料编号 应为 span4 + 总宽181')
  assert.match(seg, /key: '物料名称'[^}]*span: 3, w: 164/, '物料名称 应为 span3 + 总宽164')
})
