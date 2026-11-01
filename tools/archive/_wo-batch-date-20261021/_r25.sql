SET NOCOUNT ON;
SELECT COUNT(*) AS 九月号行 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%';
SELECT COUNT(*) AS 十月号行 FROM dbo.plang WHERE pl_no LIKE N'GD-2026-10-%';
SELECT COUNT(*) AS 九月已结案旧号 FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN ('T','Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01'
  AND p.pl_no LIKE N'GD-2026-10-%';
GO
