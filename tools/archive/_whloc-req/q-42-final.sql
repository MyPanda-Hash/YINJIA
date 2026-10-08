SET NOCOUNT ON;
SELECT N'大区 data_type' AS 项, data_type AS 值 FROM yj_field WHERE panel_code=N'WHLOC' AND label=N'大区'
UNION ALL SELECT N'存储分区 data_type', data_type FROM yj_field WHERE panel_code=N'WHLOC' AND label=N'存储分区'
UNION ALL SELECT N'WHLOC 下拉框字段数(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code=N'WHLOC' AND data_type=N'下拉框'
UNION ALL SELECT N'zone-dict 链记录(应 0)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_schema_log WHERE script_name LIKE N'%zone-dict%'
UNION ALL SELECT N'仓位总数(应 679)', CAST(COUNT(*) AS nvarchar(10)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'bs_wh_loc 列数(应 38)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
UNION ALL SELECT N'bs_wh 列数(应 53)', CAST(COUNT(*) AS nvarchar(10)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh');
GO