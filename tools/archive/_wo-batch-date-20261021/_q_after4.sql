SET NOCOUNT ON;
DECLARE @c TABLE(id int,pl_no nvarchar(56),pl_xc int);
INSERT @c SELECT p.id,p.pl_no,ISNULL(p.pl_xc,0) FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
SELECT N'已结案工单仍有旧批号的报工行' k, COUNT(*) n FROM dbo.scjl s JOIN @c c ON c.pl_no=s.gldh AND c.pl_xc=ISNULL(s.[工单行号],0)
 WHERE ISNULL(s.[批次号],N'')=N'20261014'
UNION ALL SELECT N'未结案工单的旧批号报工行', COUNT(*) FROM dbo.scjl s
 WHERE ISNULL(s.[批次号],N'')=N'20261014' AND NOT EXISTS (SELECT 1 FROM @c c WHERE c.pl_no=s.gldh AND c.pl_xc=ISNULL(s.[工单行号],0))
UNION ALL SELECT N'已结案工单仍有旧批号的排产行', COUNT(*) FROM dbo.plang_pc pc JOIN @c c ON c.id=pc.plang_id WHERE ISNULL(pc.[批次号],N'')=N'20261014'
UNION ALL SELECT N'未结案工单的旧批号排产行', COUNT(*) FROM dbo.plang_pc pc WHERE ISNULL(pc.[批次号],N'')=N'20261014' AND ISNULL(pc.plang_id,0) NOT IN (SELECT id FROM @c);
SELECT TOP 10 c.pl_no, c.pl_xc, ISNULL(p.[完工状态],N'') 完工状态, ISNULL(p.ja,N'') ja, p.pl_sl, p.rk_sl, ISNULL(p.[批次号],N'') 批次号
FROM dbo.scjl s JOIN dbo.plang p ON p.pl_no=s.gldh AND ISNULL(p.pl_xc,0)=ISNULL(s.[工单行号],0)
JOIN @c c ON c.id=p.id
WHERE ISNULL(s.[批次号],N'')=N'20261014';
GO
