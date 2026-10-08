SET NOCOUNT ON;
SELECT N'有效仓位数(应 679)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'bs_wh_loc 列数(应 38)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
UNION ALL SELECT N'bs_wh 列数(应 53)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh')
UNION ALL SELECT N'本次新建的表(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.tables WHERE create_date >= '2026-10-08 22:00'
UNION ALL SELECT N'大区/存储分区 类型', STRING_AGG(CAST(data_type AS nvarchar(20)), N'/') FROM yj_field WHERE panel_code=N'WHLOC' AND label IN (N'大区',N'存储分区');
GO