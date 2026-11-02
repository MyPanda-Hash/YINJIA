SET NOCOUNT ON;
SELECT COUNT(*) AS 已完工行,
       SUM(CASE WHEN ISNULL([批次号],N'') = CONVERT(varchar(8), DATEADD(day,3,pl_date), 112) THEN 1 ELSE 0 END) AS 批次号已符合,
       MIN(CONVERT(varchar(10),pl_date,120)) AS 最早, MAX(CONVERT(varchar(10),pl_date,120)) AS 最晚
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT TOP 3 pl_no, pl_xc, ISNULL([批次号],N'') 批次号, CONVERT(varchar(10),pl_date,120) 单据日期, CONVERT(varchar(10),asp_time1,120) 转单日期
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
