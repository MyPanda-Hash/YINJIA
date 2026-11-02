SET NOCOUNT ON;
DECLARE @c TABLE(id int);
INSERT @c SELECT p.id FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
SELECT COUNT(*) 已结案行,
       SUM(CASE WHEN ISNULL(p.[批次号],N'')=CONVERT(varchar(8),DATEADD(day,3,CAST(p.pl_date AS date)),112) THEN 1 ELSE 0 END) 批次号符合,
       SUM(CASE WHEN CAST(p.asp_time1 AS date)=CAST(p.pl_date AS date) THEN 1 ELSE 0 END) 转单日期符合,
       SUM(CASE WHEN ISNULL(p.[批次号],N'')=N'20261014' THEN 1 ELSE 0 END) 仍旧批次号
FROM dbo.plang p JOIN @c c ON c.id=p.id;
SELECT ISNULL([批次号],N'') 批次号, COUNT(*) n FROM dbo.plang WHERE id NOT IN (SELECT id FROM @c) AND ISNULL([批次号],N'')=N'20261014' GROUP BY [批次号];
SELECT COUNT(*) 未结案旧批号 FROM dbo.plang WHERE id NOT IN (SELECT id FROM @c) AND ISNULL([批次号],N'')=N'20261014';
GO
