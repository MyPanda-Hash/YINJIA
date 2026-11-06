/**
 * recordSheetConfigs.requiredRendered.test.js —— 「必填项必须真的画在纸上」体检
 *
 * 【守的是什么】
 *   后端 `ButtonService` 保存前做**全量必填校验**(ensureRequiredFilled / ensureDetailRequiredFilled),
 *   前端 `PanelxList.validateInlineDraft` 也按同一份 `yj_field.required` 校验。
 *   于是只要出现「`required=1` 但纸面/明细**没有任何输入格**」的字段,这单就**永远存不了**:
 *   提示「X不能为空」,而界面上根本没有 X 可填 —— 用户 2026-11-06 明确要求防这一类。
 *   (历史同类事故见 PanelxList :9124 与 docs/development/明细参照确认与必填校验-成因与处理方案.md)
 *
 * 【基线从哪来】
 *   `rdPanelLabels.fixture.json` 的 `req` 段(由 `node tools/gen-config-key-fixture.cjs` 从活库导出,
 *   2026-11-06 起带 required/hidden/visible)。改过必填标记或加了字段后必须重跑该脚本。
 *
 * 【判据】
 *   对 recordSheetConfigs 里的每个面板:凡 `required && !hidden && visible` 的字段,
 *   必须能在这份配置的**渲染面**上找到:
 *     · 表头:sections 的 rows[].pairs/.grid/.cells、subtitle、titleKey、cover.fields/sign、info、
 *             head.docNoKey / docNoKey、dualDocNo、variantKey、pageTabs、groupBy.headKey、页面级
 *             titleKey / docNoKey;
 *     · 明细:dataTables[].cols(非 hiddenCol)的 key。
 *   找不到 ⇒ 失败,并点名是哪个面板哪个字段(要么补一格,要么把 required 关掉/加进数据迁移)。
 *
 * 【两个系统字段的豁免(写在代码里,不是静默跳过)】
 *   · 单据编号:后端自动生成(ButtonService 按 code_col/prefix 出号),人不需要也不能填;
 *   · 单据日期:前端 validateInlineDraft 在拦单前会**自动填今天**(PanelxList :9106-9109),
 *     真缺也拦不住人,不需要纸面格。
 *   两条都带注释,谁想再豁免别的字段,请在这里登记理由 —— 与 specCarryMap.test 的 NO_SOURCE 同款纪律。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const FIXTURE = JSON.parse(
  readFileSync(new URL('./rdPanelLabels.fixture.json', import.meta.url), 'utf8'),
)

/** 系统自动填、不需要纸面格(改了这里必须写清理由) */
const AUTO_FILLED = new Map([
  ['单据编号', '后端自动出号(ButtonService 按前缀/日期生成),人不填'],
  ['单据日期', '前端拦单前自动填今天(PanelxList validateInlineDraft),不会真的卡住用户'],
])

/** 配置里"纸面上渲染得出来"的数据键集合(与渲染器实际读取一致) */
export function renderedKeysOf(cfg) {
  const keys = new Set()
  const add = (o) => {
    if (!o) return
    if (typeof o === 'string') { keys.add(o); return }
    const k = o.key || o.label
    if (k) keys.add(k)
    for (const c of o.cells || []) add(c)
  }
  for (const sec of cfg.sections || []) {
    if (sec.subtitle) add(sec.subtitle)
    for (const row of sec.rows || []) {
      add(row)
      if (row.subtitle) add(row.subtitle)
      for (const p of row.pairs || []) add(p)
      for (const g of row.grid || []) add(g)
      for (const c of row.cells || []) add(c)
    }
    for (const one of sec.items || []) add(one)
  }
  for (const dt of cfg.dataTables || []) {
    for (const c of dt.cols || []) if (!c.hiddenCol) add(c)
    for (const sh of dt.subHeads || []) add(sh)
  }
  for (const f of (cfg.cover && cfg.cover.fields) || []) add(f)
  for (const f of (cfg.cover && cfg.cover.sign) || []) add(f)
  for (const f of cfg.info || []) add(f)
  if (cfg.titleKey) add(cfg.titleKey)
  if (cfg.coverDocNoKey) add(cfg.coverDocNoKey)
  if (cfg.dualDocNo) add(cfg.dualDocNo)
  if (cfg.variantKey) add(cfg.variantKey)
  if (cfg.groupBy && cfg.groupBy.headKey) add(cfg.groupBy.headKey)
  if (cfg.head) { if (cfg.head.docNoKey) add(cfg.head.docNoKey); if (cfg.head.titleKey) add(cfg.head.titleKey) }
  // 报告头大标题 = 测试主题 输入。RecordSheetPanels 模板 :212 的分支是
  //   `editable && !derivedTitle` ⇒ 既没 titleKey、也没 titleFromKey(派生标题)时,大标题格里
  //   渲染的就是 v-model="head['测试主题']" 的输入框(静态标题只影响只读态,不影响编辑态)。
  if (!cfg.titleKey && !cfg.titleFromKey) add('测试主题')
  for (const t of cfg.pageTabs || []) { add(t.key || t); if (t.docNoKey) add(t.docNoKey); if (t.titleKey) add(t.titleKey) }
  for (const pg of cfg.pages || []) {
    if (pg.docNoKey) add(pg.docNoKey)
    if (pg.titleKey) add(pg.titleKey)
    if (pg.staticTitle) add(pg.titleKey || '')
  }
  return keys
}

/** 明细列(含隐藏列之前先排除) */
function detailKeysOf(cfg) {
  const keys = new Set()
  for (const dt of cfg.dataTables || []) for (const c of dt.cols || []) keys.add(c.key || c.label)
  return keys
}

/** 明细"整表必填"(tab 级)的页签键 —— 那种罚的是页签不是字段 */
function requiredTabKeysOf(cfg) {
  const keys = new Set()
  for (const dt of cfg.dataTables || []) if (dt.isRequired && dt.key) keys.add(dt.key)
  return keys
}

test('必填项必须画在纸上/明细里(否则单据永远存不了)', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    const fx = FIXTURE[panel]
    if (!fx || !fx.req) continue
    const rendered = renderedKeysOf(cfg)
    const detailKeys = detailKeysOf(cfg)
    const reqTabs = requiredTabKeysOf(cfg)
    for (const [label, meta] of Object.entries(fx.req)) {
      if (!meta || !meta.required) continue
      if (meta.hidden || !meta.visible) continue
      if (AUTO_FILLED.has(label)) continue
      if (reqTabs.has(label)) continue
      const ok = rendered.has(label) || detailKeys.has(label)
      if (!ok) problems.push(`${panel} · ${label}`)
    }
  }
  assert.deepEqual(problems, [],
    '这些字段 required=1 但配置里没有对应的输入格(用户填不了,单据必然存不了):\n  ' + problems.join('\n  '))
})

test('豁免清单只登记系统字段,且每个都要能说明白', () => {
  for (const [field, why] of AUTO_FILLED) {
    assert.ok(why && why.length > 8, `${field} 的豁免理由太敷衍`)
  }
  assert.deepEqual([...AUTO_FILLED.keys()].sort(), ['单据日期', '单据编号'],
    '新增豁免必须同步这条断言,避免"越豁免越多"')
})
