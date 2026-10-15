-- q-13-kucun-detail.sql — KUCUN 逐列核对(明确列名,避免 SELECT * 误读)+ 不自洽样本 + 来源分布
SET NOCOUNT ON;
SELECT N'样本' AS k, wzdm, ckdm, lot_no, rkl, ckl, yl, price, total_je, 预警数量, in_date, update_date, asp_user1
FROM kucun ORDER BY yl DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
GO
SELECT N'不自洽样本' AS k, wzdm, ckdm, lot_no, rkl, ckl, yl, rkl - ckl AS 入减出, price, asp_user1
FROM kucun WHERE ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) > 0.005
ORDER BY ABS(ISNULL(yl,0) - (ISNULL(rkl,0) - ISNULL(ckl,0))) DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
GO
SELECT N'来源' AS k, asp_user1, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量, SUM(ISNULL(rkl,0)) AS 累计入, SUM(ISNULL(ckl,0)) AS 累计出
FROM kucun GROUP BY asp_user1 ORDER BY 行数 DESC;
GO
SELECT N'按仓库' AS k, ckdm, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量
FROM kucun GROUP BY ckdm ORDER BY 行数 DESC;
GO
SELECT N'零现存量行' AS k, COUNT(*) AS 行数 FROM kucun WHERE ISNULL(yl,0) = 0;
GO
SELECT N'price 覆盖' AS k,
       SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END) AS price为空,
       SUM(CASE WHEN ISNULL(price,0) = 0 THEN 1 ELSE 0 END) AS price为零,
       SUM(CASE WHEN ISNULL(price,0) > 0 THEN 1 ELSE 0 END) AS price有值
FROM kucun;
GO
