SET NOCOUNT ON;
PRINT N'=== 表清单:链路/按钮/单据状态 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%link%' OR TABLE_NAME LIKE '%chain%' OR TABLE_NAME LIKE '%button%'
   OR TABLE_NAME LIKE '%occupy%' OR TABLE_NAME LIKE '%doc_status%' OR TABLE_NAME LIKE '%flow%'
ORDER BY TABLE_NAME;
GO
PRINT N'=== C9/C10:按钮配置表结构 ===';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME LIKE '%button%' ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
PRINT N'=== C4:送料暂收单(QC_RECV)字段:找 到货日期/送货日期/日期 ===';
SELECT panel_code, col_name, label, place, data_type, editable, required, hidden, visible
FROM yj_field WHERE panel_code = 'QC_RECV' ORDER BY place, seq;
GO
PRINT N'=== 三单物理列:批次号/批号/来源单号/到货日期 ===';
SELECT t.name AS 表名, c.name AS 列名
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE N'%批次%' OR c.name LIKE N'%批号%' OR c.name LIKE N'%来源单%'
   OR c.name LIKE N'%到货%' OR c.name LIKE N'%送货%' OR c.name LIKE N'%暂收单%' OR c.name LIKE N'%特采%'
ORDER BY t.name;
GO
