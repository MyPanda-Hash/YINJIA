-- 探针:材料出库单(MATERIAL_OUT)现状全景 —— 结构/行数/面板字段/按钮
SET NOCOUNT ON;
PRINT '=== 1. bd_material_out 列 ===';
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS typ, c.max_length, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bd_material_out') ORDER BY c.column_id;
PRINT '=== 2. bl_material_out 列 ===';
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS typ, c.max_length, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_material_out') ORDER BY c.column_id;
PRINT '=== 3. 行数 ===';
SELECT (SELECT COUNT(*) FROM bd_material_out) AS 头表行数, (SELECT COUNT(*) FROM bl_material_out) AS 行表行数;
PRINT '=== 4. 面板 yj_field(MATERIAL_OUT) ===';
SELECT seq, col_name, label, data_type, place, editable, required, hidden, visible
FROM yj_field WHERE panel_code='MATERIAL_OUT' ORDER BY place, seq;
PRINT '=== 5. 面板按钮 ===';
SELECT button_name, action, place, seq FROM yj_button WHERE panel_code='MATERIAL_OUT' ORDER BY seq;
PRINT '=== 6. 面板定义 ===';
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col
FROM yj_panel WHERE panel_code='MATERIAL_OUT';
PRINT '=== 7. 转ERP 相关列是否存在 ===';
SELECT 'bd_material_out' AS tbl, name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out') AND name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间')
UNION ALL
SELECT 'bd_purchase_in', name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_purchase_in') AND name IN (N'是否已转ERP',N'ERP单号',N'转ERP操作人',N'转ERP时间');
PRINT '=== 8. 样本数据(头/行 各 3) ===';
SELECT TOP 3 * FROM bd_material_out;
SELECT TOP 3 * FROM bl_material_out;
GO
