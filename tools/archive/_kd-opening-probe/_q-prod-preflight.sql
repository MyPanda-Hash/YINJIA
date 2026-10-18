-- 正式库导入前核对(只读)
SET NOCOUNT ON;

PRINT N'=== ① 当前旧期初/结转 ===';
SELECT 单据编号, 单据类型, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
  FROM inh WHERE src = 0 GROUP BY 单据编号, 单据类型;
GO

PRINT N'=== ② 9/1 后的业务流水(导入期初后必须并入 kucun)===';
SELECT 方向, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计 FROM (
  SELECT N'入' AS 方向, 数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8
   AND 单据日期 >= '2026-09-01'
  UNION ALL
  SELECT N'出', 数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
) t GROUP BY 方向;
GO

PRINT N'=== ③ 9/1 之前的业务流水(有的话说明期初会双计)===';
SELECT 方向, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计, CONVERT(varchar(10),MIN(单据日期),120) AS 最早 FROM (
  SELECT N'入' AS 方向, 数量, 单据日期 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8
   AND 单据日期 < '2026-09-01'
  UNION ALL
  SELECT N'出', 数量, 单据日期 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-09-01'
) t GROUP BY 方向;
GO

PRINT N'=== ④ 当前 kucun 合计 ===';
SELECT COUNT(*) AS 行数, CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) AS 余量合计,
       SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END) AS 负结存行
  FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
