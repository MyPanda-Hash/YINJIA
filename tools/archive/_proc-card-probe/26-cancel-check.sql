SET NOCOUNT ON;
SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.asp_cancel,N'(null)') AS asp_cancel, p.[批次号]
FROM dbo.plang p WHERE p.id IN (1146, 1147, 1155, 1168, 2171);

SELECT N'--- 未作废且解析批次=20261019 的行 ---' AS x;
SELECT p.id, p.pl_no, p.pl_xc, p.[批次号], p.pl_date
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
ORDER BY p.id;
