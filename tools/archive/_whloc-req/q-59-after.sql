SET NOCOUNT ON;
SELECT DB_NAME() AS 库, N'WHLOC 字段行数' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM yj_field WHERE panel_code=N'WHLOC'
UNION ALL SELECT DB_NAME(), N'存储分区 行数(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'存储分区'
UNION ALL SELECT DB_NAME(), N'库区 残留(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'库区'
UNION ALL SELECT DB_NAME(), N'WHLOC.厂区 漂移(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'厂区'
UNION ALL SELECT DB_NAME(), N'重复组数(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM (SELECT col_name,label FROM yj_field WHERE panel_code=N'WHLOC' GROUP BY col_name,label HAVING COUNT(*)>1) t;
GO