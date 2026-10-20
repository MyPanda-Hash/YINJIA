SELECT p.pl_no, p.pl_xc, ISNULL(p.[完工状态],N'<null>') AS 完工状态,
       (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'
          AND (ISNULL(s.[工单行号],0)=p.pl_xc OR ISNULL(s.[工单行号],0)=0)) AS 报工笔数,
       (SELECT ISNULL(SUM(ISNULL(s.sl,0)),0) FROM dbo.scjl s WHERE s.gldh=p.pl_no
          AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
          AND (ISNULL(s.[工单行号],0)=p.pl_xc OR ISNULL(s.[工单行号],0)=0)) AS 已审报工量
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND ISNULL(p.[完工状态],N'') NOT IN (N'生产完工', N'已完工')
ORDER BY p.pl_no DESC, p.pl_xc
GO
