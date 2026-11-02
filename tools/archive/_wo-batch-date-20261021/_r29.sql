SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, CONVERT(varchar(19),pl_date,120) 单据日期, ISNULL([完工状态],N'') 完工状态, ISNULL(ja,N'') ja,
       pl_sl, rk_sl, CONVERT(varchar(19),asp_time1,120) 转单时间, ISNULL(asp_cancel,'N') cancel
FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%' AND CAST(pl_date AS date) >= '2026-10-01';
GO
