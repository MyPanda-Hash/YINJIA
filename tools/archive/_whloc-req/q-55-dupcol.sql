SET NOCOUNT ON;
PRINT N'=== A. WHLOC 的全部 yj_field 登记行(按 seq) ===';
SELECT id, seq, label AS 标签, col_name AS 物理列, data_type AS 类型, place, visible, hidden, editable, width
FROM yj_field WHERE panel_code = N'WHLOC' ORDER BY seq, id;
GO

PRINT N'=== B. 同面板内 标签重复 / 物理列重复 的行 ===';
SELECT N'按 label 重复' AS 维度, label AS 键, COUNT(*) AS 行数, STRING_AGG(CAST(id AS nvarchar(10)), N',') AS id们
FROM yj_field WHERE panel_code = N'WHLOC' GROUP BY label HAVING COUNT(*) > 1
UNION ALL
SELECT N'按 col_name 重复', col_name, COUNT(*), STRING_AGG(CAST(id AS nvarchar(10)), N',')
FROM yj_field WHERE panel_code = N'WHLOC' GROUP BY col_name HAVING COUNT(*) > 1;
GO

PRINT N'=== C. 全库「完全重复的字段登记行」(体检 07 项那 6 处) ===';
SELECT panel_code AS 面板, label AS 标签, col_name AS 物理列, COUNT(*) AS 行数,
       STRING_AGG(CAST(id AS nvarchar(10)), N',') AS id们
FROM yj_field GROUP BY panel_code, label, col_name HAVING COUNT(*) > 1
ORDER BY panel_code, label;
GO
