SET NOCOUNT ON;
SELECT N'厂区列是否存在' AS 项, ISNULL(CAST(COL_LENGTH('dbo.bs_wh_loc',N'厂区') AS nvarchar(10)),N'NULL(不存在)') AS 值
UNION ALL SELECT N'厂区 非空行数', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE 厂区 IS NOT NULL
UNION ALL SELECT N'厂区 总行数(该列可读时)', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc
UNION ALL SELECT N'WHLOC 的 厂区 字段行', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'厂区';
GO