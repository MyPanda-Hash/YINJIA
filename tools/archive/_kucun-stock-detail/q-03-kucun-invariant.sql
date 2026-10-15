-- q-12-kucun-invariant.sql — KUCUN 三个量的口径自检:现存量 yl 是否等于 累计入库 rkl − 累计出库 ckl
SET NOCOUNT ON;
SELECT N'总量' AS k,
       COUNT(*) AS 行数,
       SUM(ISNULL(rkl,0)) AS 累计入库,
       SUM(ISNULL(ckl,0)) AS 累计出库,
       SUM(ISNULL(rkl,0)) - SUM(ISNULL(ckl,0)) AS 入减出,
       SUM(ISNULL(yl,0)) AS 现存量合计,
       SUM(ISNULL(price,0) * ISNULL(yl,0)) AS 单价乘现存量
FROM kucun;
GO
SELECT N'三量是否自洽' AS k,
       SUM(CASE WHEN ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) <= 0.005 THEN 1 ELSE 0 END) AS 自洽行,
       SUM(CASE WHEN ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) > 0.005 THEN 1 ELSE 0 END) AS 不自洽行
FROM kucun;
GO
SELECT N'不自洽样本' AS k, TOP 10 wzdm, ckdm, lot_no, rkl, ckl, yl, price, asp_user1, in_date, update_date
FROM kucun WHERE ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) > 0.005
ORDER BY ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) DESC;
GO
SELECT N'按来源' AS k, asp_user1, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量
FROM kucun GROUP BY asp_user1 ORDER BY 行数 DESC;
GO
SELECT N'按仓库' AS k, ckdm, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量
FROM kucun GROUP BY ckdm ORDER BY 行数 DESC;
GO
