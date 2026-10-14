/**
 * Phase 3 取样核对(2026-10-14):每类单据从金蝶**真实账套**拉 1 条已审核单据,产出
 *   ① 逐字段对照素材(金蝶原值 JSON + 金蝶键 → MES 字段/物理列 → 落库值 的对照表)
 *   ② 写入**测试账套 HSDZ_MES_TEST** 各 1 张样例单据(含明细行),供界面核对字段与版式
 *
 * 为什么写测试账套:两账套纪律 —— 正式库 HSDZ_MES 只录真实业务,样例/演示数据一律落 HSDZ_MES_TEST。
 *
 * 🔴 只读金蝶(真实账套 deploy/config.json,全部 GET,绝不 POST)。
 * 用法: node tools/archive/_pull-kingdee-samples-1014.mjs
 * 产物: tools/archive/_dump-out/kingdee-samples-1014.json  (金蝶原始返回)
 *        tools/archive/_dump-out/kingdee-samples-1014.md    (逐字段对照表)
 *        tools/archive/_dump-out/kingdee-samples-1014.sql   (写入测试账套的 INSERT;由 SqlRunner 执行)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const s = (v) => (v === undefined || v === null ? '' : String(v))
const q = (v) => (v === '' || v === undefined || v === null ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? 'NULL' : String(v))

/** 取样:各类型取 1 张已审核单据的详情 */
const TYPES = [
  { api: 'inv_product', panel: 'FINISH_IN', label: '产品入库单', head: 'bd_finish_in', line: 'bl_finish_in' },
  { api: 'inv_other_in', panel: 'OTHER_IN', label: '其他入库单', head: 'bd_other_in', line: 'bl_other_in' },
  { api: 'inv_other_out', panel: 'OTHER_OUT', label: '其他出库单', head: 'bd_other_out', line: 'bl_other_out' },
]

/** 表头映射(金蝶键 → MES 物理列);per type 差异用 only 标记 */
const HEAD_MAP = [
  ['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'],
  ['bill_date', '单据日期'], ['bill_type_name', '单据类型', ['inv_product']],
  // bd_finish_in.业务类型 是 NOT NULL(两账套已对齐,见 migrate-finish-in-notnull-align-20261015.sql)
  // ⇒ 取样时必须写:用金蝶 bill_type_name(「产品入库单」)填,否则 INSERT 报「不能将 NULL 值插入列」
  ['bill_type_name', '业务类型', ['inv_product']],
  ['trans_type_name', '业务类型', ['inv_other_in', 'inv_other_out']],
  ['trans_type_number', '业务类型编码', ['inv_other_in', 'inv_other_out']],
  ['trans_type_id', '业务类型id', ['inv_other_in', 'inv_other_out']],
  ['supplier_number', '供应商编码', ['inv_other_in']], ['supplier_name', '供应商', ['inv_other_in']],
  // 部门/经手人:产品入库单与**其他出库单**有(其他入库单是供应商口径,表里没有这两族列)
  ['dept_name', '部门', ['inv_product', 'inv_other_out']], ['dept_number', '部门编码', ['inv_product', 'inv_other_out']],
  ['emp_name', '经手人', ['inv_product', 'inv_other_out']], ['emp_number', '经手人编码', ['inv_product', 'inv_other_out']],
  ['creator_name', '创建人'], ['create_time', '创建时间'],
  ['modifier_name', '修改人'], ['modify_time', '修改时间'],
  ['auditor_name', '审核人'], ['audit_time', '审核时间'],
  ['auditor_name', '金蝶审核人'], ['audit_time', '金蝶审核时间'],
  ['remark', '备注'],
]
const LINE_MAP = [
  ['seq', '序号'],
  ['material_number', '产品编码', ['inv_product']], ['material_name', '产品名称', ['inv_product']],
  ['material_number', '存货编码', ['inv_other_in', 'inv_other_out']], ['material_name', '存货名称', ['inv_other_in', 'inv_other_out']],
  ['material_model', '规格型号'],
  ['stock_name', '仓库'], ['stock_number', '仓库编码', ['inv_other_in', 'inv_other_out']],
  ['unit_name', '计量单位'],
  ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
  ['aux_unit_name', '辅助单位名称'], ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'],
  ['conversion_rate', '换算率'], ['coefficient', '换算系数'], ['aux_coefficient', '辅助换算系数'],
  ['qty', '实收数量', ['inv_product']], ['qty', '数量', ['inv_other_in', 'inv_other_out']],
  ['aux_qty', '辅助数量', ['inv_other_in', 'inv_other_out']],
  ['inv_qty', '库存数量'],
  ['batch_no', '批号', ['inv_product', 'inv_other_out']],
  ['picture', '存货图片', ['inv_product', 'inv_other_in']],
  ['cost', '成本', ['inv_other_in']], ['unit_cost', '单位成本', ['inv_other_in']],
  ['comment', '备注', ['inv_product']], ['comment', '明细备注', ['inv_other_in', 'inv_other_out']],
]

const applies = (rule, api) => !rule || rule.includes(api)
const out = { at: new Date().toISOString(), account: cfg.outerInstanceId, samples: {} }
const md = ['# 金蝶 → MES 取样对照(每类 1 条真实单据)', '',
  `- 金蝶账套:惠州市银嘉环保(outerInstanceId ${cfg.outerInstanceId},**只读**)`,
  `- 落库目标:**测试账套 HSDZ_MES_TEST**(正式库只录真实业务)`,
  `- 抓取时间:${out.at}`, '']
const sql = [`-- kingdee-samples-1014.sql — 由 tools/archive/_pull-kingdee-samples-1014.mjs 生成`,
  `-- 用途:Phase 3 取样核对 —— 每类单据写入 1 张金蝶真实单据作为样例(仅测试账套 HSDZ_MES_TEST)`,
  'SET NOCOUNT ON;']
let insertSeq = 0

for (const t of TYPES) {
  const listPath = `/jdy/v2/scm/${t.api}`
  const list = await kingdeeTryGet(cfg, token, listPath, { bill_status: 'C', page: '1', page_size: '1' })
  if (!list.ok) { md.push(`## ${t.label} — ❌ ${String(list.error).slice(0, 120)}`); continue }
  const row = (list.data.rows || [])[0]
  const det = await kingdeeTryGet(cfg, token, `${listPath}_detail`, { id: String(row.id) })
  const d = det.ok ? det.data || {} : {}
  const ents = d.material_entity || []
  out.samples[t.api] = { panel: t.panel, bill_no: d.bill_no, bill_date: d.bill_date, header: d, entries: ents }
  md.push(`## ${t.label} — 金蝶 \`${t.api}\` → MES 面板 \`${t.panel}\``, '',
    `- 取样单号:**${d.bill_no}**(${d.bill_date}),分录 ${ents.length} 行`, '')

  // ── 表头 INSERT ──
  const hCols = [], hVals = []
  const hMap = []
  for (const [kd, col, only] of HEAD_MAP) {
    if (!applies(only, t.api)) continue
    if (col === '单据状态') continue // 本脚本自己写(把金蝶 C → 「已审核」,与 sync-core 同步口径一致)
    if (d[kd] === undefined) continue
    hCols.push(`[${col}]`); hVals.push(q(s(d[kd])))
    hMap.push([kd, col, s(d[kd])])
  }
  // 拉取进来的单据:金蝶侧已有 ⇒ 视为已转ERP(与同步口径一致),状态与指纹一并写
  hCols.push('[单据状态]'); hVals.push(q(d.bill_status === 'C' ? '已审核' : '草稿')); hMap.push(['bill_status', '单据状态', d.bill_status])
  hCols.push('[是否已转ERP]'); hVals.push(q('是')); hMap.push(['(派生)', '是否已转ERP', '是(单据来自金蝶)'])
  hCols.push('[ERP单号]'); hVals.push(q(s(d.bill_no))); hMap.push(['bill_no', 'ERP单号', s(d.bill_no)])
  hCols.push('[外部指纹]'); hVals.push(q(`SAMPLE|${s(d.bill_no)}|${s(d.modify_time)}`))
  hCols.push('[asp_user1]'); hVals.push(q('样例取样')); hMap.push(['(系统)', 'asp_user1', '样例取样'])
  hCols.push('[asp_time1]'); hVals.push('GETDATE()')
  hCols.push('[asp_cancel]'); hVals.push(q('N'))

  sql.push('', `-- ${t.label} 样例:表头 ${d.bill_no}`)
  sql.push(`DELETE FROM ${t.line} WHERE [单据编号] = ${q(s(d.bill_no))};`)
  sql.push(`DELETE FROM ${t.head} WHERE [单据编号] = ${q(s(d.bill_no))};`)
  sql.push(`INSERT INTO ${t.head} (${hCols.join(', ')}) VALUES (${hVals.join(', ')});`)

  // ── 明细 INSERT ──
  const lCols = ['[单据编号]']
  const lVals = [q(s(d.bill_no))]
  for (const [kd, col, only] of LINE_MAP) {
    if (applies(only, t.api) && !lCols.includes(`[${col}]`)) { lCols.push(`[${col}]`); lVals.push('@x') }
  }
  lCols.push('[asp_user1]'); lVals.push(q('样例取样'))
  lCols.push('[asp_time1]'); lVals.push('GETDATE()')
  lCols.push('[asp_cancel]'); lVals.push(q('N'))

  const lMap = []
  const rowSqls = []
  for (const e of ents) {
    // ⚠ 必须用 map 的**下标**取列名:早先写成 lVals.indexOf('@x') 会永远拿到第一个占位符,
    //   导致每一列都被填成第一列的值(2026-10-14 实测踩到,核对时表现为「所有明细列都=1」)
    const vals = lVals.map((v, i) => {
      if (v !== '@x') return v
      const col = lCols[i].replace(/[[\]]/g, '')
      const rule = LINE_MAP.find(([kd, c, only]) => c === col && applies(only, t.api))
      if (!rule) return 'NULL'
      const raw = s(e[rule[0]])
      if (!lMap.some((x) => x[0] === rule[0] && x[1] === col)) lMap.push([rule[0], col, raw])
      return /^\d+(\.\d+)?$/.test(raw) && ['实收数量', '数量', '辅助数量', '单价', '金额'].includes(col) ? raw : q(raw)
    })
    rowSqls.push(`INSERT INTO ${t.line} (${lCols.join(', ')}) VALUES (${vals.join(', ')});`)
  }
  sql.push(...rowSqls)

  // ── 对照表 ──
  md.push('### 表头对照', '', '| 金蝶键 | 金蝶值 | MES 物理列 |', '|---|---|---|')
  for (const [kd, col, val] of hMap) md.push(`| \`${kd}\` | ${String(val).slice(0, 60)} | \`${col}\` |`)
  md.push('', `### 分录对照(共 ${ents.length} 行,取首行)`, '', '| 金蝶键 | 金蝶值 | MES 物理列 |', '|---|---|---|')
  for (const [kd, col, val] of lMap) md.push(`| \`${kd}\` | ${String(val).slice(0, 60)} | \`${col}\` |`)
  md.push('', '> ⚠ MES 本地字段(无金蝶来源):产品入库单明细的 **检验方式**(全检/抽检)—— 金蝶保存接口对检验类键静默忽略,故取样时留空。', '')
  await sleep(300)
}

sql.push('', `SELECT '样例单据已写入' AS 结果, (SELECT COUNT(*) FROM bd_finish_in WHERE asp_user1=N'样例取样') AS 产品入库,`,
  `  (SELECT COUNT(*) FROM bd_other_in WHERE asp_user1=N'样例取样') AS 其他入库,`,
  `  (SELECT COUNT(*) FROM bd_other_out WHERE asp_user1=N'样例取样') AS 其他出库;`)

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/kingdee-samples-1014.json', import.meta.url), JSON.stringify(out, null, 1), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-samples-1014.md', import.meta.url), md.join('\n'), 'utf8')
writeFileSync(new URL('./_dump-out/kingdee-samples-1014.sql', import.meta.url), sql.join('\n'), 'utf8')
console.log('取样完成:')
for (const t of TYPES) {
  const sm = out.samples[t.api]
  console.log(`  ${t.label.padEnd(6)} ${t.api.padEnd(14)} 取样=${sm.bill_no}  分录=${sm.entries.length} 行`)
}
console.log('\n[产物] tools/archive/_dump-out/kingdee-samples-1014.{json,md,sql}')
