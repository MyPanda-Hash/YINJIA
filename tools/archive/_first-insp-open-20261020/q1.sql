-- 首件检验单放开门禁:现状取证(只读)
SELECT ISNULL(p.[完工状态],N'<null>') AS 完工状态, COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 有产线,
       SUM(CASE WHEN ISNULL(p.ja,N'N') IN (N'T',N'Y') THEN 1 ELSE 0 END) AS ja结案标记
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
GROUP BY ISNULL(p.[完工状态],N'<null>')
ORDER BY 行数 DESC
GO
SELECT COUNT(*) AS 存活工单行,
       SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 已排产入线,
       SUM(CASE WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工',N'已完工') THEN 1 ELSE 0 END) AS 完工状态成立,
       SUM(CASE WHEN ISNULL(p.ja,N'N') IN (N'T',N'Y') AND (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) THEN 1 ELSE 0 END) AS 按入库口径结案
FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'
GO
SELECT TOP 20 p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 行号, ISNULL(p.dm,N'') AS 产品,
       ISNULL(p.scx,N'') AS 产线, ISNULL(p.[完工状态],N'') AS 完工状态,
       ISNULL(p.ja,N'') AS ja, ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库,
       (SELECT COUNT(*) FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND ISNULL(l.asp_cancel,'N')<>'Y') AS 台账行数
FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'
ORDER BY p.id DESC
GO
SELECT COUNT(*) AS 首件单头总数,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 作废
FROM dbo.qc_first_insp_head
GO
SELECT COUNT(*) AS 存活单覆盖的工单行
FROM (SELECT DISTINCT [工单号],[工单行号] FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y') t
GO
