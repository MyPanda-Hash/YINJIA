SET NOCOUNT ON;
SELECT COUNT(DISTINCT pl_no) AS 九月工单数, COUNT(*) AS 九月行数,
       SUM(CASE WHEN CAST(pl_date AS date) >= '2026-10-01' THEN 1 ELSE 0 END) AS 其中十月日期行
FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%';
SELECT COUNT(*) AS 重复行键 FROM (SELECT pl_no, pl_xc FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%' GROUP BY pl_no, pl_xc HAVING COUNT(*)>1) x;
SELECT COUNT(*) AS 十月已结案行 FROM dbo.plang p
WHERE p.pl_no LIKE N'GD-2026-10-%' AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN ('T','Y') AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-10-01';
SELECT COUNT(*) AS 九月未结案仍十月号 FROM dbo.plang p
WHERE p.pl_no LIKE N'GD-2026-10-%' AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01'
  AND NOT (ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.ja,'N') IN ('T','Y')
           AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'));
SELECT COUNT(*) AS 号池旧号 FROM dbo.s_allno WHERE dh LIKE N'GD-2026-10-%' AND ny=N'2026-09';
SELECT COUNT(*) AS 号池九月号 FROM dbo.s_allno WHERE dh LIKE N'GD-2026-09-%' AND ny=N'2026-09';
SELECT COUNT(*) AS 链路孤儿 FROM dbo.scjl s WHERE s.gldh LIKE N'GD-2026-09-%' AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no=s.gldh);
GO
