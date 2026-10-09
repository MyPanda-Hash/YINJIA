SET NOCOUNT ON;
SELECT DB_NAME() AS 库, N'bs_wh_loc 列数(应 38)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
UNION ALL SELECT DB_NAME(), N'厂区/库区 列残留(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc') AND name IN (N'厂区',N'库区')
UNION ALL SELECT DB_NAME(), N'WHLOC 字段(应 12)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC'
UNION ALL SELECT DB_NAME(), N'存储分区 字段(应 1)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND col_name=N'存储分区'
UNION ALL SELECT DB_NAME(), N'元数据漂移(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field f WHERE f.panel_code=N'WHLOC' AND COL_LENGTH('dbo.bs_wh_loc',f.col_name) IS NULL
UNION ALL SELECT DB_NAME(), N'有效仓位(应 679)', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT DB_NAME(), N'存储分区非空(应 259)', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE 存储分区 IS NOT NULL;
GO