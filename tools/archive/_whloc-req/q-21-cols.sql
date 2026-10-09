SET NOCOUNT ON;
SELECT N'bs_wh 列数' AS 项, COUNT(*) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh')
UNION ALL SELECT N'bs_wh_loc 列数', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc');
GO