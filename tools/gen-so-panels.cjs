// gen-so-panels.cjs — 销售订单(SO_ORDER)迁移 + 明细/统计报表
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join(__dirname, 'so-panels-export.tsv'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const TYPE_MAP = { '文本': 'nvarchar(200)', '小数': 'decimal(18,4)', '整数': 'int', '日期': 'date', '是否': 'bit', '下拉框': 'nvarchar(100)', '参照': 'nvarchar(200)', '': 'nvarchar(200)' }
const DTYPE = { '文本': '文本', '小数': '小数', '整数': '整数', '日期': '日期', '是否': '是否', '下拉框': '下拉框', '参照': '参照', '': '文本' }

const panels = []
for (const line of lines) {
  const [code, name, cat, cfgRaw] = line.split('\t')
  const cfg = JSON.parse(cfgRaw)
  panels.push({ code, name, cat, cfg })
}

let out = ['-- 销售订单迁移(SO_ORDER + 明细/统计报表)', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
const p = panels.find((x) => x.code === 'SO_ORDER')
if (!p) { console.log('SO_ORDER not found'); process.exit(1) }
const cfg = p.cfg
const schemaFields = (cfg.dataSchema && cfg.dataSchema.fields) || []
const tab0 = ((cfg.detail && cfg.detail.tabs) || [])[0]
const tabFields = (tab0 && tab0.fields) || []
const hFields = schemaFields.filter((f) => f.dataName && f.dataName !== '单据状态')
const lFields = tabFields.filter((f) => f.dataName)
const noCol = (hFields.find((f) => /编号/.test(f.dataName)) || hFields[0] || {}).dataName || '单据编号'
const headT = 'bd_so_order', lineT = 'bl_so_order'

// 1. 建表
out.push(`IF OBJECT_ID('${headT}') IS NULL CREATE TABLE ${headT} (\n  id int IDENTITY(1,1) PRIMARY KEY,\n`)
for (const f of hFields) out.push(`  [${f.dataName}] ${TYPE_MAP[f.dataType] || TYPE_MAP['']} NULL,\n`)
if (!hFields.some((f) => f.dataName === '备注')) out.push(`  [备注] nvarchar(500) NULL,\n`)
out.push(`  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,\n  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'\n);`)
out.push(`\nIF OBJECT_ID('${lineT}') IS NULL CREATE TABLE ${lineT} (\n  id int IDENTITY(1,1) PRIMARY KEY,\n  [${noCol}] nvarchar(100) NULL,\n`)
for (const f of lFields.filter((f) => f.dataName !== noCol)) out.push(`  [${f.dataName}] ${TYPE_MAP[f.dataType] || TYPE_MAP['']} NULL,\n`)
out.push(`  asp_user1 nvarchar(50) NULL\n);`)

// 2. yj_panel
out.push(`\nIF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SO_ORDER') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SO_ORDER', N'${p.name}', N'智能供应链', 'doc', '${lineT}', '${headT}', ${q(noCol)}, 'id', ${q(noCol)}, 'SO', ${q('单据日期')}, 50, '${(tab0 && tab0.key) || 'items'}', N'智能供应链');`)

// 3. yj_field
const tp = (cfg.metadata && cfg.metadata.panelPageDto && cfg.metadata.panelPageDto.tablePages && cfg.metadata.panelPageDto.tablePages[0]) || {}
const qNames = new Set(((tp.queryFields) || []).map((f) => f.dataName))
let seq = 0
for (const f of hFields) {
  seq += 10
  const place = qNames.has(f.dataName) ? 'query,header' : 'header'
  out.push(fld('SO_ORDER', f, place, seq))
}
if (!hFields.some((f) => f.dataName === '备注')) out.push(fld('SO_ORDER', { dataName: '备注', dataType: '文本' }, 'header', seq + 10))
seq = 0
for (const f of lFields) { seq += 10; out.push(fld('SO_ORDER', f, 'detail', seq)) }

function fld(code, f, place, s) {
  const dict = Array.isArray(f.options) ? q(`SELECT v FROM (VALUES ${f.options.map((o) => `(${q(o)})`).join(',')}) AS t(v)`) : 'NULL'
  return `IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${code}' AND col_name=${q(f.dataName)}) INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('${code}', ${q(f.dataName)}, ${q(f.dataName)}, N'${DTYPE[f.dataType] || '文本'}', ${dict}, ${f.refPanel ? `'${f.refPanel}'` : 'NULL'}, ${f.refField ? q(f.refField) : 'NULL'}, ${f.displayField ? q(f.displayField) : 'NULL'}, N'${place}', ${s}, ${(DTYPE[f.dataType] === '小数' || DTYPE[f.dataType] === '整数') ? 110 : 140}, 1, ${f.isRequired ? 1 : 0}, 0, 1);`
}

// 4. 报表(明细 + 统计) — 直接建视图 + 面板
out.push('\n-- 明细表视图')
const hSet = new Set(hFields.map((f) => f.dataName))
const lSet = new Set(lFields.map((f) => f.dataName))
const detailCols = [...hFields.map((f) => `h.[${f.dataName}]`), ...lFields.filter((f) => f.dataName !== noCol).map((f) => `l.[${f.dataName}]`)]
out.push(`EXEC('CREATE VIEW v_sales_order_detail AS SELECT h.*, l.[${noCol}] AS line_no` + lFields.filter((f) => f.dataName !== noCol).map((f) => `, l.[${f.dataName}]`).join('') + ` FROM ${headT} h LEFT JOIN ${lineT} l ON h.[${noCol}]=l.[${noCol}]');`)
out.push(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SALES_ORDER_DETAIL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SALES_ORDER_DETAIL', N'销售订单明细表', N'智能供应链', 'flat', 'v_sales_order_detail', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'智能供应链');`)

out.push('\n-- 统计表视图')
out.push(`EXEC('CREATE VIEW v_sales_order_stats AS SELECT h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位], COUNT(DISTINCT h.[${noCol}]) AS [订单数], SUM(COALESCE(l.[数量],0)) AS [数量], SUM(COALESCE(l.[金额],0)) AS [金额] FROM ${headT} h LEFT JOIN ${lineT} l ON h.[${noCol}]=l.[${noCol}] GROUP BY h.[单据日期], h.asp_cancel, l.[存货名称], l.[规格型号], l.[计量单位]');`)
out.push(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SALES_ORDER_STATS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SALES_ORDER_STATS', N'销售订单统计表', N'智能供应链', 'flat', 'v_sales_order_stats', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'智能供应链');`)

// 5. 报表字段(从视图列自动发现)
out.push(`
DECLARE @n sysname, @i int;
DECLARE cc CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('v_sales_order_detail') AND c.name NOT IN ('id','asp_cancel') ORDER BY c.column_id;
SET @i = 0; OPEN cc; FETCH NEXT FROM cc INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_DETAIL' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALES_ORDER_DETAIL', @n, @n, N'文本', N'detail', @i, 130, 1, 0, 0, 1);
  FETCH NEXT FROM cc INTO @n; END
CLOSE cc; DEALLOCATE cc;
DECLARE cc2 CURSOR FOR SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('v_sales_order_stats') AND c.name NOT IN ('id') ORDER BY c.column_id;
SET @i = 0; OPEN cc2; FETCH NEXT FROM cc2 INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @i += 10;
  IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALES_ORDER_STATS' AND col_name=@n)
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SALES_ORDER_STATS', @n, @n, N'文本', N'detail', @i, 120, 1, 0, 0, 1);
  FETCH NEXT FROM cc2 INTO @n; END
CLOSE cc2; DEALLOCATE cc2;
`)

fs.writeFileSync(path.join(__dirname, '_so_part1.sql'), out.join('\n') + '\n', 'utf8')
fs.writeFileSync(path.join(__dirname, '_so_meta.json'), JSON.stringify({ code: 'SO_ORDER', headT, lineT, noCol, tabKey: (tab0 && tab0.key) || 'items', hFields: hFields.map((f) => ({ name: f.dataName, type: DTYPE[f.dataType] || '文本' })), lFields: lFields.map((f) => ({ name: f.dataName, type: DTYPE[f.dataType] || '文本' })) }), 'utf8')
console.log(`SO_ORDER: 头 ${hFields.length} 字段, 行 ${lFields.length} 字段, 报表 2 个`)
