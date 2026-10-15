/* q-17-nullamount.sql — 收入金额为 NULL 的流水行是谁(只读) */
SET NOCOUNT ON;
GO
SELECT src, 单据类型, COUNT(*) AS 行数,
       SUM(CASE WHEN 收入金额 IS NULL THEN 1 ELSE 0 END) AS 收入金额NULL,
       SUM(收入数量) AS 收入数量合计,
       MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚
FROM dbo.v_stock_movement GROUP BY src, 单据类型 ORDER BY src;
GO
SELECT TOP 12 src, rid, 单据类型, 单据编号, 存货编码, 仓库键, 单据日期, 收入数量, 发出数量, 收入金额
FROM dbo.v_stock_movement WHERE 收入金额 IS NULL ORDER BY src, rid;
GO
SELECT N'inh 里金额为空' AS k, src, COUNT(*) AS 行数, SUM(数量) AS 数量合计, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚
FROM dbo.inh WHERE 金额 IS NULL AND ISNULL(asp_cancel,'N') <> 'Y' GROUP BY src;
GO
SELECT TOP 5 src, rid, 单据类型, 单据编号, 物料编码, 仓库编码, 批号, 数量, 单价, 金额, 单据日期
FROM dbo.inh WHERE 金额 IS NULL AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY src, id;
GO
