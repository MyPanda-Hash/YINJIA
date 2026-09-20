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
