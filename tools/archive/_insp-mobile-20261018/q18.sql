SET NOCOUNT ON;
SELECT COUNT(*) AS 未结案行,
       SUM(CASE WHEN ISNULL(x.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 已排产线,
       SUM(CASE WHEN x.成型台账>0 THEN 1 ELSE 0 END) AS 有成型台账,
       SUM(CASE WHEN x.成型报工>0 THEN 1 ELSE 0 END) AS 有成型报工
FROM (
  SELECT p.id, p.scx,
    (SELECT COUNT(*) FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND l.工序=N'成型' AND ISNULL(l.asp_cancel,'N')<>'Y') AS 成型台账,
    (SELECT COUNT(*) FROM dbo.scjl s WHERE s.gldh=p.pl_no AND s.gxdm=N'成型' AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.asp_cancel,'N')<>'Y') AS 成型报工
  FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')
) x;
GO
PRINT '--- 最近 12 行 ---';
SELECT TOP 12 p.id, p.pl_no, p.pl_xc, p.scx, ISNULL(p.ja,'N') AS ja,
  (SELECT COUNT(*) FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND ISNULL(l.asp_cancel,'N')<>'Y') AS 台账行数,
  (SELECT COUNT(*) FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND l.工序=N'成型' AND ISNULL(l.asp_cancel,'N')<>'Y') AS 成型台账
FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id DESC;
GO
