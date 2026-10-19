SET NOCOUNT ON;
PRINT N'== 库存状况表里同一(仓库编码,存货编码)出现多行的完整行(前 12 行) ==';
WITH d AS (
  SELECT 仓库编码, 存货编码 FROM dbo.v_stock_balance GROUP BY 仓库编码, 存货编码 HAVING COUNT(*) > 1
)
SELECT TOP 12 b.仓库编码, b.仓库, b.存货编码, b.存货, b.规格型号, b.主计量,
       CAST(b.现存量 AS decimal(18,4)) AS 现存量, CAST(b.结存金额 AS decimal(18,4)) AS 结存金额
FROM dbo.v_stock_balance b JOIN d ON d.仓库编码=b.仓库编码 AND d.存货编码=b.存货编码
ORDER BY b.存货编码, b.现存量;
