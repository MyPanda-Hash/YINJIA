SET NOCOUNT ON;
SELECT label AS 字段, data_type AS 类型, LEN(dict_sql) AS 字典长度, seq, place, visible, hidden, editable
FROM yj_field WHERE panel_code=N'WHLOC' AND label IN (N'大区',N'存储分区');
SELECT N'bs_wh_loc 列数(应仍是 38)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc')
UNION ALL SELECT N'bs_wh 列数(应仍是 53)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh')
UNION ALL SELECT N'新增表数(应 0)', CAST(COUNT(*) AS nvarchar(6)) FROM sys.tables WHERE create_date >= '2026-10-08' AND name LIKE N'%wh%';
GO