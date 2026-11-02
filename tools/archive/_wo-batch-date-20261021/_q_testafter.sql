SET NOCOUNT ON;
SELECT COUNT(*) AS 已完工, SUM(CASE WHEN ISNULL([批次号],N'')=N'20261014' THEN 1 ELSE 0 END) AS 旧批号
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
