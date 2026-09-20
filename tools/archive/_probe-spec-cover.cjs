/**
 * _probe-spec-cover.cjs — 规格书封面按设计重排的自检
 *
 * 三层各查一遍(缺一层就会出现"代码改了但用户看到的没变"):
 *   ① 活库字段层 : 封面 9 行对应的 yj_field 是否都在、类型/参照是否正确、列是否建了
 *   ② 配置/几何层: cover 字段顺序是否 = 设计 B7..B15;标签列宽是否装得下最长标签
 *   ③ 服务端产物 : 8090 供应的分包里是否有新封面结构(经后端 API 取配置,证明两端一致)
 *
 * 为什么查几何而不只查"字段在不在":设计 xlsx 的 B 列 = 71px 装不下它自己的
 * 「客户项目名称」(6 字 @27.3px 需 163.8px) —— 照抄设计磅值必截字。
 * 所以"宽度够不够"是这张封面最容易错、又最不容易被肉眼发现的地方,必须自动断言。
 *
 * 用法:node tools/archive/_probe-spec-cover.cjs
 * 缺前置输入(库/服务不可达)时报 SKIP(exit 2),与断言失败(exit 1)区分开。
 */
'use strict'
const { execFileSync } = require('node:child_process')
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

let pass = 0, fail = 0, skip = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }
const skipAll = (m) => { console.log(`  ⊘ SKIP ${m}`); process.exit(2) }

/** 设计画布与几何(必须与 RecordSheetPanels.vue 的常量一致)
 *  ⚠ 列宽**已不再手算**:改为浏览器按内容测量(auto + nowrap),
 *    故这里不再有 labelFont/gridLeft/宽度的断言 —— 保留画布与竖向几何。 */
const DESIGN = {
  canvasW: 767, canvasH: 794,
  gridTop: 106, rowH: 46,
  signTop: 605, signRowH: 33,
  tailReserve: 220,
}
const A4_RATIO = 297 / 210

function sql(query) {
  return execFileSync('sqlcmd', [
    '-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
    '-W', '-s', '\t', '-h', '-1', '-Q', `SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ${query}`,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
}

;(async () => {
  // ═══ ① 活库字段层 ═══
  console.log('\n① 字段层(活库 yj_field + rd_spec_doc_head)')
  // 封面 9 行 + 第 4 页各节字段,必须全部是活库里的 label(铁律)
  // ⚠ 早先这里只查了封面 9 个字段,导致 liveLabels 缺第 4 页的字段,
  //    第 4 页断言集体误报 —— 数据键校验必须覆盖**本探针会断言的全部字段**。
  let rows
  try {
    rows = sql(`SELECT label, col_name, data_type, ISNULL(ref_panel,''), ISNULL(ref_field,''), CAST(seq AS varchar)
                FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND place='header' ORDER BY seq`)
  } catch (e) { skipAll('连不上 HSDZ_MES: ' + e.message.split('\n')[0]) }

  const byLabel = new Map()
  for (const line of rows.split(/\r?\n/)) {
    if (!line.trim()) continue
    const p = line.split('\t').map((s) => s.trim())
    if (p.length >= 6) byLabel.set(p[0], { col: p[1], type: p[2], refPanel: p[3], refField: p[4], seq: p[5] })
  }
  /** 设计封面 9 行(显示标签 → 期望落库字段) */
  const COVER_ROWS = [
    ['编  号', '编号', '参照'],
    ['产品类别', '产品类别', '参照'],
    ['客户名称', '客户名称', '文本'],
    ['客户料号', '客户料号', '文本'],
    ['客户项目名称', '客户项目名称', '参照'],
    ['应用场景', '应用场景', '文本'],
    ['整体规格参数', '整体规格参数', '文本'],
    ['产品主要性能', '产品主要性能', '文本'],
    ['版  本', '版本', '文本'],
  ]
  // 显示标签去掉设计的两端对齐空格后即数据键(label)
  for (const [disp, key, wantType] of COVER_ROWS) {
    const f = byLabel.get(key)
    check(`封面「${disp}」→ 字段 ${key} 存在(seq=${f ? f.seq : '?'})`, !!f, '库里没有该 header 字段')
    if (f) check(`  ${key} 类型 = ${wantType}`, f.type === wantType, `实际 ${f.type}`)
  }

  // 产品类别必须是参照 RD_PROD_INFO.产品类别(用户选定口径)
  const cat = byLabel.get('产品类别')
  check('产品类别 参照 RD_PROD_INFO.产品类别',
    !!cat && cat.refPanel === 'RD_PROD_INFO' && cat.refField === '产品类别',
    cat ? `${cat.refPanel}.${cat.refField}` : '缺字段')

  // 列是否建了(参照要有落库列)
  const colCnt = sql(`SELECT CAST(COUNT(*) AS varchar) FROM sys.columns
                      WHERE object_id=OBJECT_ID('rd_spec_doc_head') AND name IN
                      (N'产品类别',N'制订日期',N'审核日期',N'批准日期')`).trim()
  check('rd_spec_doc_head 有 产品类别 + 三签字列(共 4)', colCnt === '4', `实际 ${colCnt}`)

  // 译名覆盖:活跃目标语言 = 9 个(en/ja/ko/es/fr/de/ru/vi/th)
  const trRows = sql(`SELECT ref_key, CAST(COUNT(*) AS varchar) FROM yj_translation
                      WHERE scope='field' AND ref_key IN
                      (N'编号',N'产品类别',N'客户名称',N'客户料号',N'客户项目名称',N'应用场景',
                       N'整体规格参数',N'产品主要性能',N'版本',N'制订/日期',N'审核/日期',N'批准/日期')
                      GROUP BY ref_key`)
  const trMap = new Map()
  for (const line of trRows.split(/\r?\n/)) {
    if (!line.trim()) continue
    const p = line.split('\t').map((s) => s.trim())
    if (p.length >= 2) trMap.set(p[0], Number(p[1]))
  }
  const TARGET_LOCALES = 9
  const shortTr = [...trMap.entries()].filter(([, n]) => n < TARGET_LOCALES)
  check(`封面 12 个标签译名均 ≥ ${TARGET_LOCALES} 语言`, shortTr.length === 0 && trMap.size === 12,
    shortTr.length ? shortTr.map(([k, n]) => `${k}=${n}`).join(', ') : `只查到 ${trMap.size} 个键`)

  // ═══ ② 配置/几何层 ═══
  console.log('\n② 配置与几何层')
  const cfgMod = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/views/recordSheetConfigs.js')
  const cfg = cfgMod.recordSheetConfigs.RD_SPEC_DOC
  check('RD_SPEC_DOC 有 cover 配置', !!cfg?.cover)

  const keys = (cfg.cover.fields || []).map((f) => f.key)
  const wantKeys = ['编号', '产品类别', '客户名称', '客户料号', '客户项目名称', '应用场景', '整体规格参数', '产品主要性能', '版本']
  check('封面 9 行顺序 = 设计 B7..B15', JSON.stringify(keys) === JSON.stringify(wantKeys),
    `实际 ${JSON.stringify(keys)}`)

  // 数据键必须是当前 label(铁律)→ 用 ① 的活库 label 集合反查
  const liveLabels = new Set([...byLabel.keys()])
  const badKeys = keys.filter((k) => !liveLabels.has(k))
  check('封面每个 key 都命中活库 label(否则整格空白+保存丢值)', badKeys.length === 0, badKeys.join(', '))

  check('签字栏 3 栏 = 制订/审核/批准日期',
    JSON.stringify((cfg.cover.sign || []).map((s) => s.key)) === JSON.stringify(['制订日期', '审核日期', '批准日期']))

  // 几何:封面"不重叠"现在**由浏览器测量保证**(不写固定列宽),
  // 故这里不再断言像素宽度(那正是旧版重叠的根源),改为断言"有没有退回手算/固定列宽"。
  const dispLabels = (cfg.cover.fields || []).map((f) => f.label)
  const longest = dispLabels.reduce((a, b) => (a.length >= b.length ? a : b), '')
  console.log(`  (最长标签「${longest}」${longest.length} 字;列宽交由浏览器测量,不再手算)`)

  const vueSrc = require('node:fs').readFileSync(
    'C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue', 'utf8')
  // ① 不得再出现固定列宽(colgroup 里写死 px 的列):退回即会重现"字比列宽"的重叠
  const coverTableBlock = (vueSrc.match(/<table class="rsp-cover-fields">[\s\S]*?<\/table>/) || [''])[0]
  check('字段表不再写死列宽(无 colgroup/固定宽度)',
    coverTableBlock.length > 0 && !/colgroup/.test(coverTableBlock),
    '字段表里又出现了 colgroup ⇒ 手算列宽会重现重叠')
  check('标签列声明了 nowrap(否则标签折行破坏 9 行等高)',
    /\.rsp-cover-lb[\s\S]{0,300}?white-space:\s*nowrap/.test(vueSrc))
  check('值列声明了 nowrap(让浏览器按内容撑宽,而非折行)',
    /\.rsp-cover-vl[\s\S]{0,300}?white-space:\s*nowrap/.test(vueSrc))
  // ② 关键回归:居中容器**不得**用 width:max-content —— 它内含 width:100% 的签字表,
  //    构成循环依赖,实测会把整块布局塌成空(边框在、文字全部不渲染)。
  //    ⚠ 取 CSS 规则时用 [^}<]* 限定在单条规则内:早先用 [\s\S]*? 会**越过 CSS 抓进模板**,
  //      导致断言读到的是别处的内容(假绿/假红)。
  const blockCss = (vueSrc.match(/\.rsp-cover-block(?![a-z-])[^}<]*\}/) || [''])[0]
  const blockinCss = (vueSrc.match(/\.rsp-cover-blockin[^}<]*\}/) || [''])[0]
  check('居中容器 .rsp-cover-block 未用 width:max-content(会与子表 width:100% 循环依赖)',
    !!blockCss && !/max-content/.test(blockCss), blockCss.trim().slice(0, 90))
  check('定宽层 .rsp-cover-blockin 用 inline-block 由内容撑开',
    !!blockinCss && /inline-block/.test(blockinCss), blockinCss.trim().slice(0, 90))
  check('签字表 width:100% 跟随定宽层 ⇒ 与字段表同宽',
    /\.rsp-sign-t\s*\{[^}]*width:\s*100%/.test(vueSrc))

  // 竖向:标题行(60) + 9 行字段 + 签字栏,不得互相压盖
  const titleBottom = 25 + 60
  check(`标题行底 ${titleBottom} ≤ 字段表顶 ${DESIGN.gridTop}(不压首行边框)`, titleBottom <= DESIGN.gridTop,
    `标题压表格 ${(titleBottom - DESIGN.gridTop).toFixed(0)}px`)
  const fieldsBottom = DESIGN.gridTop + 9 * DESIGN.rowH
  check(`字段表底 ${fieldsBottom} ≤ 签字栏顶 ${DESIGN.signTop}`, fieldsBottom <= DESIGN.signTop,
    `重叠 ${(fieldsBottom - DESIGN.signTop).toFixed(0)}px`)
  const signBottom = DESIGN.signTop + 2 * DESIGN.signRowH
  check(`签字栏底 ${signBottom} ≤ 画布高 ${DESIGN.canvasH}`, signBottom <= DESIGN.canvasH)

  // 整页装得进 A4:画布高 × 网格宽 / 画布宽 + 尾部预留 ≤ A4 高
  const gridW = 794 // 规格书网格宽 = A4 210mm @96dpi
  const pageH = Math.round(gridW * A4_RATIO) - DESIGN.tailReserve
  const scaled = (DESIGN.canvasH / DESIGN.canvasW) * gridW
  check(`封面内容 ${scaled.toFixed(0)}px(缩放到网格宽) ≤ 可用页高 ${pageH}px`,
    scaled <= pageH, `溢出 ${(scaled - pageH).toFixed(0)}px ⇒ 打印会多出空白页`)

  // ═══ ③ 第 4 页「成品及包装运输」6 节(设计 sheet 逐节对照)═══
  console.log('\n③ 第 4 页(成品及包装运输)6 节')
  // 设计 B4/B13/B17/B22/B25/B30 六节,编号即设计原文
  const P4 = [
    { bar: '1.关键物料列表', key: null },
    { bar: '2.炭棒处理要求', key: '炭棒处理要求' },
    { bar: '3.包装方式', key: '包装方式' },
    { bar: '4.出货检验报告', key: '出货检验报告' },
    { bar: '5.运输要求', key: '运输要求' },
    { bar: '6.存储环境', key: '存储环境' },
  ]
  const p4secs = (cfg.sections || []).filter((s) => s.page === 3)
  check(`第 4 页恰有 6 节(设计 B4/B13/B17/B22/B25/B30)`, p4secs.length === 6, `实际 ${p4secs.length} 节`)
  check('6 节标题与编号 = 设计原文',
    JSON.stringify(p4secs.map((s) => s.bar)) === JSON.stringify(P4.map((s) => s.bar)),
    JSON.stringify(p4secs.map((s) => s.bar)))
  for (const [i, want] of P4.entries()) {
    const sec = p4secs[i]
    if (!sec) continue
    if (!want.key) {
      check(`  「${want.bar}」只出标题、表体交给 dataTables`, (sec.rows || []).length === 0)
      continue
    }
    const row = (sec.rows || [])[0]
    check(`  「${want.bar}」→ 字段 ${want.key}`, !!row && row.key === want.key && liveLabels.has(want.key),
      row ? `key=${row.key}` : '无行')
  }
  // 节的字段必须在活库 label 里(铁律),否则该节空白+丢值
  const p4Keys = p4secs.flatMap((s) => (s.rows || []).map((r) => r.key)).filter(Boolean)
  const p4Bad = p4Keys.filter((k) => !liveLabels.has(k))
  check('第 4 页各节字段都命中活库 label', p4Bad.length === 0, p4Bad.join(', '))
  // 关键物料列表:表头照设计 B6;且必须保留 filterKey/filterVal(否则整张明细被当物料显示)
  const matTbl = (cfg.dataTables || []).find((d) => d.page === 3)
  check('物料表标题 = 1.关键物料列表', !!matTbl && matTbl.bar === '1.关键物料列表', matTbl && matTbl.bar)
  check('物料表表头 = 设计 B6(序号|物料编码|物料名称|规格参数|数量|备注)',
    !!matTbl && JSON.stringify((matTbl.cols || []).filter((c) => !c.hiddenCol).map((c) => c.key)) ===
      JSON.stringify(['序号', '物料编码', '物料名称', '规格参数', '数量', '备注']),
    matTbl ? JSON.stringify((matTbl.cols || []).filter((c) => !c.hiddenCol).map((c) => c.key)) : '无表')
  check('物料表保留 filterKey/filterVal(靠 [表区] 把物料行与其它明细行分开)',
    !!matTbl && !!matTbl.filterKey && !!matTbl.filterVal,
    '删掉会把修订记录/检验项目行也当物料显示')
  check('物料表开启 materialPick(设计 [E4] 由材料库引用)',
    !!matTbl && matTbl.materialPick === true)
  // 默认文案:设计原文
  const sd = cfg.sectionDefaults || {}
  check('2/3/4/5/6 节都有默认文案(照设计原文)',
    ['炭棒处理要求', '包装方式', '出货检验报告', '运输要求', '存储环境'].every((k) => !!sd[k]),
    JSON.stringify(Object.keys(sd)))

  console.log('\n④ 服务端(8090 供应的是这次构建)')
  let entry, rsName, rjs
  try {
    const html = await (await fetch(BASE + '/')).text()
    entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
    const js = await (await fetch(BASE + entry)).text()
    rsName = (js.match(/RecordSheetPanels-[A-Za-z0-9_-]+\.js/) || [])[0]
    rjs = await (await fetch(BASE + '/assets/' + rsName)).text()
  } catch (e) { skipAll('8090 不可达: ' + e.message) }
  check('拿到 RecordSheetPanels 分包', !!rsName, String(rsName))
  check('服务的分包含新封面结构(.rsp-cover-fields)', rjs.includes('rsp-cover-fields'))
  check('服务的分包含定宽层(.rsp-cover-blockin)', rjs.includes('rsp-cover-blockin'))
  check('服务的分包已无右上角编号(.rsp-cover-docno)', !rjs.includes('rsp-cover-docno'),
    '右上角编号已按用户要求去掉,若又出现说明回归了')
  check('服务的分包已无旧流式标签(.rsp-cover-line)', !rjs.includes('rsp-cover-line'))

  // ═══ ⑤ 模板与样式的一致性(改结构后最容易漏的一类)═══
  // 本轮真实踩到:.rsp-cover-label 的 <span> 被换成 <td class="rsp-cover-lb"> 后,
  // CSS 规则删了,但 focusField() 的 querySelector 里还留着 '.rsp-cover-label' 选择器
  // ⇒ **字段跳转(点关联字段跳到封面那一格)会静默失效**。样式类不见了不会报错,只能靠比对发现。
  console.log('\n⑤ 模板 ⟷ 样式 类名一致性')
  const fs = require('node:fs')
  const vue = fs.readFileSync('C:/INCER/YINJIA-MES/frontend/src/core/views/RecordSheetPanels.vue', 'utf8')
  // 封面专属类(CSS 里定义的)
  const cssClasses = [...new Set((vue.match(/\.rsp-(?:cover|sign)-[a-z0-9-]+/g) || []))]
    .map((c) => c.slice(1))
  const notInBundle = cssClasses.filter((c) => !rjs.includes(c))
  check('封面 CSS 类都在服务的分包里(未被 tree-shake ⇒ 确有模板在用)',
    notInBundle.length === 0, notInBundle.join(', '))

  // 反向:模板/脚本里引用、但 CSS 已无定义的封面类(悬空引用)。
  // ⚠ 这一条改了三轮才对,三轮的失效模式都记在这(都是"假绿"或"假红"):
  //   ① 第一版用弱正则匹配"引用",认不出 querySelector('td.x, .y') 复合选择器里的第二个类 ⇒ 假绿;
  //   ② 第二版"CSS 是否定义"只查 `.类名` 是否出现 —— 于是**选择器字符串自己**
  //      ("'.rsp-cover-label'")被当成"定义了样式",悬空照样报通过 ⇒ 仍是假绿;
  //   ③ 第三版只认 `.类名 {` / `.类名,`,又把只在 `:deep()` 组合里出现的类
  //      (如 .rsp-sign-input :deep(.el-input__wrapper))判成悬空 ⇒ **假红**。
  //   ⇒ 正解:匹配 **CSS 规则形态**(行首的 .类名 后跟 `{`/`,`/伪类/子选择器/`:`),
  //      而不是"这个类名在文件里出现过"。
  const referenced = [...new Set((vue.match(/rsp-(?:cover|sign)-[a-z0-9-]+/g) || []))]
  const dangling = referenced.filter((c) => {
    // CSS 规则形态:行首(或 } 后)的 .类名,后面接 { 、逗号续行、伪类、子/后代选择器或 :deep()
    const cssRule = new RegExp(`(^|[}\\n])\\s*\\.${c}(?![a-z0-9-])\\s*(?:[,{]|:[a-z]|>|\\s+[.\\w:])`, 'm').test(vue)
    const inHtmlClass = new RegExp(`class="[^"]*\\b${c}(?![a-z0-9-])`).test(vue)
    const inQuery = new RegExp(`[.'"]${c}(?![a-z0-9-])`).test(vue)
    return (inHtmlClass || inQuery) && !cssRule
  })
  check('无「引用了但样式已删」的悬空封面类', dangling.length === 0, dangling.join(', '))

  console.log(`\n结果:${pass} 通过 / ${fail} 失败${skip ? ` / ${skip} 跳过` : ''}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
