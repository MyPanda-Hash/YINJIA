SET NOCOUNT ON;
SELECT N'大区/存储分区 data_type' AS 项, STRING_AGG(CAST(data_type AS nvarchar(20)), N'/') AS 值 FROM yj_field WHERE panel_code=N'WHLOC' AND label IN (N'大区',N'存储分区')
UNION ALL SELECT N'WHLOC 面板名', panel_name FROM yj_panel WHERE panel_code=N'WHLOC'
UNION ALL SELECT N'库位残留列(应 0)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE name LIKE N'%库位%'
UNION ALL SELECT N'仓位列(应 3)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE name LIKE N'%仓位%'
UNION ALL SELECT N'rename-back 链记录(应 0)', CAST(COUNT(*) AS nvarchar(6)) FROM yj_schema_log WHERE script_name LIKE N'%rename-back-loc%'
UNION ALL SELECT N'有效仓位数(应 679)', CAST(COUNT(*) AS nvarchar(6)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'bs_wh_loc 列数(应 38)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc');
GO