SET NOCOUNT ON;
SELECT N'--- 有效报工(gldh) ---' AS x;
SELECT TOP 10 s.gldh, COUNT(*) AS n, ISNULL(s.[批次号],N'') AS 批次号, MIN(s.gd_id) AS gd_id
FROM dbo.scjl s WHERE ISNULL(s.asp_cancel,'N') <> 'Y' GROUP BY s.gldh, ISNULL(s.[批次号],N'') ORDER BY n DESC;

SELECT N'--- 有效报工的行级聚合(锚点口径)---' AS x;
SELECT a.工单行id, s.gxdm AS 工序,
       SUM(CASE WHEN ISNULL(s.wgzt,'N') = 'Y' THEN ISNULL(s.sl, 0) ELSE 0 END) AS 已报工,
       SUM(CASE WHEN ISNULL(s.wgzt,'N') <> 'Y' THEN ISNULL(s.sl, 0) ELSE 0 END) AS 待审核,
       CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N') = 'Y' THEN s.wgsj END), 120) AS 完成时间,
       COUNT(*) AS 报工单数
FROM (SELECT p.id AS 工单行id, p.pl_no,
             COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号
      FROM dbo.plang p
      CROSS APPLY (SELECT COALESCE(
              NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'')
                 FROM dbo.plang_pc pc
                WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL
                ORDER BY pc.id DESC),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'')
                 FROM dbo.scjl s2 JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL
                ORDER BY s2.id DESC)
          ) AS 生产批次) bx
      WHERE ISNULL(p.asp_cancel,'N') <> 'Y') a
JOIN dbo.scjl s ON s.gldh = a.pl_no AND ISNULL(s.asp_cancel,'N') <> 'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = a.工单行id)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号], N'') = ISNULL(a.批次号, N'')))
GROUP BY a.工单行id, s.gxdm
ORDER BY a.工单行id, 工序;
