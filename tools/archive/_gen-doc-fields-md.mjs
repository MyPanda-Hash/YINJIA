// _gen-doc-fields-md.mjs — 生成《采购链四单字段与显示字段》文档(唯一一致性基线)
//   输入:tools/archive/_dump-out/fields-<库>.md          由 _DumpDocFields.java 导出(yj_panel/yj_field + 物理列)
//        tools/archive/_dump-out/<面板>.runtime.json     由 _dump-panel-config.ps1 导出(后端下发的运行时配置)
//   输出:docs/development/采购链四单字段与显示字段.md
// 用法(仓库根目录,后端 8090 在跑):
//   java -cp lib\mssql-jdbc.jar archive\_DumpDocFields.java HSDZ_MES archive\_dump-out   (在 tools/ 下)
//   powershell -ExecutionPolicy Bypass -File tools\archive\_dump-panel-config.ps1
//   node tools\archive\_gen-doc-fields-md.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const dir = path.join(root, 'tools', 'archive', '_dump-out')
const SRC = path.join(dir, 'fields-HSDZ_MES.md')
const DST = path.join(root, 'docs', 'development', '采购链四单字段与显示字段.md')

const PANELS = [
  { code: 'QC_RECV', aka: '来料暂收单' },
  { code: 'QC_INSP', aka: '' },
  { code: 'QC_RETURN', aka: '暂收退料单' },
  { code: 'PURCHASE_IN', aka: '' },
]

// ---------- 1. 解析导出 ----------
const src = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const field = {}, col = {}, panel = {}
let cur = null
for (const ln of src) {
  if (ln.startsWith('===== ')) { cur = ln.slice(6, -6).trim(); field[cur] = []; col[cur] = []; continue }
  const f = ln.split('\t')
  if (f[0] === 'PANEL') {
    panel[f[1]] = { name: f[2], nameEn: f[3], category: f[4], mode: f[5], head: f[6], line: f[7], codeCol: f[8], dateCol: f[9], prefix: f[10], pageSize: f[11], detailKey: f[12], module: f[13] }
  } else if (f[0] === 'FIELD' && cur) {
    field[cur].push({
      place: f[1], seq: +f[2], label: f[3], col: f[4], type: f[5], width: f[6],
      editable: f[7][0] === 'E', required: f[7][1] === 'R', hidden: f[7][2] === 'H', visible: f[7][3] === 'V',
      alias: f[8], refPanel: f[9], refField: f[10], displayField: f[11], refFilter: f[12], dictSql: f[13], labelEn: f[14],
      id: +f[16],
    })
  } else if (f[0] === 'COL' && cur) {
    col[cur].push({ table: f[1], col: f[2], type: f[3], nullability: f[4], comment: f[5] })
  }
}

// ---------- 2. 运行时配置 ----------
const rt = {}
for (const p of PANELS) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `${p.code}.runtime.json`), 'utf8'))
  const m = j.data.metadata
  const tp = (m.panelPageDto?.tablePages || [])[0] || {}
  const form = (m.formPages || [])[0] || {}
  rt[p.code] = {
    name: m.panelName, category: m.panelCategory, singleDoc: m.singleDoc, autoCode: m.autoCodeField,
    formFields: String(form.fieldNames || '').split(',').map((s) => s.trim()).filter(Boolean),
    query: tp.queryFields || [],
    grid: (tp.gridTabs || [])[0] || { columns: [] },
    tabs: j.data.detail?.tabs || [],
    buttons: (m.panelButtons || []).map((b) => b.buttonName),
    groups: (m.buttonGroups || []).map((g) => `${g.name}:${(g.actions || []).join('/')}`),
    pushTargets: m.pushTargets, panelState: m.panelState,
  }
}

// ---------- 3. 工具 ----------
const has = (place, k) => String(place).split(',').includes(k)
/** 排序真源:seq 升序,同 seq 按 yj_field.id(登记先后)升序 —— 已对四单实测核对 */
const bySeq = (rows) => [...rows].sort((a, b) => a.seq - b.seq || a.id - b.id)
const pick = (code, k) => bySeq(field[code].filter((r) => has(r.place, k)))
/** 表单页表头 = place 含 header,或 place 恰为 query(不含 query,detail —— 带 detail 的只进明细,不进表头) */
const onForm = (r) => has(r.place, 'header') || String(r.place) === 'query'
const headerAll = (code) => bySeq(field[code].filter(onForm))
const gridRows = (code) => bySeq(field[code].filter((r) => has(r.place, 'detail') && r.visible && !r.hidden))
const refOf = (r) => (r.type !== '参照' ? '—' : !r.refPanel ? '⚠️ 未配' : `\`${r.refPanel}\`.${r.refField || '—'}${r.displayField ? ' → ' + r.displayField : ''}`)
const flag = (b) => (b ? '✔' : '')
/** 参照源异常判定:非供应商语义的参照字段却指向 GFDA(供应商)——见 §5 */
const SUSPECT = (r) => r.type === '参照' && r.refPanel === 'GFDA' && !/供应商/.test(r.label)
const refRows = (code) => bySeq(field[code].filter((r) => r.type === '参照'))

const checks = []
function check(code, what, derived, actual) {
  checks.push({ code, what, ok: derived.join('|') === actual.join('|'), derived, actual })
}

const out = []
const W = (...s) => out.push(...s)

// ---------- 4. 文档头 ----------
const now = new Date()
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
W(`# 采购链四单:字段与显示字段登记(唯一一致性基线)`)
W(``)
W(`> **本文档是"字段叫什么、显示成什么、按什么顺序显示"的唯一基线。**`)
W(`> 凡涉及 **送料暂收单 / 来料检验单 / 暂收退回单 / 采购入库单** 的字段增删、显示名调整、顺序变化,`)
W(`> **以及任何"拉取云端仓库更新"后的落地核对,一律以本文档为准**;改完必须回写本文档并重跑末节核验。`)
W(`> 判定标准:更新后界面上这四单的**表头 · 查询区 · 明细列**,字段名 / 显示名 / 顺序与本文档逐条一致。`)
W(``)
W(`| 项 | 值 |`)
W(`|---|---|`)
W(`| 登记日期 | ${stamp} |`)
W(`| 取证库 | \`HSDZ_MES\`(正式账套;测试库 \`HSDZ_MES_TEST\` 只是快照副本,口径一律以正式库为准) |`)
W(`| 元数据真源 | \`yj_panel\` + \`yj_field\` —— 面板与字段**全部数据驱动**,前端不硬编字段 |`)
W(`| 运行时真源 | \`GET /api/px/getPanelConfig?panelCode=<面板编码>\`(\`PanelConfigService\` 下发,前端只渲染) |`)
W(`| 取证/生成脚本 | \`tools/archive/_DumpDocFields.java\` · \`tools/archive/_dump-panel-config.ps1\` · \`tools/archive/_gen-doc-fields-md.mjs\` |`)
W(`| 复核命令 | 见末节 **§8 回写与核验流程** |`)
W(``)

// ---------- 5. 通用口径 ----------
W(`## 一、通用口径(四单共用,动字段前必读)`)
W(``)
W(`### 1.1 位置(place):决定字段出现在哪、按什么排序`)
W(``)
W(`| \`place\` 取值 | 出现处 | 排序 |`)
W(`|---|---|---|`)
W(`| \`header\` | 单据表单页(表头) | \`seq\` 升序 |`)
W(`| \`query\` | 列表页查询条 **+ 表单页表头(同一字段出现两次)** | \`seq\` 升序 |`)
W(`| \`header,query\` | 表单页表头 + 查询条 | \`seq\` 升序 |`)
W(`| \`detail\` | 明细页签 | \`seq\` 升序 |`)
W(`| \`query,detail\` | 查询条 + 明细列 | \`seq\` 升序 |`)
W(``)
W(`> 🔴 **表单页表头顺序 = \`place\` 含 \`header\`,或 \`place\` 恰为 \`query\` 的全部字段,合并后按 \`seq\` 升序。**`)
W(`> 只按 \`header\` 算会少一排字段(单号/单据日期/供应商…全在 \`query\` 位上),这是"顺序对不上"的头号原因;`)
W(`> 而 \`query,detail\` 的字段(如 物料编码/条码)**只进查询条与明细,不进表单页表头** —— 这是第二个坑。`)
W(`> 列表页顶部宽表的明细列顺序 = \`place\` 含 \`detail\` 且可见的字段按 \`seq\` 升序。`)
W(``)
W(`### 1.2 排序真源与并列规则`)
W(``)
W(`| 优先 | 键 |`)
W(`|---|---|`)
W(`| 1 | \`yj_field.seq\` 升序 |`)
W(`| 2(并列时) | \`yj_field.id\` 升序(= 该字段行的登记先后) |`)
W(``)
W(`> \`seq\` 允许并列(四单现有多处并列:\`QC_RECV\` 单据日期/物料编码、\`QC_INSP\` 总结论/条码、\`QC_RETURN\` 单据状态/不良原因、\`PURCHASE_IN\` 存货编码/单据日期)。`)
W(`> 并列时后端按 \`id\` 排,**不是按字段名**。要精确控制顺序,请把 \`seq\` 写成不重复的值,别依赖并列。`)
W(``)
W(`### 1.3 四个显示开关`)
W(``)
W(`| 列 | 语义 | 后果 |`)
W(`|---|---|---|`)
W(`| \`visible\` | 是否作为**表格列**出现 | \`0\` ⇒ 表格不显示该列(明细**表单**里仍可录入) |`)
W(`| \`hidden\` | 是否隐藏 | \`1\` ⇒ 表格与表单都不显示(值仍存、仍参与链路映射) |`)
W(`| \`editable\` | 是否可编辑 | \`0\` ⇒ 只读(生单带下来的字段靠它锁死) |`)
W(`| \`required\` | 是否必填 | \`1\` ⇒ 表单校验拦截保存 |`)
W(``)
W(`> 表格列 = \`visible=1 且 hidden=0\`;明细**表单页签**会额外渲染 \`visible=0\` 的字段供录入 —— 两处字段集合不同,别混为一谈。`)
W(`> 另有面板级宽表列合并/隐藏覆盖(PanelxList),但**列名与相对顺序仍以 \`seq\` 为准**。`)
W(``)
W(`### 1.4 字段 vs 显示字段(ADR-0001:数据键永远中文)`)
W(``)
W(`| 概念 | 落在哪 | 说明 |`)
W(`|---|---|---|`)
W(`| **字段(数据键)** | \`yj_field.label\` | 也是前后端 API 的 \`dataName\`;**永远中文、不随语言变**;本文表格里的"字段"列即是它 |`)
W(`| **物理列** | \`yj_field.col_name\` | 落库列名,**可与字段名不同**(如字段「单号」↔ 列 \`单据编号\`) |`)
W(`| **显示名(译名)** | \`yj_translation(scope='field', ref_key=中文标签, locale)\` | 切语言后**只换显示名**,字段名与顺序都不变 |`)
W(``)
W(`### 1.5 参照字段的显示来源`)
W(``)
W(`参照型字段(\`dataType=参照\`)按 \`ref_panel\` 的 \`ref_field\` 匹配,选中后把 \`display_field\` 回填本字段。逐字段的实际指向见下文各表「参照」列。`)
W(``)

// ---------- 6. 总览 ----------
W(`## 二、四单总览与链路`)
W(``)
W(`| 单据 | 面板编码 | 表头表 | 明细表 | 单号前缀 | 表头字段 | 查询区 | 明细字段(登记 / 表格可见) | 每页 |`)
W(`|---|---|---|---|---|---|---|---|---|`)
for (const p of PANELS) {
  const pn = panel[p.code]
  W(`| **${rt[p.code].name}**${p.aka ? `(${p.aka})` : ''} | \`${p.code}\` | \`${pn.head}\` | \`${pn.line}\` | \`${pn.prefix}\` | ${headerAll(p.code).length} | ${pick(p.code, 'query').length} | ${pick(p.code, 'detail').length} / ${gridRows(p.code).length} | ${pn.pageSize} |`)
}
W(``)
W(`业务链路(\`PanelConfigService\` 注册的生单方向):`)
W(``)
W('```')
W(`采购订单 PU_ORDER`)
W(`  └─ 送料暂收单 QC_RECV ─┬─ 来料检验单 QC_INSP ─┬─ 采购入库单 PURCHASE_IN`)
W(`                        │                      └─ 暂收退回单 QC_RETURN`)
W(`                        └─ 采购入库单 PURCHASE_IN(免检直达)`)
W('```')
W(``)

// ---------- 7. 逐单明细 ----------
W(`## 三、逐单字段登记`)
W(``)
for (const p of PANELS) {
  const c = p.code, pn = panel[c], R = rt[c]
  const heads = headerAll(c)
  const qs = pick(c, 'query')
  const ds = pick(c, 'detail')
  const gs = gridRows(c)
  const tab = R.tabs[0] || { fields: [], calc: [] }

  // 核验三处
  check(c, '表头顺序(place 含 header 或恰为 query,按 seq) vs 运行时 formPages.fieldNames', heads.map((r) => r.label), R.formFields)
  check(c, '查询区顺序 vs 运行时 queryFields', qs.map((r) => r.label), R.query.map((q) => q.dataName))
  check(c, '明细表格列顺序 vs 运行时 gridTabs.columns', gs.map((r) => r.label), R.grid.columns)

  W(``)
  W(`### 3.${PANELS.indexOf(p) + 1} ${R.name}${p.aka ? `(${p.aka})` : ''} —— \`${c}\``)
  W(``)
  W(`| 项 | 值 |`)
  W(`|---|---|`)
  W(`| 表头表 / 明细表 | \`${pn.head}\` / \`${pn.line}\` |`)
  W(`| 单号列 / 日期列 / 前缀 | \`${pn.codeCol}\` / \`${pn.dateCol}\` / \`${pn.prefix}\` |`)
  W(`| 分类 / 模块 | ${pn.category} / ${pn.module} |`)
  W(`| 单单据(一单一明细键) | ${R.singleDoc === true ? '是' : R.singleDoc === false ? '否' : String(R.singleDoc)} |`)
  W(`| 明细键 | \`${pn.detailKey}\` |`)
  W(`| 每页条数 | ${pn.pageSize} |`)
  W(`| 按钮 | ${R.buttons.map((b) => `\`${b}\``).join(' ')} |`)
  W(`| 按钮分组 | ${R.groups.map((g) => `\`${g}\``).join(' ')} |`)
  W(``)

  // 3.x.1 表头
  W(`#### ${R.name} · 表头(表单页显示顺序)`)
  W(``)
  W(`> 顺序 = \`place\` 含 \`header\` 或 \`query\` 的字段按 \`seq\` 升序;**共 ${heads.length} 个**。`)
  W(``)
  W(`| # | 字段(数据键/中文) | 物理列 | 类型 | 宽 | 位置 | 必填 | 只读 | 隐藏 | 显示名(en) | 参照 |`)
  W(`|---|---|---|---|---|---|---|---|---|---|---|`)
  heads.forEach((r, i) => W(`| ${i + 1} | **${r.label}** | \`${r.col}\` | ${r.type} | ${r.width || '—'} | ${String(r.place).split(',').map((x) => ({ header: '表头', query: '查询' })[x] || x).join('+')} | ${flag(r.required)} | ${r.editable ? '' : '只读'} | ${flag(r.hidden)} | ${r.labelEn || '—'} | ${refOf(r)} |`))
  W(``)

  // 3.x.2 查询区
  W(`#### ${R.name} · 查询区(列表页顶部查询条顺序)`)
  W(``)
  W(`> 顺序 = \`place\` 含 \`query\` 的字段按 \`seq\` 升序;**共 ${qs.length} 个**。查询字段同时出现在表单页表头(见上表,"查询"位置)。`)
  W(``)
  W(`| # | 字段(数据键/中文) | 物理列 | 类型 | 宽 | 必填 | 参照 |`)
  W(`|---|---|---|---|---|---|---|`)
  qs.forEach((r, i) => W(`| ${i + 1} | **${r.label}** | \`${r.col}\` | ${r.type} | ${r.width || '—'} | ${flag(r.required)} | ${refOf(r)} |`))
  W(``)

  // 3.x.3 明细表格显示顺序(最直观)
  W(`#### ${R.name} · 明细**表格列显示顺序**(列表页宽表)`)
  W(``)
  W(`> 顺序 = \`place\` 含 \`detail\` 且 \`visible=1 且 hidden=0\` 的字段按 \`seq\` 升序;**共 ${gs.length} 列**。`)
  W(``)
  W('```')
  gs.forEach((r, i) => W(`${String(i + 1).padStart(2, ' ')}. ${r.label}${r.col !== r.label ? `   (列 ${r.col})` : ''}`))
  W('```')
  W(``)

  // 3.x.4 明细全部字段
  W(`#### ${R.name} · 明细字段全量(含不显示列,按 \`seq\`)`)
  W(``)
  W(`> \`place\` 含 \`detail\` 的字段全部列出;**共 ${ds.length} 个**,其中表格可见 ${gs.length} 个。`)
  W(``)
  W(`| # | 字段(数据键/中文) | 物理列 | 类型 | 宽 | 表格列 | 必填 | 只读 | 隐藏 | 显示名(en) | 参照 |`)
  W(`|---|---|---|---|---|---|---|---|---|---|---|`)
  ds.forEach((r, i) => W(`| ${i + 1} | **${r.label}** | \`${r.col}\` | ${r.type} | ${r.width || '—'} | ${r.visible && !r.hidden ? '✔' : '—'} | ${flag(r.required)} | ${r.editable ? '' : '只读'} | ${flag(r.hidden)} | ${r.labelEn || '—'} | ${refOf(r)} |`))
  W(``)
  if ((tab.calc || []).length) {
    W(`**明细自动计算规则(\`detail.tabs[0].calc\`)**:`)
    W(``)
    W(`| 目标字段 | 公式 | 小数位 |`)
    W(`|---|---|---|`)
    for (const c2 of tab.calc) W(`| ${c2.target} | \`${c2.formula}\` | ${c2.round} |`)
    W(``)
  }

  // 3.x.5 落库表列
  const headCols = col[c].filter((x) => x.table === pn.head)
  const lineCols = col[c].filter((x) => x.table === pn.line)
  const headReg = new Set(field[c].filter((r) => has(r.place, 'header') || has(r.place, 'query')).map((r) => r.col))
  const lineReg = new Set(field[c].filter((r) => has(r.place, 'detail')).map((r) => r.col))
  W(`#### ${R.name} · 落库表列对照`)
  W(``)
  W(`| 表 | 物理列数 | 已被面板字段登记 | 未登记(不显示,多为备用列) |`)
  W(`|---|---|---|---|`)
  const spare = (arr, reg) => arr.map((x) => x.col).filter((n) => !reg.has(n))
  const sp1 = spare(headCols, headReg), sp2 = spare(lineCols, lineReg)
  W(`| \`${pn.head}\`(表头) | ${headCols.length} | ${headCols.length - sp1.length} | ${sp1.length ? sp1.join('、') : '—'} |`)
  W(`| \`${pn.line}\`(明细) | ${lineCols.length} | ${lineCols.length - sp2.length} | ${sp2.length ? sp2.join('、') : '—'} |`)
  W(``)
  W(`> 未登记列 = 表里有列但面板无同名字段 ⇒ **界面不显示**。新增/删除列后必须同步 \`yj_field\`,否则列存在但看不见。`)
  W(``)

  // 3.x.6 核验结论
  W(`#### ${R.name} · 顺序核验`)
  W(``)
  W(`| 核验项 | 结论 |`)
  W(`|---|---|`)
  const mine = checks.filter((x) => x.code === c)
  for (const k of mine) W(`| ${k.what} | ${k.ok ? '✅ 一致' : '❌ 不一致'} |`)
  W(``)
}

// ---------- 8. 核验汇总 ----------
W(`## 四、顺序核验汇总(yj_field 推导 vs 后端下发)`)
W(``)
W(`> 每次改动后重跑生成脚本;下表出现 ❌ 即表示**库里的元数据与后端实际下发不一致**,必须先对齐再交付。`)
W(``)
W(`| 面板 | 核验项 | 结论 |`)
W(`|---|---|---|`)
for (const k of checks) W(`| \`${k.code}\` | ${k.what} | ${k.ok ? '✅ 一致' : '❌ 不一致'} |`)
W(``)

// ---------- 9. 已知问题 ----------
W(`## 五、已知字段显示不一致(须先修,否则"显示一致"无从谈起)`)
W(``)
W(`> 本节记录**当前库里已存在**、会影响字段显示的缺陷。它不属于"顺序",但同样属于"字段显示一致性",`)
W(`> 核对本文档时必须一并处理。`)
W(``)
W(`### 5.1 送料暂收单 / 来料检验单:参照源被整体改写成 GFDA(供应商)`)
W(``)
W(`**现象**:\`QC_RECV\` 与 \`QC_INSP\` 上**除供应商系列以外**的参照字段,其 \`ref_panel\` 也被写成了 \`GFDA\`(供应商档案)。`)
W(`后果是点开 物料编码 弹出的是**供应商**列表,点开 业务员/检验员/审核人 也是供应商,点开 仓库/单位 还是供应商;`)
W(`且 \`buildRefMap\` 会据此把 \`供应商名称/供应商编码\` 带回本字段 ⇒ **选一个物料可能把供应商写进单里**。`)
W(``)
W(`**影响面(实测计数)**`)
W(``)
W(`| 面板 | 参照型字段总数 | 其中指向 GFDA | 指向异常(非供应商语义却指 GFDA) |`)
W(`|---|---|---|---|`)
for (const p of PANELS) {
  const rr = refRows(p.code)
  const g = rr.filter((r) => r.refPanel === 'GFDA')
  const s = rr.filter(SUSPECT)
  W(`| ${rt[p.code].name} \`${p.code}\` | ${rr.length} | ${g.length} | ${s.length ? `**${s.length}**` : '—'} |`)
}
W(``)
W(`**异常字段清单(应指向的档案按语义推断,修复时逐条确认)**`)
W(``)
W(`| 面板 | 位置 | 字段 | 现指向 | 语义上应指向 |`)
W(`|---|---|---|---|---|`)
const GUESS = [
  [/物料编码|存货编码|物料名称|存货名称/, '`INV`(商品档案)'],
  [/业务员|检验员|经手人|审核人|品质复核人|检验人/, '`EMP`(职员档案)'],
  [/部门/, '`DEPT`(部门档案)'],
  [/仓库/, '`WH`(仓库档案)'],
  [/^单位$|计量单位/, '`UOM`(计量单位)'],
  [/采购单号|采购订单号/, '`PU_ORDER`(采购订单)'],
  [/^订单号$/, '`SO_ORDER`(销售订单,原建单口径)'],
  [/暂收单号/, '`QC_RECV`(送料暂收单)'],
  [/检验编号|检验方案|执行标准|总结论/, '业务确认(专用检验主数据)'],
]
for (const p of PANELS) {
  for (const r of refRows(p.code).filter(SUSPECT)) {
    const g = GUESS.find(([re]) => re.test(r.label))
    W(`| \`${p.code}\` | ${String(r.place).split(',').map((x) => ({ header: '表头', query: '查询', detail: '明细' })[x] || x).join('+')} | **${r.label}** | \`GFDA\`.${r.refField} → ${r.displayField} | ${g ? g[1] : '待确认'} |`)
  }
}
W(``)
W(`**根因(已定位,证据确凿)**`)
W(``)
W(`\`tools/migrate-sl-supplier-ref.sql\` 在 2026-09-24 被追加了一行内注释,而该注释**把同一行后面原有的筛选条件整段吞掉**了:`)
W(``)
W('```sql')
W(`-- 原文(2026-09-17,正确)`)
W(`WHERE panel_code IN ('SL_RECV', 'QC_INSP') AND label = N'供应商' AND place LIKE '%header%'`)
W(``)
W(`-- 现状(2026-09-24 追加注释后,label/place 两个条件被注释吃掉)`)
W(`WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RECV')  -- 2026-09-24 补 QC_RECV(...) AND label = N'供应商' AND place LIKE '%header%'`)
W(`  AND ISNULL(ref_panel, '') <> 'GFDA';`)
W('```')
W(``)
W(`⇒ 实际执行的 \`WHERE\` 只剩「面板在列表里 且 参照不是 GFDA」,**两个面板的每一行字段都被刷成 GFDA**。`)
W(`又因迁移链按**内容哈希**判定(DbSync),该文件字节一变就会被判为"未执行"而**重跑**,于是"改文件"和"重放"叠加成了这次污染。`)
W(``)
W(`**修复口径(另立任务,勿混入本文档提交)**`)
W(``)
W(`1. 先修 \`tools/migrate-sl-supplier-ref.sql\`:把被吞掉的 \`label\` / \`place\` 条件**换行还原**(注释另起一行),保住其幂等语义;`)
W(`2. 新写 \`tools/migrate-qc-ref-repair.sql\`:按上表逐字段回正 \`ref_panel/ref_field/display_field\`(只动参照源,不动名称与顺序);`)
W(`3. 两个账套各跑 \`DbSync\`,再重跑本文档生成脚本,确认 §5 清单清零、§四 仍全 ✅;`)
W(`4. 界面上逐个参照字段点开确认弹的是对的档案。`)
W(``)

// ---------- 10. 红线 ----------
W(`## 六、红线(改字段时不可违反)`)
W(``)
W(`1. **数据键永远中文**:\`yj_field.label\` / \`dataName\` / 按钮名 / 单据状态存储值不随语言变化(ADR-0001)。`)
W(`   中文标签就是"字段契约",改中文标签 = 改契约,必须同步迁移所有引用它的代码与 SQL。`)
W(`2. **顺序只能靠 \`place\` + \`seq\` 调**,禁止在代码里重排字段;调序必须写成幂等迁移脚本(用 \`seq\` 重编号,并处理同 \`seq\` 冲突)。`)
W(`3. **新增字段必须四件套齐全**:① 物理列(带 \`MS_Description\` 中文注明)② \`yj_field\` 行 ③ \`yj_translation\` 各语言译名(至少 en)④ 本文档对应表回写。`)
W(`   缺任何一项 = 任务未完成。`)
W(`4. **删除字段**同样要迁移 + 回写本文档;仅把 \`visible\` 置 0 是"隐藏",不是"删除",不得混用。—— 用户说"删掉"时,先确认是隐藏还是真删。`)
W(`5. **两个账套都要执行**:正式库 \`HSDZ_MES\` 先跑,再跑测试库 \`HSDZ_MES_TEST\`(\`YINJIA_SQL_DB=HSDZ_MES_TEST\`);只跑一个 = 任务未完成。`)
W(`6. **不改这四单以外的面板顺序**:本文档只登记这四单;其余单据若显示不一致,另开登记,不要顺手在这里改。`)
W(``)

// ---------- 10. 变更流程 ----------
W(`## 七、变更流程(增/删/改名/调序都走这条)`)
W(``)
W(`1. **先读本文档**,确认要动的是哪张表的哪一节(表头 / 查询区 / 明细 / 表格可见性)。`)
W(`2. 写**幂等**迁移脚本 \`tools/migrate-<主题>.sql\`:改 \`yj_field\`(\`seq\`/\`place\`/\`visible\`/\`hidden\`/\`editable\`/\`width\`/\`ref_*\`)+ 必要时改物理列,并写入 \`MS_Description\` 与 \`yj_translation\` 译名。`)
W(`3. 在 \`tools/db-migrations.txt\` 登记该脚本(迁移链顺序即真实执行时序)。`)
W(`4. **两个账套**各跑一遍 \`DbSync\` 至「执行 0、失败 0」。`)
W(`5. **重跑取证 + 重新生成本文档**(命令见 §8),\`§四 顺序核验汇总\` 必须全 ✅。`)
W(`6. 界面上按 §8 的走查清单目视确认一遍(切 en 再看一遍显示名)。`)
W(`7. 单独一个 commit:\`docs: 采购链四单字段与显示字段登记(…) \` 或 \`db: …\`。`)
W(``)

// ---------- 11. 回写与核验 ----------
W(`## 八、回写与核验流程(拉取云端仓库更新后必做)`)
W(``)
W(`> 从云端仓库拉取更新(或服务器部署)后,**这四单的字段与顺序有没有被改动、改得对不对**,按下面三步核。`)
W(``)
W(`### 8.1 前置`)
W(``)
W(`| 需求 | 说明 |`)
W(`|---|---|`)
W(`| 后端在跑 | \`tools/scripts/start-prod.ps1\`(http://127.0.0.1:8090,幂等;已在跑就跳过) |`)
W(`| 数据库可连 | \`yinjia@127.0.0.1:1433\`;\`tools/lib/mssql-jdbc.jar\` |`)
W(`| 迁移已同步 | \`tools/pull-sync.bat\`(git pull + DbSync 增量) |`)
W(``)
W(`### 8.2 三步核验命令(仓库根目录)`)
W(``)
W('```powershell')
W(`# ① 取库侧真源(yj_panel/yj_field + 物理列)`)
W(`cd tools`)
W(`java -cp lib\\mssql-jdbc.jar archive\\_DumpDocFields.java HSDZ_MES archive\\_dump-out`)
W(`cd ..`)
W(``)
W(`# ② 取运行时真源(后端实际下发的字段与顺序)`)
W(`powershell -ExecutionPolicy Bypass -File tools\\archive\\_dump-panel-config.ps1`)
W(``)
W(`# ③ 重新生成本文档(会顺带输出 §四 顺序核验)`)
W(`node tools\\archive\\_gen-doc-fields-md.mjs`)
W('```')
W(``)
W(`生成后 \`git diff docs/development/采购链四单字段与显示字段.md\`:`)
W(``)
W(`- **无 diff** ⇒ 四单字段与显示顺序未变,更新不影响字段一致性;`)
W(`- **有 diff** ⇒ 逐条核对差异是否是本次更新**有意为之**;是有意则连同迁移脚本一起提交,是意外则回退更新并排查。`)
W(``)
W(`### 8.3 界面走查清单(生成脚本证不了的部分)`)
W(``)
W(`| # | 检查点 | 期望 |`)
W(`|---|---|---|`)
W(`| 1 | 四单列表页表头列顺序 | 与本档「明细表格列显示顺序」逐列一致 |`)
W(`| 2 | 四单表单页表头字段顺序 | 与本档「表头」表一致(含 \`query\` 位字段) |`)
W(`| 3 | 四单查询条字段顺序 | 与本档「查询区」表一致 |`)
W(`| 4 | 切换语言到 \`en\` / \`ja\` | **只换显示名,字段名与顺序不变**(多语言红线) |`)
W(`| 5 | 生单流转(暂收→检验→入库/退回) | 带下来的字段落在本档登记的列上,不出现"写了落不下去" |`)
W(``)
W(`---`)
W(``)
W(`_本文档由 \`tools/archive/_gen-doc-fields-md.mjs\` 从 \`HSDZ_MES\` 库元数据 + 后端运行时配置生成;`)
W(`手改本文档无效 —— 改动请落在迁移脚本上,再重跑生成。_`)
W(``)

// ---------- 12. 落盘 ----------
fs.mkdirSync(path.dirname(DST), { recursive: true })
fs.writeFileSync(DST, out.join('\n'), 'utf8')
const bad = checks.filter((c) => !c.ok)
console.log('[ok]', DST)
console.log(`[checks] ${checks.length - bad.length}/${checks.length} 一致`)
for (const b of bad) {
  console.log(`  ❌ ${b.code} ${b.what}`)
  console.log(`     yj_field: ${b.derived.join(' → ')}`)
  console.log(`     运行时  : ${b.actual.join(' → ')}`)
}

