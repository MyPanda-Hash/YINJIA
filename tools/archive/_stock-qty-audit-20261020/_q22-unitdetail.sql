SET NOCOUNT ON;
PRINT N'== HP-08 / HS-150 的流水明细(单位与数量) ==';
SELECT 单据日期, 单据类型, 单据编号, 仓库编码, 仓库, 批号, 计量单位,
       CAST(收入数量 AS decimal(18,4)) AS 收入, CAST(发出数量 AS decimal(18,4)) AS 发出, src
FROM dbo.v_stock_movement
WHERE 存货编码 IN (N'HP-08', N'HS-150') AND 仓库 IN (N'恒亿仓', N'华北工控仓')
ORDER BY 存货编码, 单据日期, src;

PRINT N'== g 单位行都来自哪些单据类型 ==';
SELECT 单据类型, 计量单位, COUNT(*) AS 行数, CAST(SUM(收入数量-发出数量) AS decimal(18,4)) AS 净量
FROM dbo.v_stock_movement WHERE 计量单位 = N'g'
GROUP BY 单据类型, 计量单位 ORDER BY 行数 DESC;
