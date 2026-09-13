// gen-doc-panels.cjs — light-mes 单据/报表 → YINJIA(头表 bd_* / 行表 bl_* / 视图 v_*)
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(__dirname, 'doc-panels-export.tsv'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const qi = (s) => '[' + String(s).replace(/]/g, ']]') + ']'

const DOC_PREFIX = { PURCHASE_IN: 'PI', FINISH_IN: 'FI', OTHER_IN: 'OI', SALE_OUT: 'SO', MATERIAL_OUT: 'ML', OTHER_OUT: 'OO', PU_REQ: 'PR', PU_ORDER: 'PO', MANU_ORDER: 'MO', DISPATCH: 'DP', OUTSOURCE_ORDER: 'WO', OUTSOURCE_IN: 'WI', OUTSOURCE_ISSUE: 'WS' }
const MODULE = { PURCHASE_IN: '库存核算', FINISH_IN: '库存核算', OTHER_IN: '库存核算', SALE_OUT: '库存核算', MATERIAL_OUT: '库存核算', OTHER_OUT: '库存核算', PU_REQ: '采购管理', PU_ORDER: '采购管理', MANU_ORDER: '生产制造', DISPATCH: '生产制造', OUTSOURCE_ORDER: '委外加工', OUTSOURCE_IN: '委外加工', OUTSOURCE_ISSUE: '委外加工' }
const TYPE_MAP = { '文本': 'nvarchar(200)', '小数': 'decimal(18,4)', '整数': 'int', '日期': 'date', '是否': 'bit', '下拉框': 'nvarchar(100)', '参照': 'nvarchar(200)', '': 'nvarchar(200)' }
const DTYPE = { '文本': '文本', '小数': '小数', '整数': '整数', '日期': '日期', '是否': '是否', '下拉框': '下拉框', '参照': '参照', '': '文本' }
const NUM = new Set(['小数', '整数'])

const panels = []
for (const line of lines) {
  const parts = line.split('\t')
  const [code, name, category, cfgRaw] = [parts[0], parts[1], parts[2], parts.slice(3).join('\t')]
  const cfg = JSON.parse(cfgRaw)
  panels.push({ code, name, category, cfg })
}

let tables = ['-- 单据(头 bd_* / 行 bl_*)与报表视图(v_*)生成', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
let meta = ['\n-- 元数据注册', '']
const metaOut = []   // 供数据迁移/翻译复用

for (const p of panels) {
  const cfg = p.cfg
  const schemaFields = (cfg.dataSchema && cfg.dataSchema.fields) || []
  const tab0 = ((cfg.detail && cfg.detail.tabs) || [])[0]
  const tabFields = (tab0 && tab0.fields) || []
  const tp = (cfg.metadata && cfg.metadata.panelPageDto && cfg.metadata.panelPageDto.tablePages && cfg.metadata.panelPageDto.tablePages[0]) || {}
  const queryFields = tp.queryFields || []
  const qNames = new Set(queryFields.map((f) => f.dataName))
  const isDoc = Object.prototype.hasOwnProperty.call(DOC_PREFIX, p.code)
  const report = cfg.metadata && cfg.metadata.report === true

  if (isDoc) {
    // ===== 单据:头+行两表 =====
    const headT = `bd_${p.code.toLowerCase()}`, lineT = `bl_${p.code.toLowerCase()}`
    const hFields = schemaFields.filter((f) => f.dataName && f.dataName !== '单据状态')
    const lFields = tabFields.filter((f) => f.dataName)
    const noCol = (hFields.find((f) => /编号/.test(f.dataName)) || hFields[0] || {}).dataName || '单据编号'
    tables.push(`\n-- ===== ${p.code} ${p.name}(头 ${headT} / 行 ${lineT})===== `)
    tables.push(`IF OBJECT_ID('${headT}') IS NULL CREATE TABLE ${headT} (\n  id int IDENTITY(1,1) PRIMARY KEY,\n`)
    for (const f of hFields) tables.push(`  ${qi(f.dataName)} ${TYPE_MAP[f.dataType] || TYPE_MAP['']}${f.isRequired ? ' NOT NULL' : ' NULL'},\n`)
    if (!hFields.some((f) => f.dataName === '备注')) tables.push(`  ${qi('备注')} nvarchar(500) NULL,\n`)
    tables.push(`  ${qi('单据状态')} nvarchar(10) NOT NULL DEFAULT N'草稿', ${qi('审核人')} nvarchar(50) NULL, ${qi('审核时间')} datetime2 NULL, ${qi('审批人')} nvarchar(50) NULL, ${qi('审批时间')} datetime2 NULL,\n  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'\n);\nGO\n`)
    tables.push(`IF OBJECT_ID('${lineT}') IS NULL CREATE TABLE ${lineT} (\n  id int IDENTITY(1,1) PRIMARY KEY,\n  ${qi(noCol)} nvarchar(100) NOT NULL,\n`)
    for (const f of lFields.filter((f) => f.dataName !== noCol)) tables.push(`  ${qi(f.dataName)} ${TYPE_MAP[f.dataType] || TYPE_MAP['']}${f.isRequired ? ' NOT NULL' : ' NULL'},\n`)
    if (!lFields.some((f) => f.dataName === '备注')) tables.push(`  ${qi('备注')} nvarchar(500) NULL,\n`)
    tables.push(`  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL\n);\nGO\n`)
    // yj_panel(doc)
    meta.push(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='${p.code}') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('${p.code}', N'${p.name}', N'${MODULE[p.code]}', 'doc', '${lineT}', '${headT}', ${q(noCol)}, 'id', ${q(noCol)}, '${DOC_PREFIX[p.code]}', ${q('单据日期')}, 50, '${(tab0 && tab0.key) || 'items'}', N'${MODULE[p.code]}');\n`)
    // yj_field
    let seq = 0
    for (const f of [...hFields, { dataName: '备注', dataType: '文本' }]) {
      seq += 10
      const place = qNames.has(f.dataName) ? 'query,header' : 'header'
      meta.push(fld(p.code, f, place, seq))
    }
    seq = 0
    for (const f of lFields) { seq += 10; meta.push(fld(p.code, f, 'detail', seq)) }
    metaOut.push({ code: p.code, kind: 'doc', headT, lineT, noCol, tabKey: (tab0 && tab0.key) || 'items', hFields: hFields.map((f) => ({ name: f.dataName, type: DTYPE[f.dataType] || '文本' })), lFields: lFields.map((f) => ({ name: f.dataName, type: DTYPE[f.dataType] || '文本' })) })
  } else if (report) {
    // ===== 报表:flat 面板 + 视图 =====
    const src = p.code.replace(/_(DETAIL|STATS)$/, '')
    const kind = p.code.endsWith('_DETAIL') ? 'DETAIL' : 'STATS'
    const view = `v_${p.code.toLowerCase()}`
    const srcPanel = metaOut.find((m) => m.code === src)
    const columns = (((tp.gridTabs || [])[0] || {}).columns) || []
    if (!srcPanel) { console.log(`!! 报表 ${p.code} 的源单据 ${src} 未在本批,跳过视图`); continue }
    tables.push(`\n-- ===== 报表 ${p.code} ${p.name}(视图 ${view})===== `)
    const hSet = new Map(srcPanel.hFields.map((f) => [f.name, f]))
    const lSet = new Map(srcPanel.lFields.map((f) => [f.name, f]))
    if (kind === 'DETAIL') {
      const cols = columns.map((c) => hSet.has(c) ? `h.${qi(c)}` : (lSet.has(c) ? `l.${qi(c)}` : `NULL AS ${qi(c)}`))
      tables.push(`EXEC('CREATE OR ALTER VIEW ${view} AS SELECT ${cols.map((c) => c.replace(/'/g, "''")).join(', ')} FROM ${srcPanel.headT} h LEFT JOIN ${srcPanel.lineT} l ON h.${qi(srcPanel.noCol)} = l.${qi(srcPanel.noCol)};');\n`)
    } else {
      // STATS:按 仓库/供应商/存货/日期 分组,数值列 SUM,其余取首值;输出报表 columns
      let groupBy = ['仓库', '供应商', '存货编码', '材料编码', '单据日期'].filter((c) => hSet.has(c) || lSet.has(c))
      if (!groupBy.length) {
        // 无标准分组键:退用报表首个实际存在的列分组;仍无则平铺(退化为明细)
        const first = columns.find((c) => hSet.has(c) || lSet.has(c))
        if (first) groupBy = [first]
      }
      const gbCols = groupBy.map((c) => hSet.has(c) ? `h.${qi(c)}` : `l.${qi(c)}`)
      const sel = columns.map((c) => {
        const def = hSet.get(c) || lSet.get(c)
        if (groupBy.includes(c)) return (hSet.has(c) ? `h.${qi(c)}` : `l.${qi(c)}`)
        if (def && NUM.has(def.type)) return `SUM(COALESCE(${hSet.has(c) ? 'h' : 'l'}.${qi(c)}, 0)) AS ${qi(c)}`
        if (hSet.has(c)) return `MAX(h.${qi(c)}) AS ${qi(c)}`
        if (lSet.has(c)) return `MAX(l.${qi(c)}) AS ${qi(c)}`
        return `NULL AS ${qi(c)}`
      })
      const srcJoin = `FROM ${srcPanel.headT} h LEFT JOIN ${srcPanel.lineT} l ON h.${qi(srcPanel.noCol)} = l.${qi(srcPanel.noCol)}`
      // GROUP BY 键若不在 columns 里则补选(避免重复列名)
      const extra = gbCols.filter((c) => !columns.includes(c.replace(/^h\.|^l\./, '').replace(/[[\]]/g, '')))
      const groupTail = gbCols.length ? ` GROUP BY ${gbCols.map((c) => c.replace(/'/g, "''")).join(', ')}` : ''
      tables.push(`EXEC('CREATE OR ALTER VIEW ${view} AS SELECT ${sel.map((s) => s.replace(/'/g, "''")).join(', ')}${extra.length ? ', ' + extra.map((c) => c.replace(/'/g, "''")).join(', ') : ''} ${srcJoin.replace(/'/g, "''")}${groupTail};');\n`)
    }
    meta.push(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='${p.code}') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('${p.code}', N'${p.name}', N'${MODULE[src] || '库存核算'}', 'flat', '${view}', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'${MODULE[src] || '库存核算'}');\n`)
    // 报表字段定义:从 columns 推(类型沿用源字段,缺省文本)
    let seq = 0
    for (const c of columns) {
      seq += 10
      const def = hSet.get(c) || lSet.get(c)
      const type = def ? def.type : '文本'
      const place = qNames.has(c) ? 'query,detail' : 'detail'
      meta.push(fld(p.code, { dataName: c, dataType: type, options: def && def.options, refPanel: def && def.refPanel, refField: def && def.refField, displayField: def && def.displayField }, place, seq))
    }
    metaOut.push({ code: p.code, kind: 'report', view })
  }
}
function fld(code, f, place, seq) {
  const options = Array.isArray(f.options) ? f.options : null
  const dict = options ? q(`SELECT v FROM (VALUES ${options.map((o) => `(${q(o)})`).join(',')}) AS t(v)`) : 'NULL'
  return `IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${code}' AND col_name=${q(f.dataName)}) INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('${code}', ${q(f.dataName)}, ${q(f.dataName)}, N'${DTYPE[f.dataType] || '文本'}', ${dict}, ${f.refPanel ? `'${f.refPanel}'` : 'NULL'}, ${f.refField ? q(f.refField) : 'NULL'}, ${f.displayField ? q(f.displayField) : 'NULL'}, N'${place}', ${seq}, ${NUM.has(DTYPE[f.dataType]) ? 110 : 140}, 1, ${f.isRequired ? 1 : 0}, 0, 1);\n`
}
fs.writeFileSync(path.join(__dirname, '_doc_part1_tables.sql'), tables.join('\n') + '\n', 'utf8')
fs.writeFileSync(path.join(__dirname, '_doc_part2_meta.sql'), meta.join('') + '\n', 'utf8')
fs.writeFileSync(path.join(__dirname, '_doc_panels.json'), JSON.stringify(metaOut), 'utf8')
const docCount = metaOut.filter((m) => m.kind === 'doc').length
const rptCount = metaOut.filter((m) => m.kind === 'report').length
console.log(`单据 ${docCount} 个,报表视图 ${rptCount} 个;字段词条待翻译数约 ${metaOut.filter((m) => m.kind === 'doc').reduce((s, m) => s + m.hFields.length + m.lFields.length, 0) + panels.filter((p) => p.cfg.metadata && p.cfg.metadata.report).reduce((s, p) => s + ((((p.cfg.metadata.panelPageDto.tablePages[0] || {}).gridTabs || [])[0] || {}).columns || []).length, 0)}`)
