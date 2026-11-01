SET NOCOUNT ON;
SELECT a.工单行id, s.gxdm AS 工序, SUM(ISNULL(s.sl,0)) AS 已报工, COUNT(*) AS 单数
FROM (SELECT p.id AS 工单行id, p.pl_no, CONVERT(varchar(8), p.pl_date, 112) AS 批次号
      FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0018') a
JOIN dbo.scjl s ON s.gldh = a.pl_no AND ISNULL(s.asp_cancel,'N') <> 'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = a.工单行id)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号], N'') = ISNULL(a.批次号, N'')))
GROUP BY a.工单行id, s.gxdm;
