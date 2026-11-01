SET NOCOUNT ON;

PRINT N'--- 锚点样本:plang_pc ↔ plang ---';
SELECT TOP 10 pc.id AS pc_id, pc.plang_id, p.pl_no, p.pl_xc, pc.[批次号]
FROM dbo.plang_pc pc JOIN dbo.plang p ON p.id = pc.plang_id
ORDER BY pc.id DESC;

PRINT N'--- 行级报工聚合(按真实行 id)---';
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
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s.[批次号])), N'')
                 FROM dbo.scjl s JOIN dbo.plang_pc pc2 ON pc2.id = s.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s.[批次号])), N'') IS NOT NULL
                ORDER BY s.id DESC)
          ) AS 生产批次) bx
      WHERE p.pl_no = N'GD-2026-10-0018') a
JOIN dbo.scjl s ON s.gldh = a.pl_no AND ISNULL(s.asp_cancel,'N') <> 'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = a.工单行id)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号], N'') = ISNULL(a.批次号, N'')))
GROUP BY a.工单行id, s.gxdm
ORDER BY a.工单行id, 工序;

PRINT N'--- 最新报工人(每 工单行+工序 取最大 id)---';
SELECT a.工单行id, s.gxdm AS 工序, ISNULL(s.ywman, N'') AS 报工人
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
              (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s.[批次号])), N'')
                 FROM dbo.scjl s JOIN dbo.plang_pc pc2 ON pc2.id = s.gd_id
                WHERE pc2.plang_id = p.id AND ISNULL(s.asp_cancel,'N') <> 'Y'
                  AND NULLIF(LTRIM(RTRIM(s.[批次号])), N'') IS NOT NULL
                ORDER BY s.id DESC)
          ) AS 生产批次) bx
      WHERE p.pl_no = N'GD-2026-10-0018') a
JOIN dbo.scjl s ON s.gldh = a.pl_no AND ISNULL(s.asp_cancel,'N') <> 'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = a.工单行id)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号], N'') = ISNULL(a.批次号, N'')))
ORDER BY s.id DESC;

PRINT N'--- 报工记录(单行)---';
SELECT s.id, ISNULL(s.[报工单号], N'') AS 报工单号, ISNULL(s.gxdm, N'') AS 工序,
       ISNULL(s.sl, 0) AS 报工数量, ISNULL(s.ywman, N'') AS 报工人,
       ISNULL(s.wgzt, N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date, 120) AS 单据日期
FROM dbo.scjl s
WHERE s.gldh = N'GD-2026-10-0018' AND ISNULL(s.asp_cancel,'N') <> 'Y'
  AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = 1162)
       OR (ISNULL(s.gd_id,0) = 0 AND ISNULL(s.[批次号], N'') = ISNULL(N'20261019', N'')))
ORDER BY s.id DESC;

PRINT N'--- 工单行详情样本(create 用)---';
SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc, ISNULL(p.gg,N'') AS gg,
       ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.scx,N'') AS scx, ISNULL(p.[工艺路线],N'') AS route,
       ISNULL(p.[当前工序],N'') AS cur, CONVERT(varchar(8), p.pl_date, 112) AS 工单日期
FROM dbo.plang p WHERE p.id IN (1162, 2171, 429);
