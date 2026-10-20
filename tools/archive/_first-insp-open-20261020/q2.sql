SELECT ISNULL(p.[完工状态],N'<null>') AS 完工状态, COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 有产线,
       SUM(CASE WHEN ISNULL(p.ja,N'N') IN (N'T',N'Y') THEN 1 ELSE 0 END) AS ja结案标记
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
GROUP BY ISNULL(p.[完工状态],N'<null>')
ORDER BY COUNT(*) DESC
GO
SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS 产品, ISNULL(p.scx,N'') AS 产线, ISNULL(p.[完工状态],N'') AS 完工状态,
       ISNULL(p.ja,N'') AS ja, ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库,
       (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y') AS 首件单数
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND ISNULL(p.[完工状态],N'') NOT IN (N'生产完工',N'已完工')
GO
SELECT TOP 10 [单据编号],[工单号],[工单行号],[单据状态],ASP_TIME1 FROM dbo.qc_first_insp_head
WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC
