SET NOCOUNT ON;
-- 已完工行按「已结案」口径拆分(与 PlangClose.closed 同源)
SELECT
  SUM(CASE WHEN ISNULL(p.ja,'N') IN (N'T',N'Y')
            AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
           THEN 1 ELSE 0 END) AS 已结案,
  SUM(CASE WHEN NOT (ISNULL(p.ja,'N') IN (N'T',N'Y')
            AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
           THEN 1 ELSE 0 END) AS 未结案,
  COUNT(*) AS 合计
FROM dbo.plang p WHERE ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.asp_cancel,'N')<>'Y';
GO
-- 未结案的都是什么形态(ja/rk/pl)
SELECT ISNULL(ja,N'(null)') ja, COUNT(*) n,
       SUM(CASE WHEN ISNULL(pl_sl,0)>0 AND ISNULL(rk_sl,0)>=ISNULL(pl_sl,0) THEN 1 ELSE 0 END) 入库达标
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y'
GROUP BY ja;
GO
SELECT TOP 15 pl_no, pl_xc, ISNULL(ja,N'') ja, pl_sl, rk_sl, ISNULL([批次号],N'') 批次号,
       CONVERT(varchar(10),pl_date,120) 单据日期, CONVERT(varchar(10),asp_time1,120) 转单日期
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y'
  AND NOT (ISNULL(ja,'N') IN (N'T',N'Y') AND ((ISNULL(pl_sl,0)>0 AND ISNULL(rk_sl,0)>=ISNULL(pl_sl,0)) OR pl_no LIKE N'GD2608%'))
ORDER BY id;
GO
