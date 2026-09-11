/**
 * _fix-panels-layout.cjs —— 把「成型工艺清单+成型配方」「组装工艺清单+组装BOM表」两对面板
 * 从「统一 11 列网格 + 页 2 跨列重排」恢复成**各自的原始版式**,只是放进同一张单的两个页签。
 *
 * 依据:e20bd9a~1(728281e)的 recordSheetConfigs.js —— 合并提交之前的原文。
 *
 * 做法(不复制粘贴配置文本,避免两份真源漂移):
 *   ① 合并前的 RD_MOLD_PROC / RD_ASM_PROC 原文**逐字还原**(grid / head / sections / dataTables);
 *   ② 原被并入的 RD_MOLD_FORMULA / RD_ASM_BOM 从记录表对象里**提成模块级常量**
 *      (对象字面量里写 `RD_MOLD_FORMULA.sections` 是取不到的 —— 同级属性名不在作用域内):
 *        面板名保留(名字即「这是哪张单据的原始配置」),只摘掉面板级容器键 headMode(版式改由
 *        主面板按页声明),内容 / grid / head / 列定义 / 行定义**一字不动**;
 *        并给面板直属的区块补 page: 1 —— 于是同一份配置文本既是页 2 的渲染来源,又是天然的回滚参考,
 *        不存在「两处真源」;
 *   ③ 主面板的 sections / dataTables / tailSections 按页聚合:
 *        页 0 = 主面板自身原文;页 1 = 被并入面板常量的 sections / dataTables / tailSections
 *      (页 2 的字段仍落在主面板自己的表里 —— 见 e20bd9a 的存储方案,数据落点一字未动);
 *   ④ 主面板 pages[i] 各声明自己的原始 grid(页 2 另声明原始 head 跨度);
 *      组装页 2 另声明 headMode:'report' —— 引擎已支持「每页 grid / 每页版式」。
 *
 * 用法:node tools/_fix-panels-layout.cjs          写入
 *      node tools/_fix-panels-layout.cjs --check  只体检不写
 *      node tools/_fix-panels-layout.cjs --dump   打印生成块(不写)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TARGET = path.join(ROOT, 'frontend/src/core/views/recordSheetConfigs.js')
const ORIG_FILE = path.join(ROOT, 'tools/_orig-configs-premerge.js')

// 目标文件与原始配置都统一成 LF 处理(库内文件是 LF,git 检出的原始文件是 CRLF)
const cur = fs.readFileSync(TARGET, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const pre = fs.readFileSync(ORIG_FILE, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const IND = '    ' // 面板块内一级键缩进(4 空格)

/** 取出 `\n  KEY: {` 起、花括号配平的那段(含起止花括号,不含前后换行) */
function block(src, key) {
  const i = src.indexOf('\n  ' + key + ': {')
  if (i < 0) throw new Error('未找到配置块:' + key)
  const st = src.indexOf('{', i)
  let d = 0
  let j = st
  for (; j < src.length; j++) {
    const c = src[j]
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) { j++; break } }
  }
  return { text: src.slice(st, j), start: st, end: j }
}

/** 同上,但连同 `\n  KEY:` 键名一起纳入(用于把对象成员改成模块级 const) */
function blockWithKey(src, key) {
  const b = block(src, key)
  const keyAt = src.lastIndexOf('\n  ' + key + ':', b.start)
  if (keyAt < 0) throw new Error('未找到键名:' + key)
  return { text: src.slice(keyAt, b.end).trimStart(), start: keyAt, end: b.end }
}

/** 配置块内 `\n<indent>KEY:` 键头的起始位置 */
function keyStart(text, key, indent) {
  const i = text.indexOf('\n' + indent + key + ':')
  if (i < 0) throw new Error('块内未找到键 ' + key)
  return i + 1
}

/** 键值的结束位置(返回「值的最后一个字符之后」的下标)。
 *  - 值是对象/数组:括号配平,闭合到 depth 0 的那一刻即为值结束(**不继续吞后面的逗号**);
 *  - 值是单行标量:到 depth 0 的换行或逗号为止。
 *  调用方各自负责是否吃掉紧随其后的逗号。 */
function valueEnd(text, from) {
  let j = from
  let depth = 0
  let sawBracket = false
  const Q = ['"', "'", '`']
  for (; j < text.length; j++) {
    const c = text[j]
    if (Q.includes(c)) { j++; while (j < text.length && text[j] !== c) j++; continue }
    if (c === '{' || c === '[') { depth++; sawBracket = true; continue }
    if (c === '}' || c === ']') {
      if (depth === 0) break // 块自身的闭合符,值不可能再延伸
      depth--
      if (depth === 0 && sawBracket) { j++; break } // 值的闭合括号:值到此为止
      continue
    }
    if (depth === 0 && (c === '\n' || c === ',')) break
  }
  return j
}

/** 把键的值整体替换掉(支持多行数组/对象值),保留行尾逗号风格 */
function setKey(text, key, indent, value) {
  const start = keyStart(text, key, indent)
  const colon = text.indexOf(':', start)
  const vFrom = colon + 1 + (text.slice(colon + 1).match(/^\s*/) || [''])[0].length
  const vTo = valueEnd(text, vFrom)
  const comma = text.slice(vTo).match(/^\s*,/) ? ',' : ''
  return text.slice(0, vFrom) + value + comma + text.slice(vTo + comma.length)
}

/** 删掉整条键(含其多行值);连同键前的换行一起删,避免留空行 */
function dropKey(text, key, indent) {
  const start = keyStart(text, key, indent)
  const vFrom = text.indexOf(':', start) + 1
  let end = valueEnd(text, vFrom)
  const comma = text.slice(end).match(/^\s*,/)
  if (comma) end += comma[0].length
  return text.slice(0, start - 1) + text.slice(end)
}

/** 在块内指定键所在行之后插入若干行 */
function insertAfter(text, key, indent, payload) {
  const start = keyStart(text, key, indent)
  const end = valueEnd(text, text.indexOf(':', start) + 1)
  const comma = text.slice(end).match(/^\s*,/)
  const at = end + (comma ? comma[0].length : 0)
  return text.slice(0, at) + '\n' + payload + text.slice(at)
}

/** 在块内指定键所在行之前插入若干行 */
function insertBefore(text, key, indent, payload) {
  const start = keyStart(text, key, indent)
  return text.slice(0, start) + payload + '\n' + text.slice(start)
}

/** 在块末尾(闭合花括号之前)追加若干行 */
function appendBeforeClose(text, payload) {
  const m = text.match(/\n[ \t]*\}$/)
  if (!m) throw new Error('未找到块结束位置')
  const i = text.length - m[0].length
  return text.slice(0, i) + '\n' + payload + text.slice(i)
}

/** 给「面板直属的区块」补 page: N。
 *  区块头 = 以「`{ ` 后直接跟键名」开头、且**行尾是 `,` 或 `[`** 的行(区块是对象,后面接逗号;
 *  或紧接 `rows: [` / `cols: [` 这类数组)。据此自动取缩进:**同一面板内所有区块缩进一致**
 *  (都是 sections / dataTables 数组的第一层元素),用首个命中的缩进当基准即可,
 *  比写死 4/6 空格稳(被并入面板的 sections/dataTables 与主面板同款,逐字保留)。
 *  info / cols / rows / pairs 这些「属值数组」的元素行尾也是 `,` 或 `[`,但缩进更深,不会被命中。 */
function withPage(text, page) {
  const lines = text.split('\n')
  const headRe = /^(\s*)\{\s+(?!page\s*:)(\S.*?)(,|\[)\s*$/
  let indent = null
  for (const ln of lines) {
    const m = ln.match(headRe)
    if (m && (indent === null || m[1].length < indent.length)) indent = m[1]
  }
  if (indent === null) return text
  return lines
    .map((ln) => {
      const m = ln.match(headRe)
      if (!m || m[1] !== indent) return ln
      return ln.replace(/^(\s*)\{\s+/, `$1{ page: ${page}, `)
    })
    .join('\n')
}

/** 取出块内 `KEY: [` 起、方括号配平的那段数组原文(含外括号) */
function extractArray(text, key, indent) {
  const i = text.indexOf('\n' + indent + key + ': [')
  if (i < 0) throw new Error('未找到数组键 ' + key)
  const st = text.indexOf('[', i)
  let d = 0
  let j = st
  for (; j < text.length; j++) {
    const c = text[j]
    if (c === '[') d++
    else if (c === ']') { d--; if (d === 0) { j++; break } }
  }
  return text.slice(st, j)
}

/** 对象成员 → 模块级常量:把开头的 `KEY: ` 换成 `const KEY = ` */
function toConst(text, key) {
  if (text.indexOf(key + ':') !== 0) {
    throw new Error('块文本不以键名开头:' + key + ' 实际:' + JSON.stringify(text.slice(0, 40)))
  }
  return 'const ' + key + ' =' + text.slice(key.length + 1)
}

/** 每页自己的原始网格(逐字取自 e20bd9a~1) */
const MOLD_GRID_P1 = '[130, 110, 70, 100, 70, 70, 70, 100, 70, 125, 125]'
const MOLD_GRID_P2 = '[101, 60, 109, 85, 52, 52, 52, 146, 64, 64, 121, 77, 57]'
const ASM_GRID_P2 = '[130, 390, 130, 390]'

/** 组装工艺清单(页 1)的原始数据表:原文写死在 dataTables 里,合并后 RD_ASM_PROC.dataTables
 *  要同时装「页 1 工序清单」与「页 2 物料清单/修订记录」⇒ 页 1 那张**逐字**提成模块常量。 */
const ASM_DT0_CONST =
  '/** 组装工艺清单(页 1)的原始数据表:21 道工序预置;逐字取自 e20bd9a~1,提成常量以便与页 2 的两张表并存 */\n' +
  'const RD_ASM_PROC_DT0 = ' +
  extractArray(block(pre, 'RD_ASM_PROC').text, 'dataTables', IND) +
  '\n'

/** 成型工艺清单(页 1)的原始区块:同上,提成常量以便与页 2 的配方区块并存 */
const MOLD_SEC0_CONST =
  '/** 成型工艺清单(页 1)的原始区块:产品基本信息 / 工序 / 检验要求;逐字取自 e20bd9a~1 */\n' +
  'const RD_MOLD_PROC_SEC0 = ' +
  extractArray(block(pre, 'RD_MOLD_PROC').text, 'sections', IND) +
  '\n'

// ─────────────────────────────────────────────────────────────
// ① 被并入面板 → 模块级常量(名字即「这是哪张单据的原始配置」;内容一字不动)
// ─────────────────────────────────────────────────────────────
let moldF = toConst(blockWithKey(pre, 'RD_MOLD_FORMULA').text, 'RD_MOLD_FORMULA')
moldF = dropKey(moldF, 'headMode', IND) // 版式由主面板按页声明(页 2 用面板的 report)
moldF = withPage(moldF, 1)
// 配方表原本独占 rd_mold_formula_detail 表,配置里不需要「表区」;并入后它与主面板共用
// rd_mold_proc_detail,必须用「表区」分块并回读 —— 否则:新增配方行保存时 表区 为空(NULL),
// 下次打开按 表区='配方表' 过滤就一行都读不回来(看起来像"配方行没存进去")。
// 这是**功能元数据**(分块键),不是版式:cols / rows / span 一律不动,只给数据表挂 filterKey/filterVal。
// 与组装侧「二、炭棒滤芯组装/包装物料清单」(filterKey:表区 / filterVal:物料清单)完全同款。
{
  const before = moldF
  moldF = moldF.replace(
    "{ page: 1, bar: '配方表', autoSeqBar: true, totalCols: true,",
    "{ page: 1, bar: '配方表', autoSeqBar: true, totalCols: true, filterKey: '表区', filterVal: '配方表',"
  )
  if (moldF === before) throw new Error('未能在 RD_MOLD_FORMULA 的配方表上挂 filterKey(文本已变,请同步生成脚本)')
}
moldF = moldF + '\n'

let asmB = toConst(blockWithKey(pre, 'RD_ASM_BOM').text, 'RD_ASM_BOM')
asmB = dropKey(asmB, 'headMode', IND)
asmB = withPage(asmB, 1) + '\n'

// ─────────────────────────────────────────────────────────────
// ② 主面板:还原原文 + 挂 pages + 按页聚合引用
// ─────────────────────────────────────────────────────────────

// ── RD_MOLD_PROC(页 1 = 自身原文区块;页 2 = RD_MOLD_FORMULA 常量的区块/数据表/表尾)──
// sections 要把「页 1 的工艺区块(自身原文)」与「页 2 的配方区块(常量)」并起来:
// 页 1 原文提到模块常量 RD_MOLD_PROC_SEC0 里(逐字), 再 spread 回来,避免这里粘一大段。
let mold = block(pre, 'RD_MOLD_PROC').text
const MOLD_SEC0 = extractArray(mold, 'sections', IND)
mold = setKey(mold, 'sections', IND, '[...RD_MOLD_PROC_SEC0, ...RD_MOLD_FORMULA.sections]')
mold = setKey(mold, 'dataTables', IND, '[...RD_MOLD_FORMULA.dataTables]')
// 原文没有 tailSections(RD_MOLD_PROC 的 dataTables 是空数组、结构到此为止):
// 页 2「配料要求」要渲染在页 2 数据表之后 ⇒ 追加 tailSections 键
mold = appendBeforeClose(mold, IND + 'tailSections: [...RD_MOLD_FORMULA.tailSections],')
mold = insertAfter(
  mold,
  'head',
  IND,
  [
    IND + '// ── 页签:两页**各用各的原始版式**(合并时曾统一成 11 列并把页 2 跨列重排,已恢复原设计)──',
    IND + '// head:true —— 两页原本都是**独立一张单据**(工艺管控清单 / 配方管控清单),各自有自己的报告头;',
    IND + '// 并入同一张单后仍照原样各渲染各的报告头(报告头只在声明 head:true 的页出现)。',
    IND + 'pages: [',
    IND + `  { title: '成型工艺清单', grid: ${MOLD_GRID_P1}, showHead: true },`,
    IND + '  // 页 2 原始 13 列网格;报告头三段跨度合计 = 13,右缘与 产品基本信息/配方表/配料要求 平齐',
    IND + `  { title: '成型配方', grid: ${MOLD_GRID_P2}, head: { title: 7, infoLabel: 2, infoValue: 4 }, showHead: true, staticTitle: '炭棒配方管控清单' },`,
    IND + '],',
  ].join('\n')
)

// ── RD_ASM_PROC(页 0 原文逐字;页 1 = RD_ASM_BOM 常量的区块/数据表)──
let asm = block(pre, 'RD_ASM_PROC').text
if (process.argv.includes('--trace')) {
  console.log('[trace] asm 原文长度', asm.length, 'seedRows?', asm.includes('seedRows'),
    'head:', JSON.stringify(asm.slice(0, 90)))
}
// 原文没有 sections(plain 清单只有一张数据表):页 2 组装BOM表的「一、产品基本信息」要
// 渲染在页 2 顶部 ⇒ 补 sections 键引用它(区块自带 page: 1)
asm = insertBefore(asm, 'dataTables', IND, IND + 'sections: [...RD_ASM_BOM.sections],')
if (process.argv.includes('--trace')) console.log('[trace] after insertBefore', asm.length, 'seedRows?', asm.includes('seedRows'))
asm = setKey(asm, 'dataTables', IND, '[...RD_ASM_PROC_DT0, ...RD_ASM_BOM.dataTables]')
if (process.argv.includes('--trace')) console.log('[trace] after setKey', asm.length, 'seedRows?', asm.includes('seedRows'))
asm = insertAfter(
  asm,
  'plainTitle',
  IND,
  [
    IND + '// ── 页签:页 1 = plain 清单原版式;页 2 = 组装BOM表原版式(report 报告头 + 4 列网格)──',
    IND + "// 页 1 不声明 headMode/head ⇒ 用面板缺省 plain(标题条 + 本表自持列宽 130/320/430/120),无报告头;",
    IND + "// 页 2 声明 headMode:'report' 且 showHead:true ⇒ 原样渲染自己的报告头 + 4 列网格 + pairs 区块 + 两张原表。",
    IND + 'pages: [',
    IND + "  { title: '组装工艺清单' },",
    IND + `  { title: '组装BOM表', headMode: 'report', grid: ${ASM_GRID_P2}, showHead: true, staticTitle: '组装BOM表' },`,
    IND + '],',
  ].join('\n')
)

/** 把替换范围向前扩到该面板的**前导注释块**开头(成对的 `// 面板名/说明` 注释行) */
function expandStartToComments(src, start) {
  let s = start
  for (;;) {
    // 上一行若是注释行(行首缩进 + //),一起纳入替换(否则新文本会粘在残注释后面)
    const nl = src.lastIndexOf('\n', s - 1)
    if (nl < 0) break
    const prevStart = src.lastIndexOf('\n', nl - 1) + 1
    const prev = src.slice(prevStart, nl)
    if (/^\s*\/\//.test(prev)) { s = prevStart; continue }
    break
  }
  return s
}

/** 把替换范围向后扩过块结束后的逗号与换行(避免留下孤立的 `,` 或空行) */
function expandEndPastNewline(src, end) {
  let e = end
  let seenComma = false
  while (e < src.length) {
    const c = src[e]
    if (!seenComma && c === ',') { seenComma = true; e++; continue }
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') { e++; continue }
    break
  }
  return e
}

/** 面板名列表 + 前导注释一起删掉(连同其后换行,避免留空行) */
function removeWithComments(src, key) {
  const b = blockWithKey(src, key)
  const start = expandStartToComments(src, b.start)
  return src.slice(0, start) + src.slice(expandEndPastNewline(src, b.end))
}

/** 主面板:只换块体,保留 `RD_XXX: {` 键名与前导注释 */
function replacePanelBody(src, key, newText) {
  const b = block(src, key)
  return src.slice(0, b.start) + newText + src.slice(b.end)
}

/** 在记录表对象之前插入模块级常量(用注释块把它们与导出对象分开) */
function insertConstsBeforeExport(src, consts) {
  const anchor = src.indexOf(EXPORT_ANCHOR)
  if (anchor < 0) throw new Error('未找到 ' + EXPORT_ANCHOR)
  return src.slice(0, anchor) + consts + src.slice(anchor)
}

/** 把 `const KEY = {...}` 里的 `\n  }` 结尾换成 `\n}\n`(模块级常量用顶格收尾) */
function topLevelClose(constText) {
  return constText.replace(/\n\s*\}$/, '\n}\n')
}

// ─────────────────────────────────────────────────────────────
// ③ 落地替换(被并入面板移出导出对象;主面板就地还原)
// ─────────────────────────────────────────────────────────────
const EXPORT_ANCHOR = 'export const recordSheetConfigs = {'

let out = cur
// 主面板:就地换块体(保留键名与前导注释)
out = replacePanelBody(out, 'RD_MOLD_PROC', mold)
out = replacePanelBody(out, 'RD_ASM_PROC', asm)
// 被并入面板:从导出对象里摘掉
out = removeWithComments(out, 'RD_ASM_BOM')
out = removeWithComments(out, 'RD_MOLD_FORMULA')
// 文件头结构说明:补 pages[i].grid / headMode / showHead 的写法
out = out.replace(
  ' *   grid —— 整页共用列网格(Excel 原表各列宽度 px):报告头/条件区/数据表全部用这套列宽,竖线全页对齐\n',
  ' *   grid —— 整页共用列网格(Excel 原表各列宽度 px):报告头/条件区/数据表全部用这套列宽,竖线全页对齐\n' +
    ' *   pages —— 多页签面板(pages 缺省 = 单页面板)。每页可**各自**声明:\n' +
    ' *              pages[i].grid     本页专用列网格(不写则用面板 grid;两页版式不同时必须各写一套,\n' +
    ' *                                否则其中一页会被另一页的网格挤变形 —— 成型/组装两对面板即如此)\n' +
    " *              pages[i].headMode 本页专用版式 'report'|'plain'(不写则用面板 headMode;\n" +
    ' *                                如 组装工艺清单页 plain / 组装BOM表页 report)\n' +
    ' *              pages[i].head     本页专用报告头跨度(网格列数不同的页要各自给 title/infoLabel/infoValue)\n' +
    ' *              pages[i].showHead true=本页也渲染报告头(被并入同一张单、但原本是独立单据的那页);\n' +
    ' *                                缺省=沿用历史行为「只有第 1 页有报告头」\n' +
    ' *              pages[i].staticTitle 本页报告头大标题(两页本是两张单据,各有各的标题,不能共用面板 staticTitle)\n' +
    ' *            区块用对象上的 page:i 归属到第 i 个页签(缺省 0)\n'
)
// 再作为模块级常量插到导出对象之前
const header =
  "// ═══════════ 被并入面板的原始配置(2026-09-11 并入工艺清单面板第 2 页签,菜单已下线)═══════════\n" +
  '// 这两份是**页 2 的唯一真源**:主面板按页引用它们的 sections/dataTables/tailSections,\n' +
  '// 区块上的 page:1 标明归属第 2 页签;面板级 headMode 挪到主面板 pages[1] 声明(页 2 版式)。\n' +
  '// 与合并前(e20bd9a~1)的原文逐字一致,可直接作为回滚参考。\n\n'
out = insertConstsBeforeExport(out, header + ASM_DT0_CONST + '\n' + MOLD_SEC0_CONST + '\n' + topLevelClose(moldF) + '\n' + topLevelClose(asmB) + '\n')

if (process.argv.includes('--dump')) {
  for (const [k, t] of [['RD_MOLD_PROC', mold], ['RD_ASM_PROC', asm], ['RD_MOLD_FORMULA', moldF], ['RD_ASM_BOM', asmB]]) {
    console.log('══════ ' + k + ' ══════')
    console.log(t.length > 1500 ? t.slice(0, 1500) + '\n…(截断)' : t)
  }
  process.exit(0)
}

const sizes = [['RD_MOLD_PROC', mold], ['RD_ASM_PROC', asm], ['RD_MOLD_FORMULA', moldF], ['RD_ASM_BOM', asmB]]
  .map(([k, t]) => k + '=' + t.length)
  .join(', ')
if (process.argv.includes('--check')) {
  console.log('[check] 未写入。长度:', sizes)
} else {
  fs.writeFileSync(TARGET, out, 'utf8')
  console.log('[write]', path.relative(ROOT, TARGET))
  console.log('        ', sizes)
}
