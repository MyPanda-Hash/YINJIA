SET NOCOUNT ON;
DECLARE @c TABLE(id int, pl_no nvarchar(56), pl_xc int, d date);
INSERT @c SELECT p.id,p.pl_no,ISNULL(p.pl_xc,0),CAST(p.pl_date AS date) FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%');
SELECT COUNT(*) 已结案行, SUM(CASE WHEN d>='2026-09-01' AND d<'2026-10-01' THEN 1 ELSE 0 END) 九月行,
       SUM(CASE WHEN d>='2026-10-01' THEN 1 ELSE 0 END) 十月行,
       COUNT(DISTINCT CASE WHEN d>='2026-09-01' AND d<'2026-10-01' THEN pl_no END) 九月工单数
FROM @c;
SELECT TOP 10 pl_no, pl_xc, CONVERT(varchar(10),d,120) 单据日期 FROM @c WHERE d>='2026-09-01' AND d<'2026-10-01' ORDER BY pl_no,pl_xc;
GO
