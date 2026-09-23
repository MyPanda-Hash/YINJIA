SET NOCOUNT ON;
PRINT N'=== 补齐 rd_* 尾部表(上一查询被 50 行截断) ===';
SELECT t.name AS tbl, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS cols, CAST(p.rows AS INT) AS rows_approx
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name >= 'rd_ro_protect' AND t.name LIKE 'rd%' ORDER BY t.name;
GO
PRINT N'=== rd_spec_assign 列 ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_spec_assign' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== rd_spec_assign 行数 ===';
SELECT COUNT(*) FROM rd_spec_assign;
GO
PRINT N'=== rd_spec_doc 表(第三张规格书表)列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_spec_doc' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== yj_panel 中所有 mode/panel 计数(总览) ===';
SELECT COUNT(*) AS panels FROM yj_panel;
GO
SELECT COUNT(*) AS fields FROM yj_field;
GO
SELECT COUNT(*) AS translations FROM yj_translation;
