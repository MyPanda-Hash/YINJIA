/**
 * recordSheetDateCellWidth.test.js —— 记录表「日期/时间格」的控件必须**收在单元格里**
 *
 * 【用户报障 2026-10-28】
 *   「研发模块的仪器使用记录表的起止时间显示位置异常」——截图里「06:14」挤在起止时间格的左上角,
 *   下面留一条空白带,右侧还把「仪器状态」整个顶歪。
 *
 * 【实测根因:控件宽度根本没被约束】
 *   Element Plus 给日期类控件写死了默认宽:
 *     .el-date-editor.el-input, .el-date-editor.el-input__wrapper { width: var(--el-date-editor-width) }
 *     .el-date-editor--daterange, .el-date-editor--timerange { --el-date-editor-width: 350px }
 *     .el-date-editor--date (默认)                                 { --el-date-editor-width: 220px }
 *   而 RecordSheetPanels 里 .rs-date-in / .rs-range-in 只写了 width:100% ——
 *   **特异性打不过它**(.rs-date-in 是单类 0,1,0;Element 是 .el-date-editor.el-input__wrapper 的 0,2,0),
 *   ⇒ 控件保持 350px/220px 原样,在 120px/110px 的格子里**向右溢出**。
 *
 *   活体实测(测试账套 RD_INSTR_USE,1810×900,草稿 + 新增行):
 *     起止时间:  td 120px, .rs-range-in 盒子 **350px**(溢出 239px)
 *     使用日期:  td 110px, .rs-date-in  盒子 **220px**(溢出 119px)
 *     其余文本格: td 90~300px, 盒子 73~283px(正常,不溢出)
 *     区间内部:  两个 .el-range-input 各 137px、分隔符 49px —— 都按 350px 摊的
 *
 * 【为什么必须用测试钉住】
 *   这类问题**从源码看不出来**:模板上明明写着 width:100%,但被 Element 的更高特异性覆盖;
 *   单测跑不了 CSS 计算,只能按仓库既有做法(docSheetWidth.test.js)读源码钉住那几条必须存在的规则,
 *   并钉住「加规则时必须提高特异性」这一条,否则改完在页面上毫无变化。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
// 本组件有两个 style 块(scoped 3661 行起 = 纸面样式;末尾还有一个全局 <style> = 打印),
// 日期/时间格的规则在 **scoped 块** 里 ⇒ 只取这一段,别把全局块当全量。
const css = vue.slice(vue.indexOf('<style scoped>'), vue.lastIndexOf('<style'))

test('日期/时间格控件的宽度必须压过 Element 的默认宽(提高特异性,不能只写单个类)', () => {
  // 关键:.rs-date-in / .rs-range-in 必须**同时**命中 Element 那两条 width 规则的同一个元素 ——
  // 也就是要写成 .el-date-editor.rs-date-in 这种双类选择器(特异性 0,2,0 ≥ Element 的 0,2,0,
  // 且后加载 ⇒ 胜出);单写 .rs-date-in(0,1,0)必然被 Element 压掉,这正是本次 bug。
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.el-date-editor\.rs-date-in\)[\s\S]{0,200}?width:\s*100%/,
    '.rs-date-in 必须写成 .rs-td :deep(.el-date-editor.rs-date-in) 并写 width:100% —— ' +
      '单类压不过 Element 的 220px;不走 :deep 则规则带上 data-v 而控件根节点没有它,永不命中',
  )
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.el-date-editor\.rs-range-in\)[\s\S]{0,200}?width:\s*100%/,
    '.rs-range-in 必须写成 .rs-td :deep(.el-date-editor.rs-range-in) 并写 width:100% —— ' +
      '单类压不过 Element 的 350px;不走 :deep 则规则带上 data-v 而控件根节点没有它,永不命中',
  )
})

test('区间控件内部两个时间输入按格子平分,不再按 350px 摊(否则值跑到格子外)', () => {
  // Element 的 .el-date-editor .el-range-input 是 width:39% + text-align:center;
  // 原来 .rs-range-in 又把它改成 38%,但外框仍是 350px ⇒ 每个 input 实宽 137px。
  // 收口后外框只有格子宽(120px),两个 input 必须是 flex:1 平分,不然仍会溢出。
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.rs-range-in \.el-range-input\)[\s\S]{0,220}?flex:\s*1/,
    '区间内的 .el-range-input 必须 flex:1 平分剩余宽度(不能留固定百分比宽)',
  )
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.rs-range-in \.el-range-input\)[\s\S]{0,220}?min-width:\s*0/,
    'flex 子项必须 min-width:0,否则输入框的固有宽度下限会把格子重新撑开',
  )
})

test('区间控件左右内边距要收窄(Element 默认 0 10px,120px 的格子装不下)', () => {
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.el-date-editor\.rs-range-in\) \{[\s\S]{0,160}?padding:\s*0\s+[0-4]px/,
    '区间控件容器内边距必须压到 ≤4px,否则两个 HH:mm 加分隔符在 120px 格子里放不下',
  )
})
test('窄格里不显示日历/时钟装饰图标(否则日期被裁成 2026-10-2)', () => {
  // 110px 的日期格扣掉 20px 图标后输入框只剩 65px,而 '2026-10-28' 实测需要 69px;
  // 120px 的起止格同理。图标只是装饰(整块控件区域都可点开面板),隐藏后日期/时间才完整。
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.rs-date-in \.el-input__prefix\)\s*\{[\s\S]{0,120}?display:\s*none/,
    '日期格必须隐藏 .el-input__prefix(日历图标),否则 110px 格子里日期末尾被裁掉',
  )
  assert.match(
    css,
    /\.rs-td\s*:deep\(\.rs-range-in \.el-range__icon\)\s*\{[\s\S]{0,120}?display:\s*none/,
    '起止格必须隐藏 .el-range__icon(时钟图标),否则两个 HH:mm 各只剩 31px 被裁',
  )
})
