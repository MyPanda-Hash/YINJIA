SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS 产品, ISNULL(p.scx,N'') AS 产线,
       ISNULL(p.[完工状态],N'<null>') AS 完工状态, ISNULL(p.ja,N'') AS ja,
       ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND NOT (ISNULL(p.ja,'N') IN (N'T',N'Y')
           AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
  AND ISNULL(p.[完工状态],N'') NOT IN (N'生产完工',N'已完工')
  AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h
                  WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y')
ORDER BY p.pl_no DESC, p.pl_xc
GO
