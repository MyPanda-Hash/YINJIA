SET NOCOUNT ON;
PRINT N'=== WHLOC 全部字段行(id 升序,不截断) ===';
SELECT id, seq, label AS 标签, col_name AS 物理列, data_type AS 类型, place, visible, hidden, editable, width
FROM yj_field WHERE panel_code = N'WHLOC' ORDER BY id;
GO
PRINT N'=== 有没有 厂区 字段(任一面板) —— 看是否被 area-a-raw 重插 ===';
SELECT panel_code AS 面板, id, seq, label AS 标签, col_name AS 物理列, data_type AS 类型
FROM yj_field WHERE col_name = N'厂区' OR label = N'厂区' ORDER BY panel_code, id;
GO
PRINT N'=== bs_wh_loc 里 厂区 物理列(应 NULL=已删) ===';
SELECT CAST(COL_LENGTH('dbo.bs_wh_loc', N'厂区') AS nvarchar(10)) AS 厂区列字节;
GO
PRINT N'=== WHLOC 内部重复统计(按 col_name+label) ===';
SELECT col_name AS 物理列, label AS 标签, COUNT(*) AS 行数, STRING_AGG(CAST(id AS nvarchar(10)), N',') AS id们
FROM yj_field WHERE panel_code = N'WHLOC' GROUP BY col_name, label HAVING COUNT(*) > 1;
GO
