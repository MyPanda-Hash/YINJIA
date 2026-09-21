SET NOCOUNT ON;
PRINT N'=== 来料性质 字段注册情况 ===';
SELECT panel_code, col_name, label, data_type, dict_sql, place, visible FROM yj_field WHERE col_name LIKE N'%来料性质%' OR label LIKE N'%来料性质%';
GO
PRINT N'=== 来料性质 物理列 ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id WHERE c.name LIKE N'%来料性质%';
GO
PRINT N'=== QC_RECV 头部字段(place=header) ===';
SELECT col_name, label, data_type, place, editable, hidden, visible, ref_panel FROM yj_field WHERE panel_code='QC_RECV' AND place LIKE N'%header%' ORDER BY seq;
GO
PRINT N'=== 批号 vs 批次号 注册情况 ===';
SELECT panel_code, col_name, label, place, visible FROM yj_field WHERE col_name IN (N'批号',N'批次号') ORDER BY panel_code, place;
GO
