SET NOCOUNT ON;
SELECT COUNT(*) AS 可选行数
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')
  AND ISNULL(p.scx,N'') <> N''
  AND (EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND l.工序=N'成型' AND ISNULL(l.asp_cancel,'N')<>'Y')
       OR NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l2 WHERE l2.工单号=p.pl_no AND l2.工单行id=p.id AND ISNULL(l2.asp_cancel,'N')<>'Y'));
GO
SELECT TOP 5 p.pl_no, p.pl_xc, p.scx FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')
  AND ISNULL(p.scx,N'') <> N''
  AND (EXISTS (SELECT 1 FROM dbo.wo_process_line l WHERE l.工单号=p.pl_no AND l.工单行id=p.id AND l.工序=N'成型' AND ISNULL(l.asp_cancel,'N')<>'Y')
       OR NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l2 WHERE l2.工单号=p.pl_no AND l2.工单行id=p.id AND ISNULL(l2.asp_cancel,'N')<>'Y'));
GO
