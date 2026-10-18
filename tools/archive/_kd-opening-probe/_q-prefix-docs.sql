-- 9/1 之前的业务流水明细(期初双计风险;只读)
SET NOCOUNT ON;

PRINT N'=== ① 9/1 之前流水的单据类型分布 ===';
SELECT 方向, 单据类型, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计,
       CONVERT(varchar(10),MIN(单据日期),120) AS 最早, CONVERT(varchar(10),MAX(单据日期),120) AS 最晚
FROM (
  SELECT N'入' AS 方向, 单据类型, 数量, 单据日期 FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 < '2026-09-01'
  UNION ALL
  SELECT N'出', 单据类型, 数量, 单据日期 FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-09-01'
) t GROUP BY 方向, 单据类型 ORDER BY 方向, 单据类型;
GO

PRINT N'=== ② 明细单据号(逐张)===';
SELECT 方向, 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120) AS 单据日期,
       COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量
FROM (
  SELECT N'入' AS 方向, 单据类型, 单据编号, 单据日期, 数量 FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 < '2026-09-01'
  UNION ALL
  SELECT N'出', 单据类型, 单据编号, 单据日期, 数量 FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-09-01'
) t GROUP BY 方向, 单据类型, 单据编号, 单据日期 ORDER BY 单据日期, 单据编号;
GO

PRINT N'=== ③ 这些单据对应的面板单据头(确认单据状态)===';
SELECT N'bd_purchase_in' AS 表, 单据编号, CONVERT(varchar(10),单据日期,120) AS 单据日期, 单据状态, ISNULL(asp_cancel,'N') AS 作废
  FROM bd_purchase_in WHERE 单据日期 < '2026-09-01'
UNION ALL
SELECT N'bd_sale_out', 单据编号, CONVERT(varchar(10),单据日期,120), 单据状态, ISNULL(asp_cancel,'N')
  FROM bd_sale_out WHERE 单据日期 < '2026-09-01'
UNION ALL
SELECT N'bd_material_out', 单据编号, CONVERT(varchar(10),单据日期,120), 单据状态, ISNULL(asp_cancel,'N')
  FROM bd_material_out WHERE 单据日期 < '2026-09-01'
UNION ALL
SELECT N'bd_finish_in', 单据编号, CONVERT(varchar(10),单据日期,120), 单据状态, ISNULL(asp_cancel,'N')
  FROM bd_finish_in WHERE 单据日期 < '2026-09-01'
ORDER BY 单据日期, 单据编号;
GO
