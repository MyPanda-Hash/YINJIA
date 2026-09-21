SET NOCOUNT ON;
PRINT N'=== C5:检验基础库行数 ===';
SELECT 'bs_qc_item' AS 表名, COUNT(*) AS 行数 FROM bs_qc_item
UNION ALL SELECT 'bs_qc_plan', COUNT(*) FROM bs_qc_plan;
GO
PRINT N'=== C5:检验项目表列结构 ===';
SELECT c.column_id, c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('bs_qc_item') ORDER BY c.column_id;
GO
PRINT N'=== C5:检验方案表列结构 ===';
SELECT c.column_id, c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('bs_qc_plan') ORDER BY c.column_id;
GO
PRINT N'=== C5:全库列名含 大类/贴装/带装/检验模板/检验频率/单箱 ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE c.name LIKE N'%大类%' OR c.name LIKE N'%贴装%' OR c.name LIKE N'%带装%'
   OR c.name LIKE N'%检验模板%' OR c.name LIKE N'%检验频率%' OR c.name LIKE N'%单箱%';
GO
PRINT N'=== C5:标准库表与条目数 ===';
SELECT TOP 30 t.name AS 表名, SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE N'%std%' GROUP BY t.name;
GO
PRINT N'=== C7:检验单总结论/处置方式字典 ===';
SELECT panel_code, col_name, label, data_type, dict_sql, place, editable, visible
FROM yj_field WHERE panel_code='QC_INSP' AND (col_name LIKE N'%结论%' OR col_name LIKE N'%处置%'
   OR col_name LIKE N'%结果%' OR col_name LIKE N'%数量%' OR col_name LIKE N'%批次%' OR col_name LIKE N'%暂收%'
   OR col_name LIKE N'%单价%' OR col_name LIKE N'%方案%' OR col_name LIKE N'%标准%' OR col_name LIKE N'%检验员%')
ORDER BY place, seq;
GO
PRINT N'=== C6:检验单「暂收单号」填充率 ===';
SELECT COUNT(*) AS 检验单数,
       SUM(CASE WHEN ISNULL(暂收单号,'')='' THEN 1 ELSE 0 END) AS 暂收单号为空
FROM qc_insp;
GO
PRINT N'=== C6:暂收单/检验单 行 批次号 填充 ===';
SELECT 'sl_recv_detail' AS 表名, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(批次号,'')='' THEN 1 ELSE 0 END) AS 批次号为空 FROM sl_recv_detail
UNION ALL SELECT 'qc_insp_detail', COUNT(*), SUM(CASE WHEN ISNULL(批次号,'')='' THEN 1 ELSE 0 END) FROM qc_insp_detail;
GO
