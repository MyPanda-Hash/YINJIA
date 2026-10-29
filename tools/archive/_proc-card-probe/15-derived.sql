SET NOCOUNT ON;
SELECT COUNT(*) AS 行数 FROM (SELECT p.id AS 工单行id, p.pl_no,
             COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号
      FROM dbo.plang p
      CROSS APPLY (SELECT COALESCE(
              NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'')
                 FROM dbo.plang_pc pc
                WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL
                ORDER BY pc.id DESC),
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s.[批次号])), N'')
                 FROM dbo.scjl s JOIN dbo.plang_pc pc2 ON pc2.id = s.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s.[批次号])), N'') IS NOT NULL
                ORDER BY s.id DESC)
          ) AS 生产批次) bx
      WHERE p.pl_no = N'GD-2026-10-0018') a;
