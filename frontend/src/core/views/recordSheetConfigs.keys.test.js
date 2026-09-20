/**
 * recordSheetConfigs 数据键不变量单测
 *
 * 【这条不变量为什么必须自动化守】
 * 后端 `QueryService.selectCols` 用 `t.[col_name] AS [label]` 出列,`rowToLabels` 再按 **label**
 * 建行模型,前端行模型因此是 `{ [label]: value }`;而保存链 `labelsToCols` 用 label 反查 col_name 落库。
 * 前端配置只能看见"行模型",所以:
 *
 *     ① 配置里的数据键必须等于该字段**当前的 label**(否则 `row[key]` 取到 undefined)
 *     ② label 与 col_name **相同**时,两者都满足 —— 这也是既有多数面板的常态
 *     ③ label 与 col_name **分叉**时,配置必须写 label,而不是 col_name
 *
 * ⚠ 反过来说:**改 label 就是改数据键**。2026-09-18 那轮 label 对齐设计时就踩过:
 * 把 物料名→物料名称 / 更改原因→原因 / 更改内容→内容 一改,组装BOM表与组装工艺清单的
 * 配置 key 立刻过期(整列空白 + 保存静默丢值),而且是**人工复核**才发现的。
 *
 * 本测试把这两条钉死。基线 = `rdPanelLabels.fixture.json`
 * (由 `node tools/gen-config-key-fixture.cjs` 从活库导出;**改过 label/字段后必须重跑**)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const FIXTURE = JSON.parse(
  readFileSync(new URL('./rdPanelLabels.fixture.json', import.meta.url), 'utf8'),
)

/** 非 yj_field 字段的合法键(物理分块键 / 分组键 / 行模型常量) */
const NON_FIELD_KEYS = new Set([
  '表区',        // 多张逻辑表共用一张行表时的物理分列键(见 CONTEXT「表区是物理列而非内存标记」)
  '检验类别',    // 出货检验计划表分块键(必测项/型式检验)
  '检验子项',    // 规格书检验项目页分组渲染键(item_code 面)
])

/**
 * ⚠ 已知的**既有**缺陷白名单(本次任务范围外的面板,登记在案待单独修)
 *
 * 症状:以下三列的配置 key 写的是 **col_name**,而该字段的 label 含「\n+括注」,
 * 两者不同 ⇒ 该列 **取不到值(显示空白)且保存时被 labelsToCols 丢掉**。
 * 修法:把配置 key 改成对应 label(或把 label 收敛为纯名称 + 用 alias 放长说明)。
 * 归属:RD_EQUIP_USE / RD_INSTR_USE 两张实验室登记表,2026-09-18 发现,与本次
 *       研发管理设计对齐无关,故**不在本任务内修**,以免夹带无关改动。
 */
const KNOWN_PREEXISTING = new Set([
  'RD_EQUIP_USE|设备状态',
  'RD_INSTR_USE|仪器状态',
  'RD_INSTR_USE|是否内校',
])

/** 面板当前 label 集合 / col_name→label 映射 */
function fxOf(panel) {
  const fx = FIXTURE[panel]
  return {
    labels: new Set(fx?.labels || []),
    cols: fx?.cols || {},
  }
}

test('fixture 覆盖了配置里用到的所有面板', () => {
  const missing = Object.keys(recordSheetConfigs).filter((p) => !FIXTURE[p])
  assert.deepEqual(missing, [], `这些面板没有 label 基线(重跑 gen-config-key-fixture.cjs): ${missing.join(', ')}`)
})

/** 核心断言 ①:dataTables 列的 key 必须是当前 label(或白名单非字段键) */
test('dataTables 每个列的 key 必须是该面板当前的 label', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    if (!FIXTURE[panel]) continue
    const { labels, cols } = fxOf(panel)
    for (const dt of cfg.dataTables || []) {
      for (const c of dt.cols || []) {
        const key = c.key
        if (!key || NON_FIELD_KEYS.has(key) || labels.has(key)) continue
        if (KNOWN_PREEXISTING.has(`${panel}|${key}`)) continue
        problems.push(cols[key]
          ? `${panel} · 表「${dt.bar || '?'}」· key='${key}' 是 col_name,但该字段 label 已改为 '${cols[key]}' ⇒ key 应写 '${cols[key]}'`
          : `${panel} · 表「${dt.bar || '?'}」· key='${key}' 既不是 label 也不是 col_name`)
      }
    }
  }
  assert.deepEqual(problems, [], `配置数据键与 yj_field.label 不一致(该列取不到值且保存丢值):\n  ${problems.join('\n  ')}`)
})

/**
 * 核心断言 ②·补:cover(文档式封面)的 field/sign 键同样必须是当前 label。
 *
 * 【为什么要补这条】规格书封面在 2026-09-18 重排时踩到:
 *   数据库列名 `客户名` 永久不变,但该字段的 **label** 早在 migrate-rd-2026-design.sql
 *   就对齐设计改成了「客户名称」;而封面配置仍写 `key:'客户名'`(col_name)。
 *   ⇒ 封面「客户名称」那一格**取不到值(空白)**,且保存时 labelsToCols 找不到该 label ⇒ 静默丢值。
 *   断言 ①/② 只覆盖 dataTables 与 sections,**封面是盲区**,所以这个 bug 一直没被拦住。
 * 同一条铁律、同一套修法:key 必须写 label;显示文案与数据键不同就分开写(label / key)。
 */
test('cover 的 field/sign 键必须是该面板当前的 label', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    if (!cfg.cover || !FIXTURE[panel]) continue
    const { labels, cols } = fxOf(panel)
    const entries = [
      ...(cfg.cover.fields || []).map((f) => ['fields', f]),
      ...(cfg.cover.sign || []).map((s) => ['sign', s]),
    ]
    for (const [where, e] of entries) {
      const key = e.key
      if (!key || NON_FIELD_KEYS.has(key) || labels.has(key)) continue
      if (KNOWN_PREEXISTING.has(`${panel}|${key}`)) continue
      problems.push(cols[key]
        ? `${panel} · cover.${where} · key='${key}' 是 col_name,但该字段 label 已改为 '${cols[key]}' ⇒ key 应写 '${cols[key]}'`
        : `${panel} · cover.${where} · key='${key}' 既不是 label 也不是 col_name`)
    }
  }
  assert.deepEqual(problems, [], `封面数据键与 yj_field.label 不一致(该格空白且保存丢值):\n  ${problems.join('\n  ')}`)
})

/**
 * 核心断言 ②·补2:报告头(info / subtitle / conclusion / titleFromKey)的键也必须是当前 label。
 *
 * 【为什么要补这条】2026-09-20 出货检验计划表重排时踩到,与封面那次是**同一个坑**:
 *   列 `管理人` 的 label 是「表单管理人」(yj_field.alias 分流),配置却写
 *   `info: [{ label:'表单管理人', key:'管理人' }]`。
 *   而模板渲染的是 `head[effInfo[ii].key]` 与 `selectOptions(effInfo[ii].key)`,
 *   链路后端 `PanelConfigService.fieldSpec()` 定死了 `dataName = f.label()`(≠col_name),
 *   ⇒ `head['管理人']` 恒为 undefined:那一格**永远空白**,保存时也丢值。
 *   断言 ①/②/②·补 覆盖了 dataTables / sections / cover,**报告头是第三个盲区**。
 * 注:`info[].label` 才是「显示文案」(label 与 key 分写),不要拿它当数据键。
 */
test('报告头(info/subtitle/conclusion/titleFromKey)的键必须是该面板当前的 label', () => {
  const problems = []
  const push = (panel, where, key, labels, cols) => {
    if (!key || NON_FIELD_KEYS.has(key) || labels.has(key)) return
    if (KNOWN_PREEXISTING.has(`${panel}|${key}`)) return
    problems.push(cols[key]
      ? `${panel} · ${where} · key='${key}' 是 col_name,但该字段 label 是 '${cols[key]}' ⇒ key 应写 '${cols[key]}'`
      : `${panel} · ${where} · key='${key}' 既不是 label 也不是 col_name`)
  }
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    if (!FIXTURE[panel]) continue
    const { labels, cols } = fxOf(panel)
    ;(cfg.info || []).forEach((e, i) => push(panel, `info[${i}]`, e.key, labels, cols))
    if (cfg.subtitle) push(panel, 'subtitle', cfg.subtitle.key, labels, cols)
    if (cfg.conclusion) push(panel, 'conclusion', cfg.conclusion.key, labels, cols)
    if (cfg.titleFromKey) push(panel, 'titleFromKey', cfg.titleFromKey, labels, cols)
  }
  assert.deepEqual(problems, [], `报告头数据键与 yj_field.label 不一致(该格空白且保存丢值):\n  ${problems.join('\n  ')}`)
})

/**
 * 核心断言 ②:sections 网格字段的 key 同样必须是当前 label
 */
test('sections / tailSections 的字段 key 必须是该面板当前的 label', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    if (!FIXTURE[panel]) continue
    const { labels, cols } = fxOf(panel)
    const secs = [...(cfg.sections || []), ...(cfg.tailSections || []), ...(cfg.tailDocSections || [])]
    for (const sec of secs) {
      for (const row of sec.rows || []) {
        const keys = []
        if (row.cells) keys.push(...row.cells.map((c) => c.key))
        else if (row.grid) keys.push(...row.grid.map((c) => c.key))
        else if (row.key) keys.push(row.key)
        for (const key of keys) {
          if (!key || key === row.label || NON_FIELD_KEYS.has(key) || labels.has(key)) continue
          problems.push(cols[key]
            ? `${panel} · 「${sec.bar || '?'}」· key='${key}' 是 col_name,label 已改为 '${cols[key]}'`
            : `${panel} · 「${sec.bar || '?'}」· key='${key}' 既不是 label 也不是 col_name`)
        }
      }
    }
  }
  assert.deepEqual(problems, [], `section 字段键与 yj_field.label 不一致:\n  ${problems.join('\n  ')}`)
})

/**
 * 同一份语义跨面板共享时,两面板的 label 必须完全一致 —— 而 label 就是数据键。
 *
 * 【历史】RD_ASM_PROC 早先直接复用 RD_ASM_BOM 的 sections/dataTables,同一份配置要同时满足
 *   两个面板,label 一分叉复用即刻失效(R1 把 RD_ASM_PROC 改成 物料名称/原因/内容 就是这次事故)。
 *
 * 【2026-09-20 起】组装工艺清单按《组装工艺控制.xlsx》重排为 3 个页签,组装BOM表那页
 *   **不再复用** RD_ASM_BOM 的配置(列序本就不同:设计是 物料编号|物料名称|… ,旧常量是 物料名|物料编号|…)。
 *   这条断言因此不再是"共享配置"的前提,但**仍然有意义**:两张表读写的是同一批业务字段,
 *   label 一旦分叉,「物料名」在一边是显示名、另一边是数据键,两边导出的单据对不上。
 *   保留它当"两张表的字段字典不得分叉"的守卫。
 *   ⚠ 注意 2026-09-20 的「物料名称」改的是 **yj_field.alias(显示层)**,不是 label ⇒ 本断言不受影响。
 */
test('语义共享的面板,其 label 不得分叉(RD_ASM_PROC / RD_ASM_BOM 的物料与修订字段)', () => {
  const REUSE_PAIRS = [['RD_ASM_PROC', 'RD_ASM_BOM']]
  const problems = []
  for (const [a, b] of REUSE_PAIRS) {
    const fa = (FIXTURE[a] || {}).cols || {}
    const fb = (FIXTURE[b] || {}).cols || {}
    for (const col of Object.keys(fa)) {
      if (fb[col] && fb[col] !== fa[col]) {
        problems.push(`${col}: ${a}='${fa[col]}' vs ${b}='${fb[col]}'`)
      }
    }
  }
  assert.deepEqual(problems, [], `复用同一份配置的面板 label 已分叉(该表在其中一面必然丢值):\n  ${problems.join('\n  ')}`)
})

/** 断言 ③:同一面板内 label 不得重复(后端 byLabel 取首个,重复会导致取到别的列) */
test('同一面板内 label 不得重复', () => {
  const problems = []
  for (const [panel, fx] of Object.entries(FIXTURE)) {
    const seen = new Map()
    for (const [col, label] of Object.entries(fx.cols)) {
      if (seen.has(label)) problems.push(`${panel}: label '${label}' 同时属于 ${seen.get(label)} 与 ${col}`)
      else seen.set(label, col)
    }
  }
  assert.deepEqual(problems, [], `同面板 label 重复(byLabel 只取首个,会取错列):\n  ${problems.join('\n  ')}`)
})

/** 断言 ④:fixture 不得过期到与配置脱节 */
test('配置里用到的每个表内键都能在 fixture 里找到归属', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    if (!FIXTURE[panel]) continue
    const { labels, cols } = fxOf(panel)
    const declared = new Set((cfg.dataTables || []).flatMap((dt) => (dt.cols || []).map((c) => c.key)))
    for (const k of declared) {
      if (NON_FIELD_KEYS.has(k)) continue
      if (!labels.has(k) && !cols[k]) problems.push(`${panel}: '${k}'`)
    }
  }
  assert.deepEqual(problems, [], `fixture 已过期(重跑 gen-config-key-fixture.cjs):\n  ${problems.join('\n  ')}`)
})

/**
 * 断言 ⑤(Phase 4):组装工艺 4 变体的三处取值集必须一致 ——
 *   ① 面板字典(RD_ASM_PROC.工艺形态 的 dict_sql 4 值)
 *   ② 配置 variants 的键(决定纸面标题)
 *   ③ asm.proc 标准库的 item_code(决定勾选带入的内容)
 * 任一处漂移就会出现"选了 A 变体却带出 B 的内容/标题"或"下拉有值但库里没有"。
 * 字典从 fixture 取不到(它只记 label),故直接扫配置 + 断言与标准库列表常量同源。
 */
test('组装工艺 4 变体:面板字典值 / variants 键 / 标准库 item_code 三处一致', () => {
  const VARIANTS = ['裸棒', '机器包布', '复合半成品', '成品']
  const cfg = recordSheetConfigs.RD_ASM_PROC
  assert.ok(cfg, 'RD_ASM_PROC 配置缺失')
  assert.equal(cfg.variantKey, '工艺形态', '变体字段应为 工艺形态(与字典/库同源)')
  assert.deepEqual(Object.keys(cfg.variants || {}), VARIANTS, 'variants 键应与设计 4 个变体 sheet 一致')

  // 标准库条目名的权威清单在生成器里(此处只钉住"配置侧引用的库编码正确")
  const libs = (cfg.dataTables || []).map((dt) => dt.lib).filter(Boolean)
  assert.deepEqual(libs, ['asm.proc'], '页 1 关键控制清单的 lib 应为 asm.proc')

  // 每个变体都必须有纸面标题(否则切变体后标题不跟着变)
  for (const v of VARIANTS) {
    assert.ok(cfg.variants[v].plainTitle, `变体 ${v} 缺 plainTitle`)
    assert.ok(cfg.variants[v].plainTitle.endsWith(v), `变体 ${v} 的 plainTitle 应以变体名结尾`)
  }
})

/**
 * 断言 ⑥(2026-09-20):组装工艺清单的 3 页签结构不变量 —— 设计《组装工艺控制.xlsx》3 个 sheet。
 *
 * 守的是四条**改配置时不会报错、但页面上会静默出错**的坑(全部在 RecordSheetPanels.vue 里实测过):
 *   ① 页缺 grid ⇒ effGrid 回落不到面板 grid 时 secW() 算出 width:0px,
 *      而 .rs-t 是 table-layout:fixed ⇒ 整块条件区塌成一条竖线。
 *   ② showHead 不写 ⇒ 兜底是 `activePage === 0`,页 1/页 2 会莫名没有报告头。
 *   ③ dataTable 缺 filterKey/filterVal ⇒ rowsOf() 返回**整份明细**(三张表互相串行),
 *      且 confirmLib() 的整表替换会删掉所有"表区为空"的行(不可撤销的数据丢失)。
 *   ④ 两张表用同一个 filterVal ⇒ 同一批行在两张表里各显示一次,还都往同一批行上写。
 */
test('组装工艺清单 3 页签:每页有 grid/showHead,每条表有唯一的表区分块键', () => {
  const cfg = recordSheetConfigs.RD_ASM_PROC
  assert.ok(cfg, 'RD_ASM_PROC 配置缺失')

  // ── ①页签数与页题(设计 3 个 sheet 一对一) ──
  const titles = (cfg.pages || []).map((p) => p.title)
  assert.deepEqual(titles, ['修订记录', '组装BOM表', '组装工艺清单'], '页签应为设计 3 个 sheet')

  // ── ②每页都要能算出非 0 的网格宽 ──
  for (const [i, pg] of (cfg.pages || []).entries()) {
    const grid = pg.grid || cfg.grid
    assert.ok(Array.isArray(grid) && grid.length > 0, `第 ${i} 页没有 grid(条件区会塌成 0 宽)`)
    assert.ok(grid.every((w) => w > 0), `第 ${i} 页 grid 含非正列宽`)
  }

  // ── ③showHead 必须逐页显式写(不写会退到「只有第 0 页有报告头」) ──
  for (const [i, pg] of (cfg.pages || []).entries()) {
    assert.equal(typeof pg.showHead, 'boolean', `第 ${i} 页必须显式写 showHead`)
  }

  // ── ④每条数据表都要有 filterKey/filterVal,且表区值互不重复 ──
  const dts = cfg.dataTables || []
  assert.equal(dts.length, 3, '三页各一张数据表')
  const seen = new Map()
  for (const dt of dts) {
    assert.equal(dt.filterKey, '表区', `表「${dt.bar || dt.pageTitle}」的物理分块键应为 表区`)
    assert.ok(dt.filterVal, `表「${dt.bar || dt.pageTitle}」缺 filterVal(会串表并误删行)`)
    assert.ok(!seen.has(dt.filterVal), `表区值 '${dt.filterVal}' 被两张表共用`)
    seen.set(dt.filterVal, dt)
  }
  assert.deepEqual([...seen.keys()].sort(), ['修订记录', '关键控制清单', '物料清单'])

  // ── ⑤每张表归属的页签要存在,且三张表落在三个不同页 ──
  const pagesOf = dts.map((dt) => dt.page ?? 0)
  assert.deepEqual([...pagesOf].sort(), [0, 1, 2], '三张表应各占一个页签')
  for (const p of pagesOf) assert.ok(p < (cfg.pages || []).length, `表归属的页 ${p} 不存在`)

  // ── ⑥三张表都不渲染变体切换行 ──
  // 页 1/2 的「产品基本信息」区已各有一格 工艺形态,表头再来一条就是**同页两个下拉**
  // (实测过:页 1 同时出现「工艺形态 | 请选择」与「工艺形态：| 请选择」);
  // 页 0 没有该区,那条切换行既不驱动标题(本页出 pageTitle)也无处可写。
  for (const dt of dts) {
    assert.equal(dt.noVariant, true, `表「${dt.bar || dt.pageTitle}」应标 noVariant(否则同页重复一个 工艺形态 下拉)`)
  }
})

/**
 * 断言 ⑦(2026-09-20):成型工艺清单的 3 页签结构不变量 —— 用户口径「和组装工艺清单的一样」。
 *   页 0 修订记录(新增)/ 页 1 成型工艺清单(原页 0)/ 页 2 成型配方(原页 1)。
 * 守的坑与断言 ⑥ 同源:页缺 grid ⇒ 条件区塌成 0 宽;showHead 不写 ⇒ 页 1/页 2 没有报告头;
 * 数据表缺 filterKey/filterVal ⇒ rowsOf() 返回整份明细(两张逻辑表互相串行)。
 * 另钉一条**跨面板口径**:成型修订记录页与组装修订记录页的列必须逐字一致(用户明确要求"一样"),
 * 任一侧改了列名/列宽/设计像素而另一侧没跟,这里就红。
 */
test('成型工艺清单 3 页签:每页有 grid/showHead,且修订记录页与组装逐字一致', () => {
  const cfg = recordSheetConfigs.RD_MOLD_PROC
  assert.ok(cfg, 'RD_MOLD_PROC 配置缺失')

  // ── ①页签数与页题(新增修订记录在最前,原两页顺延) ──
  const titles = (cfg.pages || []).map((p) => p.title)
  assert.deepEqual(titles, ['修订记录', '成型工艺清单', '成型配方'], '页签应为 修订记录/成型工艺清单/成型配方')

  // ── ②每页都要能算出非 0 的网格宽 ──
  for (const [i, pg] of (cfg.pages || []).entries()) {
    const grid = pg.grid || cfg.grid
    assert.ok(Array.isArray(grid) && grid.length > 0, `第 ${i} 页没有 grid(条件区会塌成 0 宽)`)
    assert.ok(grid.every((w) => w > 0), `第 ${i} 页 grid 含非正列宽`)
  }

  // ── ③showHead 必须逐页显式写(不写会退到「只有第 0 页有报告头」,而第 0 页正是不要报告头的那页) ──
  for (const [i, pg] of (cfg.pages || []).entries()) {
    assert.equal(typeof pg.showHead, 'boolean', `第 ${i} 页必须显式写 showHead`)
  }
  assert.equal(cfg.pages[0].showHead, false, '修订记录页不出报告头(设计只有一行居中大标题)')

  // ── ④两张逻辑表共用 rd_mold_proc_detail,表区值必须互不重复 ──
  const dts = cfg.dataTables || []
  assert.equal(dts.length, 2, '两张数据表:修订记录 + 配方表')
  for (const dt of dts) {
    assert.equal(dt.filterKey, '表区', `表「${dt.bar || dt.pageTitle}」的物理分块键应为 表区`)
    assert.ok(dt.filterVal, `表「${dt.bar || dt.pageTitle}」缺 filterVal(会串表并误删行)`)
  }
  assert.deepEqual(dts.map((d) => d.filterVal).sort(), ['修订记录', '配方表'], '表区值应为 修订记录/配方表')

  // ── ⑤每张表归属的页签要存在,且落在不同页 ──
  const rev = dts.find((d) => d.filterVal === '修订记录')
  const formula = dts.find((d) => d.filterVal === '配方表')
  assert.equal(rev.page ?? 0, 0, '修订记录表应挂第 0 页')
  assert.equal(formula.page, 2, '配方表应挂第 2 页(成型配方)')
  assert.equal(rev.pageTitle, '修订记录', '修订记录页用居中大标题(pageTitle),不画 bar 行')
  assert.equal(rev.noVariant, true, '修订记录页无 产品基本信息 区,变体切换行无作用')
  for (const dt of dts) assert.ok((dt.page ?? 0) < (cfg.pages || []).length, '表归属的页不存在')

  // ── ⑥区块页归属:页 1 = 成型工艺清单(表单式,无数据表),页 2 = 成型配方 ──
  const secPages = [...(cfg.sections || []), ...(cfg.tailSections || [])].map((s) => s.page ?? 0)
  assert.ok(!secPages.includes(0), '第 0 页(修订记录)不应有区块 —— 它只有一张表')
  assert.ok(secPages.includes(1) && secPages.includes(2), '页 1/页 2 都要有自己的区块')
  assert.ok(!(cfg.sections || []).some((s) => s.bar === '配方表'), '配方表是数据表,不是区块')

  // ── ⑦跨面板口径:与组装工艺清单的修订记录页逐字一致(列序/列宽/设计像素/页题) ──
  const asmRev = (recordSheetConfigs.RD_ASM_PROC.dataTables || []).find((d) => d.filterVal === '修订记录')
  assert.ok(asmRev, '组装工艺清单的修订记录表缺失')
  assert.deepEqual(rev.cols, asmRev.cols, '成型修订记录页的列必须与组装逐字一致(用户口径:一样)')
  assert.deepEqual(rev.design, asmRev.design, '设计像素规范必须与组装一致')
  assert.equal(rev.pageTitle, asmRev.pageTitle)
})

/**
 * 断言 ⑧(2026-09-20):出货检验项目控制计划「一张表 7 列」的版式与自动填充不变量。
 *
 * 设计源《出货检验项目控制计划.xlsx》单 sheet:报告头 + 三行三格表头 + 单张 7 列表 + 跨 7 列表尾注。
 * 这里钉的是**三条同宽约束**(错一条整页竖线不齐、打印左右缘不齐平,且肉眼要拿尺子才看得出来):
 *   ① grid 7 格 = 设计 B..H 列宽,总宽 1187;
 *   ② head {title, infoLabel, infoValue} 合计 = grid 格数(报告头三段跨度),
 *      大标题跨 5 格 = 设计 B3:F4 的合并区,信息栏落 G/H;
 *   ③ sections 每行靠 lspan/vspan 拼满 7 格,且表体 cols 的可见列宽之和 = grid 之和。
 *      ⇒ 报告头 / 表头块 / 表体三处同宽,竖线才对得齐。
 *
 * 另钉两条**会静默出错**的配置事实:
 *   ④ 本面板的数据表**不得**有 filterKey —— rd_insp_plan_detail 连 [表区] 物理列都没有
 *      (yj_field 里那条是 header 遗留),按它过滤只会得到一张**空表**;
 *      检验类别改由 libGroupKey 承载,且内置兜底库的每一行都要带分组值(否则勾选落明细时分组丢失)。
 *   ⑤ autoFillSpec 的 from/to 必须都是真实存在的字段名 —— 它跨面板取 RD_SPEC_DOC 的列,
 *      那边改个 label,这边就静默填空白(与文件头讲的数据键漂移同一个坑)。
 */
test('出货检验计划表:一张表 7 列的三处同宽 + 自动填充规格书的字段名溯源', () => {
  const cfg = recordSheetConfigs.RD_INSP_PLAN
  assert.ok(cfg, 'RD_INSP_PLAN 配置缺失')

  // ── 单 sheet = 单页,不应有页签 ──
  assert.ok(!cfg.pages, '设计是单 sheet,不应配 pages(配了会出页签)')
  assert.equal(cfg.headMode, 'report', '报告头版式')

  // ── ①grid 7 格,总宽 1187(设计 B..H) ──
  const grid = cfg.grid
  assert.ok(Array.isArray(grid) && grid.length === 7, 'grid 应为 7 格(设计 B..H)')
  assert.ok(grid.every((w) => w > 0), 'grid 含非正列宽 ⇒ 条件区/表体会塌')
  const gridSum = grid.reduce((a, b) => a + b, 0)
  assert.equal(gridSum, 1187, `grid 总宽应为 1187,实际 ${gridSum}`)

  // ── ②报告头三段跨度合计 = grid 格数 ──
  const h = cfg.head
  assert.ok(h, '缺 head{title,infoLabel,infoValue} ⇒ 报告头对齐不上网格')
  assert.equal(h.title + h.infoLabel + h.infoValue, grid.length,
    'title + infoLabel + infoValue 必须等于 grid 格数(不等则报告头错位)')
  assert.equal(h.title, 5, '大标题跨 5 格 = 设计 B3:F4 的合并区')
  assert.equal(h.infoLabel, 1)
  assert.equal(h.infoValue, 1)

  // ── ③表头块每行拼满 7 格(照 HTML 表格算法模拟 colspan/rowspan 占位) ──
  // 算法与浏览器一致:从左往右找本行第一个空位放格子;rowspan:r 把**该格占的列**继续占住下面 r-1 行。
  // 判定:全部行处理完后,每个 (行, 列) 都必须被占住 —— 有空位就是缺格(竖线断)、
  // 越界就是超出(末列被挤出去)。
  const rows = (cfg.sections || []).flatMap((sec) => sec.rows || [])
  assert.ok(rows.length >= 3, '表头块应有设计 r5/r6/r7 三行')
  const n = grid.length
  const occ = rows.map(() => new Array(n).fill(false))
  const detail = []
  for (const [ri, row] of rows.entries()) {
    let col = 0
    for (const p of row.pairs || []) {
      const lspan = p.lspan || 1
      const vspan = p.vspan || 1
      const rowspan = p.rowspan || 1
      const need = lspan + vspan
      while (col < n && occ[ri][col]) col++
      assert.ok(col + need <= n, `第 ${ri + 1} 行「${p.label}」放不下(第 ${col} 列起需 ${need} 格,共 ${n} 格)`)
      const from = col
      for (let c = col; c < col + need; c++) occ[ri][c] = true
      col += need
      for (let rr = ri + 1; rr < Math.min(ri + rowspan, rows.length); rr++) {
        for (let c = from; c < from + need; c++) occ[rr][c] = true
      }
      detail.push(`r${ri + 1}「${p.label}」列${from + 1}-${from + need}`)
    }
  }
  for (const [ri, row] of occ.entries()) {
    const hole = row.indexOf(false)
    assert.equal(hole, -1, `第 ${ri + 1} 行第 ${hole + 1} 格空着 ⇒ 整页缺格、竖线断(${detail.join(' / ')})`)
  }

  // ── ④表体:一张表、无 filterKey/表区、可见列宽之和 = grid 之和 ──
  const dts = cfg.dataTables || []
  assert.equal(dts.length, 1, '设计只有一张表')
  const dt = dts[0]
  assert.ok(!dt.filterKey, '⚠ 不得有 filterKey:rd_insp_plan_detail 没有 [表区] 物理列,按它过滤会得到空表')
  assert.ok(!dt.filterVal, '不得有 filterVal(同上)')
  const vis = (dt.cols || []).filter((c) => !c.hiddenCol)
  assert.equal(vis.length, 7, '可见列应恰好 7 列(设计 B..H)')
  const visSum = vis.reduce((a, c) => a + (c.w || 100), 0)
  assert.equal(visSum, gridSum, `表体可见列宽之和 ${visSum} 应等于 grid 之和 ${gridSum}(否则表体与表头同宽不成立)`)

  // ── ⑤libGroupKey:单表形态的分组通道,列要藏起来,内置兜底库每行都要带分组值 ──
  assert.ok(dt.libGroupKey, '单表形态必须用 libGroupKey 承载 必测项/型式检验(否则勾选落明细时分组丢失)')
  assert.ok((dt.cols || []).some((c) => c.key === dt.libGroupKey && c.hiddenCol),
    'libGroupKey 那一列必须 hiddenCol(只参与写库,不上纸)')
  const fx = FIXTURE.RD_INSP_PLAN
  assert.ok(fx?.labels?.includes(dt.libGroupKey), `libGroupKey '${dt.libGroupKey}' 不是本面板的真实字段`)
  const libRows = Array.isArray(dt.lib) ? dt.lib : null
  assert.ok(libRows, 'lib 必须是**数组**:openLib 用 Array.isArray 判是否走扁平 insp.plan 库')
  assert.ok(libRows.length > 0, '内置兜底库不应为空')
  for (const [i, r] of libRows.entries()) {
    assert.ok(String(r[dt.libGroupKey] || '').trim(), `兜底库第 ${i + 1} 行缺 ${dt.libGroupKey} 值(分组会丢)`)
  }
  assert.deepEqual([...new Set(libRows.map((r) => r[dt.libGroupKey]))].sort(), ['型式检验', '必测项'],
    '分组值应与 yj_std_lib 的 item_code 同源(必测项/型式检验)')

  // ── ⑥自动填充规格书:字段名必须两边都真实存在 ──
  const afs = cfg.autoFillSpec
  assert.ok(afs, '设计标了「自动填充规格书」的格子需要 autoFillSpec 配置')
  assert.equal(afs.fromKey, '产品编号', '触发键应为 产品编号(设计里那一格的参照)')
  assert.ok(fx.labels.includes(afs.fromKey))
  assert.ok(afs.head?.length, 'autoFillSpec.head 为空 ⇒ 表头三格不会回填')
  const specFx = FIXTURE.RD_SPEC_DOC
  assert.ok(specFx?.labels?.length, 'fixture 缺 RD_SPEC_DOC(取值源面板)')
  for (const m of afs.head) {
    assert.ok(fx.labels.includes(m.to), `表头落点 '${m.to}' 不是本面板字段(会静默丢值)`)
    assert.ok(specFx.labels.includes(m.from), `取数源 '${m.from}' 不是规格书字段(那边改 label 这里就填空白)`)
  }
  assert.ok(afs.detail?.length, 'autoFillSpec.detail 为空 ⇒ 明细不会回填')
  for (const m of afs.detail) {
    assert.ok(fx.labels.includes(m.to), `明细落点 '${m.to}' 不是本面板字段`)
    assert.ok(specFx.labels.includes(m.from), `取数源 '${m.from}' 不是规格书字段`)
  }
  // 三段式应对措施是设计 F9 模板行的原文,必须挂在**明细**字段上(它在明细行上,不在表头)
  assert.ok(afs.defaults && Object.keys(afs.defaults).length, '缺 autoFillSpec.defaults')
  for (const k of Object.keys(afs.defaults)) {
    assert.ok(fx.labels.includes(k), `兜底值落点 '${k}' 不是本面板字段`)
    assert.ok(!(afs.head || []).some((m) => m.to === k), `'${k}' 是明细字段,不该同时出现在 head 映射里`)
  }

  // ── ⑦autoFillSpec 的明细落点必须正好是表体的列(否则填进去的行不上纸) ──
  const dtKeys = new Set((dt.cols || []).map((c) => c.key))
  for (const m of afs.detail) {
    assert.ok(dtKeys.has(m.to), `明细落点 '${m.to}' 不在表体列里(填了也看不见)`)
  }
})
