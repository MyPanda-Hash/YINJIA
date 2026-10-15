
CREATE VIEW dbo.v_stock_summary AS
WITH monthly AS (
  SELECT 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位 AS 主单位,
         ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N'未填日期') AS 期次,
         SUM(收入数量) AS 本期入库数量, SUM(收入金额) AS 本期入库金额,
         SUM(发出数量) AS 本期出库数量, SUM(发出金额) AS 本期出库金额
  FROM dbo.v_stock_ledger
  GROUP BY 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
           ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N'未填日期')
),
run AS (
  SELECT monthly.*,
         SUM(本期入库数量 - 本期出库数量) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存数量,
         SUM(本期入库金额 - 本期出库金额) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存金额
  FROM monthly
),
calc AS (
  SELECT *, 期末结存数量 - (本期入库数量 - 本期出库数量) AS 期初数量,
            期末结存金额 - (本期入库金额 - 本期出库金额) AS 期初金额
  FROM run
)
SELECT ROW_NUMBER() OVER (ORDER BY 仓库, 存货编码, 期次) AS id,
       CASE WHEN 期次 LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]' THEN 期次 + '-01' END AS 开始日期,
       CASE WHEN 期次 LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
            THEN CONVERT(nvarchar(10), DATEADD(DAY, -1, DATEADD(MONTH, 1, 期次 + '-01')), 120) END AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 主单位, 期次,
       期初数量, CASE WHEN 期初数量<>0 THEN 期初金额/期初数量 ELSE 0 END AS 期初平均单价, 期初金额,
       本期入库数量, CASE WHEN 本期入库数量<>0 THEN 本期入库金额/本期入库数量 ELSE 0 END AS 入库平均单价, 本期入库金额,
       本期出库数量, CASE WHEN 本期出库数量<>0 THEN 本期出库金额/本期出库数量 ELSE 0 END AS 出库平均单价, 本期出库金额,
       期末结存数量, CASE WHEN 期末结存数量<>0 THEN 期末结存金额/期末结存数量 ELSE 0 END AS 期末平均单价, 期末结存金额,
       CAST('N' AS char(1)) AS asp_cancel
FROM calc;
