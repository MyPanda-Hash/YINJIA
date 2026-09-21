SET NOCOUNT ON;
PRINT N'=== C1:全库含 库位/货位/仓位 的物理列 ===';
SELECT t.name AS 表名, c.name AS 列名
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE N'%库位%' OR c.name LIKE N'%货位%' OR c.name LIKE N'%仓位%'
ORDER BY t.name, c.column_id;
GO
PRINT N'=== C1:yj_field 含 库位/仓位 ===';
SELECT panel_code, col_name, label, place, editable, hidden, visible, data_type
FROM yj_field
WHERE col_name LIKE N'%库位%' OR label LIKE N'%库位%' OR col_name LIKE N'%仓位%' OR label LIKE N'%仓位%'
ORDER BY panel_code, seq;
GO
PRINT N'=== C1:采购入库单面板字段(含仓库/库位) ===';
SELECT f.panel_code, f.col_name, f.label, f.place, f.editable, f.required, f.hidden, f.visible, f.ref_panel
FROM yj_field f
WHERE f.panel_code IN (SELECT panel_code FROM yj_panel WHERE panel_name LIKE N'%采购入库%')
  AND (f.col_name LIKE N'%仓%' OR f.col_name LIKE N'%库%')
ORDER BY f.panel_code, f.seq;
GO
