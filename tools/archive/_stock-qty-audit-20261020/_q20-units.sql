SET NOCOUNT ON;
PRINT N'== 1. 库存状况表:同一(仓库编码,存货编码) 存在多种主计量 的键 ==';
WITH u AS (
  SELECT 仓库编码, 存货编码, COUNT(DISTINCT ISNULL(主计量,N'(空)')) AS units,
         COUNT(*) AS rows_cnt,
         MIN(主计量) AS u1, MAX(主计量) AS u2
  FROM dbo.v_stock_balance GROUP BY 仓库编码, 存货编码
)
SELECT COUNT(*) AS [多单位键数], SUM(rows_cnt) AS [涉及行数] FROM u WHERE units > 1;

PRINT N'== 2. 各计量单位的库存合计(报表口径) ==';
SELECT ISNULL(主计量,N'(空)') AS 主计量, COUNT(*) AS 行数, CAST(SUM(现存量) AS decimal(18,4)) AS 合计
FROM dbo.v_stock_balance GROUP BY 主计量 ORDER BY 行数 DESC;

PRINT N'== 3. 流水 inh/outh 里的计量单位种类 ==';
SELECT 计量单位, COUNT(*) AS 行数 FROM dbo.inh GROUP BY 计量单位 ORDER BY 行数 DESC;
PRINT N'-- outh --';
SELECT 计量单位, COUNT(*) AS 行数 FROM dbo.outh GROUP BY 计量单位 ORDER BY 行数 DESC;
