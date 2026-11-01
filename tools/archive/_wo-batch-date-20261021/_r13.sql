SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
SELECT DISTINCT p.pl_no AS old_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no INTO #m FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
DECLARE @n int;
EXEC sp_executesql N'SELECT @n=COUNT(*) FROM dbo.[plang] x JOIN #m m ON x.[pl_no]=m.old_no', N'@n int OUTPUT', @n OUTPUT;
SELECT @n AS plang_hits;
DECLARE @cols nvarchar(max);
SELECT @cols = STUFF((SELECT N' OR x.' + QUOTENAME(c.name) + N'=m.old_no'
                      FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                      WHERE c.object_id=OBJECT_ID(N'dbo.[plang]') AND ty.name IN ('nvarchar','varchar','nchar','char')
                      FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 4, '');
SELECT LEFT(@cols, 200) AS cols_head, LEN(@cols) AS cols_len;
SELECT OBJECT_ID(N'dbo.[plang]') AS oid;
GO
