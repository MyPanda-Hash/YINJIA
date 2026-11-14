/**
 * sheetPdfFillA4.test.js —— 「在导出 PDF 拉长一点，现在就缩在一半，把整个面板进行排版重新设计，
 *                            拉长一点，宽度不够填写数据自动换行，适配 A4 纸」（2026-11-13 用户口径）
 *
 * 【现象·实测】
 *   导出件里内容横向占纸宽 92%（几乎铺满），**纵向只占纸高 49%** —— 下面一半全白。
 *   用户的话是「缩在一半」，指的就是这个纵向半张纸。
 *
 * 【根因】
 *   立项申请的纸面按**固定 1242px** 排版（FIXED_SHEET_W），而 A4 竖向去掉 8mm 边距只有
 *   194mm ≈ 733px 内容宽 ⇒ 必须缩小到 0.59 才塞得下。缩小是全比例的，所以：
 *     · 宽度：1242 × 0.59 → 正好铺满 194mm（92%，看起来对）；
 *     · 高度：纸张自身只有 928px 高（行高是 min-height 写死的设计值），
 *             928 × 0.59 ≈ 145mm，而 A4 内容高有 272mm ⇒ 只占 53%。
 *   一句话：**为了塞下过宽的纸而整体缩小，高度跟着一起缩掉了**。
 *
 * 【口径】用户要的是「适配 A4 纸」+「宽度不够填写数据自动换行」：
 *   导出/打印时**不再整体缩小**，而是按 A4 内容宽（≈733px）**重新排版**一遍纸面；
 *   值区宽度不够时文字自动换行，行高随内容长高 ⇒ 纵向自然撑满 A4。
 *
 * 这些断言钉住「A4 排版宽常量存在、截图按它重排、且换行规则在」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const paper = readFileSync(new URL('../panel/sheetPrintHtml.js', import.meta.url), 'utf8')

test('① A4 内容宽有唯一常量（733px = (210-16)mm @96dpi），截图按它重排', () => {
  // 常量必须来自 sheetPrintHtml（纸张/边距/96dpi 的唯一真源），不许在两处各写一个 733
  assert.match(paper, /SHEET_PAGE_W\s*=\s*210/, 'A4 宽 210mm')
  assert.match(paper, /SHEET_MARGIN\s*=\s*8/, '页边距 8mm')
  assert.match(list, /A4_CONTENT_PX/, 'PanelxList 要按 A4 内容宽算排版宽')
  // 导出截图时，若纸面比 A4 内容宽**更宽**，要把克隆体压到 A4 宽重新排版（而不是整体缩小）
  assert.match(list, /paperW\s*>\s*A4_CONTENT_PX/, '要判断"纸比 A4 宽"这件事')
  // 实现是 `const w0 = reflow ? A4_CONTENT_PX : paperW`（可读性比 Math.min 好：
  // 一眼能看出"重排与否"这个分支，且能挂上排除表格式纸面的条件）
  assert.match(list, /reflow\s*\?\s*A4_CONTENT_PX\s*:\s*paperW/,
    '克隆体宽度要取 min(纸宽, A4 内容宽) —— 这就是"重新排版"而不是"缩小"')
  // 表格式纸面（样品申请单）列宽写死，压窄只会横向溢出 ⇒ 必须排除
  assert.match(list, /isTableStyleSheet/, '表格式纸面要排除在重排之外')
  assert.match(list, /querySelector\(\'\.sg-table\'\)/, '判据用纸面结构类名，不写死面板码')
})

test('② 重排后高度要重新量（压窄会换行⇒变高，不能沿用原高度）', () => {
  const body = list.slice(list.indexOf('async function snapSheetPage('))
  const fn = body.slice(0, body.indexOf('\nasync function shotsForPages('))
  // h0 必须在设完宽度、双 raf 之后量
  const wi = fn.indexOf('clone.style.width')
  const hi = fn.indexOf('const h0 = Math.max(')
  assert.ok(wi > 0 && hi > 0 && wi < hi, '先定宽、后量高（窄排版换行后高度才准）')
  assert.match(fn.slice(wi, hi + 120), /requestAnimationFrame/,
    '定宽与量高之间要等一次布局（双 raf），否则量到的是旧高度')
})

test('③ 值区窄了要自动换行（否则数据被截断/溢出格子）', () => {
  // 文本域：pre-wrap + break-word（已有）
  assert.match(docSheet, /white-space:\s*pre-wrap/, '文本域要保留换行')
  assert.match(docSheet, /word-break:\s*break-word|overflow-wrap:\s*anywhere/, '长串要能断行')
  // 只读文本（打印时值多是只读渲染）也要换行，不能 nowrap 截断
  const roIdx = docSheet.indexOf('.as-ro-text')
  assert.ok(roIdx > 0, '应有只读值区样式 .as-ro-text')
  const roBlock = docSheet.slice(roIdx, roIdx + 400)
  assert.doesNotMatch(roBlock, /white-space:\s*nowrap/, '只读值区不许 nowrap（窄排版会截断）')
})

test('④ 行高用 min-height（内容变多要能长高，不许把文字裁掉）', () => {
  // 模板里 as-row 用的是 minHeight，不是 height
  assert.match(docSheet, /class="as-row"[^>]*minHeight|:style="\{ minHeight:/,
    '行高必须是 min-height（内容撑得开）')
  // 值区内边距/行高给换行留出空间
  assert.match(docSheet, /\.as-fill-area\s*:deep\(\.el-textarea__inner\)\s*\{[\s\S]{0,80}line-height/,
    '文本域行高要有明确值（换行后高度可预测）')
})

test('⑤ 打印/导出不是「整体缩小」：不许靠 zoom 把宽纸压进 A4', () => {
  const body = list.slice(list.indexOf('async function snapSheetPage('))
  const fn = body.slice(0, body.indexOf('\nasync function shotsForPages('))
  // 截图克隆体上只允许清 zoom（=1），不许设成小于 1 去"凑宽度"
  assert.doesNotMatch(fn, /clone\.style\.zoom\s*=\s*['"]?0\./,
    '不许在截图时把 zoom 设成小于 1（那是整体缩小，正是用户报的"缩在一半"）')
  assert.match(fn, /clone\.style\.zoom\s*=\s*'1'|clone\.style\.zoom\s*=\s*1/,
    '截图时 zoom 必须清成 1（按重排后的像素直接出图）')
})

/**
 * 第二轮实测暴露的两个问题（填了真实数据、走真实截图路径才看得出来）：
 *
 *  ① **文字被截断**：立项背景那 175 字，在 1242px 宽时只占 3 行（框高 143px），
 *     压到 733px 后要 7 行，但克隆体里 textarea 的 `height` 还是屏幕上那个 143px
 *     ⇒ 后面 4 行直接看不见（截图实测：显示到"流量不低于每"就断了）。
 *     根因：克隆时只把 `value` 写进文本节点，**没有按新宽度重算高度**。
 *  ② **「申请立项人」被挤成一列竖排字**：签名行是 flex，压窄后标签格不收缩，
 *     值区被压到 1 个字宽 ⇒ 一个字一行。要在窄排版下保住最小可读宽度。
 */

test('⑥ 克隆体里的 textarea 要按**新宽度**重算高度（否则窄排版后文字被裁）', () => {
  const body = list.slice(list.indexOf('async function snapSheetPage('))
  const fn = body.slice(0, body.indexOf('\nasync function shotsForPages('))
  // 必须在写回 value 之后，显式把 height 撑到 scrollHeight（autosize 不会在克隆体里自己跑）
  assert.match(fn, /scrollHeight/, '要读克隆体的 scrollHeight 来定高')
  assert.match(fn, /\.style\.height\s*=/, '要把 height 写成内容高（覆盖屏幕上的旧内联高度）')
  // 顺序：先写 value（有内容才能量出高度），再定高
  const vi = fn.indexOf('c.textContent = t.value')
  const hi = fn.indexOf('.style.height =')
  assert.ok(vi > 0 && hi > vi, '先写 value 再量高（没内容量出来是空的）')
})

test('⑦ 压窄后签名/标签格不许被挤成一字一行', () => {
  const ds = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  // 标签格（.as-no/.as-name/签名标签）与值区都要有最小宽度或允许换行，不能无限被压
  assert.match(ds, /\.as-name\s*\{[^}]*min-width|\.as-name\s*\{[^}]*flex-shrink:\s*0/,
    '标签格要有最小宽度/不收缩（否则压窄后被挤成竖排字）')
})

/**
 * 2026-11-13 用户口径（填数据测试后追加）：
 *   「申请立项时间可以往右边挪，因为备注不会写那么多」
 *
 * 现象：底部签名行「申请立项人 | 系统管理员 | 申请立项日期 | 2026-11-13」被挤在左侧约 3/4，
 *   右边空着是备注列（固定 250px，`flex:none`）—— 而备注在实际单据上基本不写字。
 * 口径：**备注列不需要那么宽**，把省下来的宽度让给签名行/表格正文。
 */
test('⑧ 备注列不该固定占 250px（用户口径：备注不会写那么多）', () => {
  const ds = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  const i = ds.indexOf('.as-remark {')
  assert.ok(i > 0, '应有 .as-remark 样式')
  // 只取**规则体**（第一个 } 之前）：注释里也提到 width/flex，混进来会误判
  const block = ds.slice(i, ds.indexOf('}', i) + 1)
  // 允许保留一个上限（备注仍要能写字），但不许再是 `width:250px; flex:none` 的硬固定
  assert.doesNotMatch(block, /width:\s*250px;\s*\n\s*flex:\s*none/,
    '备注列不许再是 250px + flex:none（那样签名行永远拿不到右边那 250px）')
  assert.match(block, /max-width|width:\s*\d{2,3}px/, '备注列要有一个合理上限')
  // 必须可收缩，让正文/签名行优先拿到宽度
  assert.match(block, /flex:\s*0\s+1\s+auto|flex-shrink:\s*1|min-width/,
    '备注列要允许收缩（正文优先）')
})

test('⑨ 签名行要能铺满整张纸（不被备注列截在 3/4 处）', () => {
  const ds = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  // 签名行在同一 flex 容器内、宽 100%
  const i = ds.indexOf('.as-sign-row {')
  assert.ok(i > 0, '应有 .as-sign-row')
  const block = ds.slice(i, i + 260)
  assert.match(block, /display:\s*flex/, '签名行仍是 flex')
  // 不能写死百分比宽度（会随备注列变化而错位）
  assert.doesNotMatch(block, /width:\s*\d+%/, '签名行不许写死百分比宽')
})

/**
 * 2026-11-13 第三轮：「调整为单行显示」。
 *
 * 实测数据（733px 纸宽）：备注列 190px 时表格只有 541px，签名项各约 287/254，
 * 「申请立项人」的值区只剩 85px < 文字宽 70px + padding 20px ⇒ 折成两行。
 * 收到 150px 后值区 106px（内容 86px ≥ 文字 70px）⇒ 单行。
 */
test('⑩ 备注列足够窄，签名行的值区能放下一行名字', () => {
  const ds = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  const i = ds.indexOf('.as-remark {')
  const block = ds.slice(i, ds.indexOf('}', i) + 1)
  // 注释里也写「width:250px」「190 → 150」之类，先把注释剥掉再取值
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, '')
  const m = clean.match(/width:\s*(\d+)px/)
  assert.ok(m, '备注列要有基准 width')
  const w = Number(m[1])
  // 733 纸宽下：备注 w ⇒ 表格 (733-w)，签名首项约 53% ⇒ 值区 ≈ (733-w)*0.53 - 标签宽
  // 标签 202px 时值区要 ≥ 90px（文字 70 + padding 20）才单行 ⇒ w ≤ 733 - (90+202)/0.53 ≈ 182
  assert.ok(w <= 182, `备注列 ${w}px 太宽：733px 纸宽下签名值区放不下一行名字（应 ≤182px）`)
})

test('⑪ 签名标签格能收缩（不许 flex:none 把值区挤到换行）', () => {
  const ds = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  const i = ds.indexOf('.as-sign-cell {')
  const block = ds.slice(i, ds.indexOf('}', i) + 1).replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(block, /flex:\s*none/, '标签格不许 flex:none（那样压窄时值区必换行）')
  assert.match(block, /flex-shrink:\s*[2-9]/, '标签格收缩系数要大于值区，优先让标签让宽')
  assert.match(block, /min-width:\s*\d+px/, '标签格要有最小宽度兜底')
})

/* ── 截图宽度必须用实测内容宽（2026-11-13 用户报障「这些 PDF 都有缺失」）────── */
test('截图宽度不能用写死的 w0，必须用实测 scrollWidth 兜底', () => {
  // 根因（生产实测）：规格书 794→733 溢出 61px、产品信息表 781→733 溢出 48px，
  // 纸的列宽是写死 px，压窄容器它们不跟着缩；而 domToPng({width: w0}) 按 w0 裁图
  // ⇒ 溢出部分被直接切掉，导出件右缘就"缺一块"。
  const vue = list   // 文件顶部已读入 PanelxList.vue 源码
  assert.match(vue, /const realW = Math\.max\(/, '缺 realW（实测内容宽）')
  const at = vue.indexOf('const realW = Math.max(')
  const seg = vue.slice(at, at + 320)
  assert.match(seg, /clone\.scrollWidth/, 'realW 必须含 scrollWidth —— 溢出量就藏在这里')
  assert.match(seg, /\bw0\b/, 'realW 要与 w0 取 max（不缩窄原本就正常的页面）')
  // domToPng 与返回值都必须用 realW，不能回退到 w0
  assert.match(vue, /width: realW,/, 'domToPng 必须按 realW 裁图')
  assert.match(vue, /return \{ dataUrl, w0: realW, h0, rowBreaks \}/, '返回的 w0 必须是 realW')
})

test('克隆体必须清掉屏幕适配的 zoom（否则内容只占截图宽的一部分）', () => {
  // a9c1a2876 修过：DocSheet 的窄窗自适应会写内联 zoom，cloneNode 一并带走
  // ⇒ 截图宽按未缩放的纸宽定、内容却按 zoom 排版，右边成了空白。
  assert.match(list, /clone\.style\.zoom = '1'/, '克隆体必须把 zoom 归 1')
})
