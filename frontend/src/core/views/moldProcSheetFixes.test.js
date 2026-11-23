/**
 * moldProcSheetFixes.test.js —— 烧结工艺清单（RD_MOLD_PROC，纸面名「炭棒工艺管控清单」）
 * 两处线上报障的契约守卫（2026-11-20）
 *
 * 【问题 1】填写时下拉长文本压行
 *   用户截图：「烧结炉参数」格里的「1-1至2-3设置为190度，2-4至2-5设置为280度」超出格高、
 *   与相邻行重叠；「烧结时间/调速器参数」的「调速器设置7.4，对应烧结时间为55分钟」同样溢出。
 *   根因（Element Plus 2.14.4 活体实测）：单选 el-select 的**选中值**渲染在
 *   `.el-select__selected-item.el-select__placeholder` 里，而 Element 给 placeholder 的是
 *   `position:absolute; top:50%; transform:translateY(-50%)` —— **绝对定位不参与行高**。
 *   上一版只把 white-space 改成 normal，多行文字照样从 wrapper（24px）里溢出去：
 *   实测 54px 高的选中值塞在 24px 的 wrapper 里，上沿超出格子上沿 10.7px，被上一行白底盖住半截。
 *
 * 【问题 2】「实际灌料重量计算公式」必须是只读固定值
 *   旧配置是 ph（灰字占位）+ 可输入的 el-input ⇒ 纸面上看是一条可点的下划线格、还能被清空。
 *
 * 三层断言：
 *   ① 配置：公式格 ro:true + fixed 公式原文，不再带 ph；数据键 / 落库列不变；
 *   ② 渲染：row.grid 三处渲染都读到 c.ro 就不出输入框；只读文本走 tt(c.fixed)（10 语言已收录）；
 *   ③ CSS：折行规则存在、选择器落到 `td.rs-td`（行式 grid 的实际 DOM），且把绝对定位的选中值
 *      拉回文档流；高度只用 min-height、不写死 height（打印/导出同样不截断）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const VUE = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const EN = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

/** 公式原文（与 recordSheetConfigs.js / 10 个 i18n 语言文件的词条 key 逐字一致） */
const FORMULA = '实际灌料重量中间值=（1-理论水分%）/（1-实际水分%）*理论灌料重量中间值'

/** 递归收集一张面板配置里所有「格子」（sections/tailSections 的 rows[].grid[]/pairs[]，dataTables 的 cols[]） */
function collectCells(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) collectCells(n, out)
    return out
  }
  if (!node || typeof node !== 'object') return out
  if ('key' in node || 'label' in node) out.push(node)
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') collectCells(v, out)
  }
  return out
}

/** 取 `needle` 所在的第一条规则的声明体（{ 到 } 之间）；找不到 needle 视为断言失败 */
function ruleBody(src, needle) {
  const i = src.indexOf(needle)
  assert.ok(i > 0, `找不到选择器片段：${needle}`)
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  return src.slice(open + 1, close)
}

const moldCells = collectCells(recordSheetConfigs.RD_MOLD_PROC)

// ═══════════════════════════ ① 公式格只读 ═══════════════════════════

test('① 公式格只读：ro:true + fixed 公式原文，且不再挂可输入的 ph', () => {
  const hits = moldCells.filter((c) => c.key === '实际灌料重量计算公式')
  assert.equal(hits.length, 1, 'RD_MOLD_PROC 里应有且只有一个「实际灌料重量计算公式」数据格')
  const cell = hits[0]
  assert.equal(cell.ro, true,
    '必须是 ro:true —— row.grid 渲染分支靠它拦掉 el-input，否则还是可编辑格（用户截图里的下划线可点样式）')
  assert.equal(cell.fixed, FORMULA,
    '固定文案必须是公式原文：该格没值时纸面就显示它（数据键不变，历史值仍优先显示）')
  assert.equal(cell.ph, undefined,
    'ph 是占位提示、承载它的是可输入 el-input —— 只读格不该再发占位输入框，必须撤掉')
  assert.equal(cell.span, 8, '版式宽度不变（2 + 8 = 10 列，与设计一致）')
})

test('① 渲染层：row.grid 读到 c.ro 就不出输入框，只读文本走 tt(c.fixed)（多语言）', () => {
  // 三处行式 grid 渲染（页签 sections / 打印 plain 段 / 表尾 tailSections）都要有 ro 守卫
  const guards = VUE.match(/editable && c\.key && !c\.ro/g) || []
  assert.ok(guards.length >= 3,
    `row.grid 的输入分支必须带 !c.ro 守卫（找到 ${guards.length} 处，应有 ≥3 处）`)
  assert.match(VUE, /:text="head\[c\.key\] \|\| tt\(c\.fixed\) \|\| ''"/,
    '只读显示要 tt(c.fixed)：公式文案在 10 个语言文件里都有词条，不翻译会把中文带到英文/日文界面')
})

test('① 公式词条存在于 i18n（en.js），tt(c.fixed) 才有译文', () => {
  assert.ok(EN.includes(FORMULA), 'en.js 必须收录该公式词条，否则 tt() 回落中文（AGENTS §2.1）')
})

// ═══════════════════════════ ② 行式 grid 下拉折行 CSS ═══════════════════════════

test('② 行式 grid 的实际 DOM = tr > td.rs-td 里的 el-select，CSS 选择器必须落到这一层', () => {
  // 模板侧：行式 grid 分支的标签与数据格
  const gi = VUE.indexOf('<tr v-else-if="row.grid"')
  assert.ok(gi > 0, '找不到行式 grid 的 <tr> 分支')
  const seg = VUE.slice(gi, gi + 6000)
  assert.match(seg, /<td v-else class="rs-td"/, '行式 grid 的数据格是 td.rs-td')
  assert.match(seg, /<el-select v-model="head\[c\.key\]"/, '该数据格里渲染的就是 el-select')
  // 样式侧：.rs-t / .rsp-sheet 两条纸面前缀都要覆盖到 td.rs-td（否则只命中整张表、命中不到格子语义）
  for (const prefix of ['.rs-t :deep(', '.rsp-sheet :deep(']) {
    assert.ok(VUE.includes(prefix + 'td.rs-td .el-select__wrapper:not(:has(.el-select__input[aria-expanded'),
      `${prefix}… 必须覆盖到行式 grid 的 td.rs-td 下拉 —— 只写 .rs-t 的老规则命中整张表，压行那半截改不到`)
  }
})

test('② 收起态 + 有值：选中值 position:static 回到文档流（绝对定位不参与行高，正是压行根因）', () => {
  const body = ruleBody(VUE, 'td.rs-td .el-select__wrapper:not(:has(.el-select__input[aria-expanded')
  assert.match(body, /position:\s*static/,
    '必须 position:static —— Element 的 placeholder 是 absolute，不拉回文档流就撑不高行（文字会压到相邻行）')
  assert.match(body, /transform:\s*none/, '要清掉 EP 的 translateY(-50%)，否则多行文本仍以 wrapper 中线定位')
  assert.match(body, /white-space:\s*normal\s*!important/, '允许折行（EP 默认 nowrap）')
  assert.match(body, /overflow-wrap:\s*anywhere/, '长串（标准库里的长参数句）任意位置可断')
  assert.match(body, /min-width:\s*0/, 'flex 子项必须 min-width:0，否则长文本把格子撑宽而不是折行')
  assert.match(body, /line-height:\s*18px/, '行高固定 18px，格子高度按行数长')
})

test('② 收起态的过滤输入框 0×0：不给下拉格白加一行（但仍是可聚焦元素，点格子能展开）', () => {
  const body = ruleBody(VUE, ':has(.el-select__input[aria-expanded=\'true\'])) .el-select__input-wrapper')
  assert.match(body, /position:\s*absolute/)
  assert.match(body, /width:\s*0/)
  assert.match(body, /height:\s*0/)
  assert.doesNotMatch(body, /display:\s*none/,
    '不能 display:none —— 输入框要能被 focus（否则 filterable/allow-create 的展开与筛选会坏）')
})

test('② 高度只用 min-height：不写死 height（写死会把多行选中值裁掉、打印也截断）', () => {
  const body = ruleBody(VUE, '.rs-t :deep(.el-select__wrapper),')
  assert.match(body, /height:\s*auto/, '外层高度随内容')
  assert.match(body, /min-height:\s*28px/, '小号下拉 28px 起步（行容器用 min-height）')
  // 只看独立 height（min-height 允许，且正是我们要的）；`min-height` 前面是 '-'，不会被下面这条命中
  assert.doesNotMatch(body, /(?:^|[\s;{])height:\s*\d+px/, '禁止固定 height —— 多行会被裁掉')
})

test('② 兜底：纸面下拉的选中值/占位符默认单行省略（展开态与空值态不溢出）', () => {
  const body = ruleBody(VUE, '.rs-t :deep(.el-select__placeholder),')
  assert.match(body, /white-space:\s*nowrap\s*!important/)
  assert.match(body, /overflow:\s*hidden\s*!important/)
})

test('② 打印/导出：纸面下拉文字仍允许折行（unscoped 打印样式里的 white-space:normal 没被删）', () => {
  const i = VUE.lastIndexOf('.rsp-sheet .el-select__placeholder')
  assert.ok(i > 0, '打印样式里应有 .rsp-sheet .el-select__placeholder 规则')
  const seg = VUE.slice(i, i + 500)
  assert.match(seg, /white-space:\s*normal\s*!important/,
    '打印/侧栏打印要折行显示，不能截断（用户口径：打印态也不截断）')
})

test('③ 回归：.rs-focus 的聚焦红框选择器列表未被折行规则截断（2026-11-19 曾被插断）', () => {
  const i = VUE.indexOf('.rs-focus :deep(.el-input__wrapper),')
  assert.ok(i > 0, '找不到 .rs-focus 的聚焦样式')
  const seg = VUE.slice(i, i + 220)
  assert.match(seg,
    /\.rs-focus :deep\(\.el-textarea__inner\),\s*\n\.rs-focus :deep\(\.el-select__wrapper\) \{\s*\n\s*box-shadow: 0 0 0 1px #f56c6c inset;/,
    '三个聚焦选择器必须共用同一个 box-shadow 声明块（上一版把折行规则插在中间，聚焦红框被拆散）')
  assert.doesNotMatch(seg, /\.rs-t :deep\(/, '下拉折行规则不能粘进 .rs-focus 的选择器列表')
})
