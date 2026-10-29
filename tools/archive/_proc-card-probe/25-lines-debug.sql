SET NOCOUNT ON;

SELECT N'--- A: 直接看两行的解析批次 ---' AS x;
SELECT p.id, p.pl_no, p.pl_xc, p.[批次号],
       COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) AS 批次号解析,
       bx.生产批次
FROM dbo.plang p
CROSS APPLY (SELECT COALESCE(
        NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
          WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
          JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
          WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
    ) AS 生产批次) bx
WHERE p.id IN (1146, 1147, 1155);

SELECT N'--- B: 只按批次过滤 ---' AS x;
SELECT p.id, p.pl_no, p.pl_xc
FROM dbo.plang p
CROSS APPLY (SELECT COALESCE(
        NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
          WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
          JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
          WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
    ) AS 生产批次) bx
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) = N'20261019';

SELECT N'--- C: 批次 + pl_no LIKE ---' AS x;
SELECT p.id, p.pl_no, p.pl_xc
FROM dbo.plang p
CROSS APPLY (SELECT COALESCE(
        NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
          WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
          JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
          WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
    ) AS 生产批次) bx
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) = N'20261019'
  AND p.pl_no LIKE N'%GD-2026-10-0018%';

SELECT N'--- D: 批次 + 四个 LIKE 的 OR 组 ---' AS x;
SELECT p.id, p.pl_no, p.pl_xc
FROM dbo.plang p
CROSS APPLY (SELECT COALESCE(
        NULLIF(LTRIM(RTRIM(p.[批次号])), N''),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc
          WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),
        (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2
          JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id
          WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'
            AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC)
    ) AS 生产批次) bx
LEFT JOIN dbo.wo_proc_card_head c ON c.工单行id = p.id AND ISNULL(c.asp_cancel,'N')<>'Y'
WHERE ISNULL(p.asp_cancel,'N')<>'Y'
  AND COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112)) = N'20261019'
  AND (p.pl_no LIKE N'%GD-2026-10-0018%' OR ISNULL(p.dm,N'') LIKE N'%GD-2026-10-0018%'
       OR ISNULL(p.mc,N'') LIKE N'%GD-2026-10-0018%' OR ISNULL(p.gg,N'') LIKE N'%GD-2026-10-0018%');
