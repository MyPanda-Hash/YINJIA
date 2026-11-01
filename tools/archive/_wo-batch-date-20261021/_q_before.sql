SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL([批次号],N'')=N'20261014') AS 旧批次号行,
       (SELECT COUNT(*) FROM dbo.plang WHERE CONVERT(date,asp_time1)='2026-10-14' AND ISNULL(ja,'N') IN ('T','Y') AND ISNULL([完工状态],N'')=N'生产完工') AS 转单日期仍10_14,
       (SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL([批次号],N'')=N'20261014') AS 报工旧批号;
GO
