-- q-07-carry-shape.sql — 结转行形态自检:一个期间只有一份、**不带批号**、按 (物料,仓库) 一行
SET NOCOUNT ON;
SELECT N'结转单(按期间)' AS k, 单据编号, 单据类型, COUNT(*) AS 行数,
       SUM(CASE WHEN 批号 IS NULL OR LTRIM(RTRIM(批号)) = '' THEN 1 ELSE 0 END) AS 无批号行,
       COUNT(DISTINCT 物料编码 + '|' + 仓库编码) AS 物料仓库组合数,
       CAST(SUM(数量) AS decimal(18,4)) AS 合计,
       CONVERT(nvarchar(10), MIN(单据日期), 120) AS 日期
FROM inh WHERE 单据类型 = N'月结结转' GROUP BY 单据编号, 单据类型;
GO
-- 每个 (物料,仓库) 在该单据里只应出现一次
SELECT N'重复键(应 0)' AS k, COUNT(*) AS 重复组数 FROM (
  SELECT 物料编码, 仓库编码, COUNT(*) AS c FROM inh WHERE 单据类型 = N'月结结转'
  GROUP BY 物料编码, 仓库编码 HAVING COUNT(*) > 1) t;
GO
SELECT N'样本(前 5 行)' AS k, 单据编号, 物料编码, 仓库编码, ISNULL(批号, N'(NULL)') AS 批号, 数量
FROM (SELECT TOP 5 单据编号, 物料编码, 仓库编码, 批号, 数量 FROM inh
      WHERE 单据类型 = N'月结结转' ORDER BY ABS(数量) DESC) x;
GO
SELECT N'视图口径(结转行不进累计视图)' AS k,
       (SELECT COUNT(*) FROM v_stock_movement WHERE 单据类型 = N'月结结转') AS 视图里的结转行,
       (SELECT CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_balance) AS 状况表现存量,
       (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun) AS 结存表现存量;
GO
