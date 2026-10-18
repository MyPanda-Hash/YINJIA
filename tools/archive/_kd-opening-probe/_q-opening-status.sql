-- 期初状态核实:9/1 之前的期初到底导没导、导的是什么口径(只读)
SET NOCOUNT ON;

PRINT N'=== ① inh 里现存的期初/结转行(按单号分组)===';
SELECT 单据编号, 单据类型, CONVERT(varchar(10), 单据日期, 120) AS 单据日期,
       ISNULL(经手人,'') AS 经手人, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计,
       CONVERT(varchar(19), MIN(asp_time1), 120) AS 最早写入, CONVERT(varchar(19), MAX(asp_time1), 120) AS 最晚写入
  FROM inh WHERE src = 0 GROUP BY 单据编号, 单据类型, 单据日期, 经手人 ORDER BY 单据编号;
GO

PRINT N'=== ② kucun 按行来源分布(看有没有 2026-08-31 口径的期初导入)===';
SELECT ISNULL(asp_user1, N'(空)') AS 行来源, COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,2)) AS 余量合计,
       CONVERT(varchar(19), MAX(asp_time1), 120) AS 最近写入
  FROM kucun GROUP BY asp_user1 ORDER BY COUNT(*) DESC;
GO

PRINT N'=== ③ 是否存在任何 INIT-20260831 口径的期初 ===';
SELECT COUNT(*) AS INIT_20260831行数 FROM inh WHERE 单据编号 = N'INIT-20260831';
GO
SELECT COUNT(*) AS kucun期初导入行数 FROM kucun WHERE asp_user1 = N'期初导入';
GO

PRINT N'=== ④ MES 9/1 之前的流水有多少(判断期初缺口的实际大小)===';
SELECT 方向, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计, CONVERT(varchar(10), MIN(单据日期), 120) AS 最早
FROM (
  SELECT N'入库' AS 方向, 数量, 单据日期 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 < '2026-09-01'
  UNION ALL
  SELECT N'出库', 数量, 单据日期 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '2026-09-01'
) t GROUP BY 方向;
GO

PRINT N'=== ⑤ 当前 kucun 合计 与 金蝶 8/31 期初 的对比基线 ===';
SELECT (SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS MES当前结存合计,
       (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS MES行数;
GO
