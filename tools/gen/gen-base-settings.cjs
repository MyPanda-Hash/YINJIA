// gen-base-settings.cjs — light-mes 18 个基础设置面板 → YINJIA-MES SQL Server 落地脚本
// 产出: base-settings-migrate.sql(建表 + yj_panel/yj_field + 数据迁移)
// 规则: 全部按 archive(单单据)模式;字段全放 detail(带 query 的双 place);
//       col_name = 中文 dataName(列名=键,映射零歧义);表名 bs_<code 小写>;
//       QC_PLAN 明细 items 忽略(P1 主档);[状态] 恒 '启用' 保档案可编辑;留痕列齐全。
const fs = require('fs')
const path = require('path')

const rows = fs.readFileSync(path.join(__dirname, 'base-panels-export.jsonl'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  .map((l) => { const r = JSON.parse(l.replace(/^\uFEFF/, '')); return { code: r.panel_code, name: r.panel_name, cfg: typeof r.config === 'string' ? JSON.parse(r.config) : r.config } })

const TYPE_MAP = {
  '文本': ['文本', 'nvarchar(200)'], '小数': ['小数', 'decimal(18,4)'], '整数': ['整数', 'int'],
  '日期': ['日期', 'date'], '是否': ['是否', 'bit'], '下拉框': ['下拉框', 'nvarchar(100)'],
  '参照': ['参照', 'nvarchar(200)'], '': ['文本', 'nvarchar(200)'],
}
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const qi = (s) => '[' + String(s).replace(/]/g, ']]') + ']'

let sql = ['-- 基础设置模块迁移(light-mes → HSDZ_MES):18 面板 archive 模式',
  '-- 生成物:物理表 bs_* + yj_panel/yj_field + 现有数据;翻译词条由 gen-locales/dict 接口补齐',
  'USE HSDZ_MES;', 'SET NOCOUNT ON;', ''].join('\n')

const panelsMeta = []   // {code,name,table,fields,queryFields}
for (const p of rows) {
  const cfg = p.cfg
  const schemaFields = (cfg.dataSchema && cfg.dataSchema.fields) || []
  const tab0 = ((cfg.detail && cfg.detail.tabs) || [])[0]
  const tabFields = (tab0 && tab0.fields) || []
  const tp = (cfg.metadata && cfg.metadata.panelPageDto && cfg.metadata.panelPageDto.tablePages && cfg.metadata.panelPageDto.tablePages[0]) || {}
  const queryFields = tp.queryFields || []
  const qNames = new Set(queryFields.map((f) => f.dataName))
  // 字段合并:tab 型(单单据明细)或 schema 型(PARTNER/QC_ITEM);QC_PLAN 双结构取 schema
  const useTab = tabFields.length > 0 && !(schemaFields.length > 1)
  const src = useTab ? tabFields : schemaFields
  const table = `bs_${p.code.toLowerCase()}`
  const fields = src.filter((f) => f && f.dataName && f.dataName !== '备注').map((f) => ({
    name: f.dataName,
    type: (TYPE_MAP[f.dataType] || TYPE_MAP[''])[0],
    col: (TYPE_MAP[f.dataType] || TYPE_MAP[''])[1],
    required: !!f.isRequired,
    options: Array.isArray(f.options) ? f.options : null,
    refPanel: f.refPanel || null, refField: f.refField || null, displayField: f.displayField || null,
    query: qNames.has(f.dataName),
  }))
  const hasRemark = [...src, schemaFields[0]].some((f) => f && f.dataName === '备注')
  panelsMeta.push({ code: p.code, name: p.name, table, fields, hasRemark, tabKey: tab0 && tab0.key, useTab })

  // ---- 建表 ----
  sql += `\n-- ===== ${p.code} ${p.name} =====\nIF OBJECT_ID('${table}') IS NULL CREATE TABLE ${table} (\n  id int IDENTITY(1,1) PRIMARY KEY,\n`
  for (const f of fields) sql += `  ${qi(f.name)} ${f.col}${f.required ? ' NOT NULL' : ' NULL'},\n`
  if (hasRemark || true) sql += `  ${qi('备注')} nvarchar(500) NULL,\n`
  sql += `  ${qi('状态')} nvarchar(10) NOT NULL DEFAULT N'启用',\n  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'\n);\nGO\n`
}
fs.writeFileSync(path.join(__dirname, '_bs_part1_tables.sql'), sql.replace(/^\uFEFF/, ''), 'utf8')

// ---- yj_panel / yj_field / 数据 ----
let part2 = '\n-- ===== 元数据注册 =====\n'
for (const m of panelsMeta) {
  part2 += `IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = '${m.code}') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('${m.code}', N'${m.name}', N'基础设置', 'archive', '${m.table}', NULL, NULL, 'id', NULL, NULL, NULL, 100, '${m.tabKey || 'items'}', N'基础设置');\n`
}
part2 += '\n-- yj_field(place: d=detail, q=query,detail)\n'
let seq = 0
for (const m of panelsMeta) {
  seq = 0
  for (const f of m.fields) {
    seq += 10
    const place = f.query ? 'query,detail' : 'detail'
    const dict = f.options ? q(`SELECT v FROM (VALUES ${f.options.map((o) => `(${q(o)})`).join(',')}) AS t(v)`) : 'NULL'
    part2 += `IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${m.code}' AND col_name=${q(f.name)}) INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('${m.code}', ${q(f.name)}, ${q(f.name)}, N'${f.type}', ${dict}, ${f.refPanel ? `'${f.refPanel}'` : 'NULL'}, ${f.refField ? q(f.refField) : 'NULL'}, ${f.displayField ? q(f.displayField) : 'NULL'}, N'${place}', ${seq}, ${f.type === '小数' || f.type === '整数' ? 110 : 140}, 1, ${f.required ? 1 : 0}, 0, 1);\n`
  }
}
fs.writeFileSync(path.join(__dirname, '_bs_part2_meta.sql'), part2, 'utf8')
fs.writeFileSync(path.join(__dirname, '_bs_panels.json'), JSON.stringify(panelsMeta.map((m) => ({
  code: m.code, table: m.table, tabKey: m.tabKey, useTab: m.useTab,
  fields: m.fields.map((f) => ({ name: f.name, type: f.type })),
}))), 'utf8')
console.log(`表/元数据已生成:${panelsMeta.length} 面板,字段总数 ${panelsMeta.reduce((s, m) => s + m.fields.length, 0)}`)
console.log(panelsMeta.map((m) => `${m.code}(${m.fields.length}${m.useTab ? ',tab' : ',schema'})`).join(' '))
