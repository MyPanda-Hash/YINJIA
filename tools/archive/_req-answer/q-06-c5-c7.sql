SET NOCOUNT ON;
PRINT N'=== C5:检验基础库表清单与行数 ===';
SELECT t.name AS 表名, SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE N'%insp%' OR t.name LIKE N'%qc%' OR t.name LIKE N'%check%' OR t.name LIKE N'%std%'
   OR t.name LIKE N'%template%' OR t.name LIKE N'%tpl%'
GROUP BY t.name ORDER BY t.name;
GO
PRINT N'=== C5:检验项目/方案表列结构 ===';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME LIKE N'%insp_item%' OR TABLE_NAME LIKE N'%insp_scheme%' OR TABLE_NAME LIKE N'%qc_item%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT N'=== C5:全库对象名含 来料检验模板 / 大类 / 贴装 / 带装 ===';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE N'%大类%' OR COLUMN_NAME LIKE N'%贴装%' OR COLUMN_NAME LIKE N'%带装%'
   OR COLUMN_NAME LIKE N'%检验模板%' OR COLUMN_NAME LIKE N'%检验频率%';
GO
PRINT N'=== C7:检验单面板字典(总结论/处置方式/检验结果) ===';
SELECT panel_code, col_name, label, data_type, dict_sql, place, editable, visible
FROM yj_field
WHERE col_name LIKE N'%总结论%' OR col_name LIKE N'%结论%' OR col_name LIKE N'%处置%'
   OR col_name LIKE N'%检验结果%' OR col_name LIKE N'%特采%' OR col_name LIKE N'%结果%'
ORDER BY panel_code, seq;
GO
PRINT N'=== C7:来料检验单面板字段全量 ===';
SELECT f.panel_code, f.col_name, f.label, f.place, f.editable, f.required, f.hidden, f.visible, f.ref_panel
FROM yj_field f WHERE f.panel_code IN (SELECT panel_code FROM yj_panel WHERE panel_name LIKE N'%来料检验%')
ORDER BY f.panel_code, f.place, f.seq;
GO
