-- 只读核实:MANU_ORDER 物理表的 13 行是历史残留还是仍在新生
PRINT N'=== bd_manu_order 的 13 行:创建时间分布 + 是否含新单号前缀 GD ==='
SELECT
  CONVERT(varchar(7), asp_time1, 120) AS 创建年月,
  COUNT(*) AS 行数,
  SUM(CASE WHEN [合同号] LIKE N'GD%' THEN 1 ELSE 0 END) AS GD前缀数,
  SUM(CASE WHEN [合同号] LIKE N'MO%' THEN 1 ELSE 0 END) AS MO前缀数,
  MIN([合同号]) AS 最小单号, MAX([合同号]) AS 最大单号
FROM bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY CONVERT(varchar(7), asp_time1, 120)
ORDER BY 创建年月

PRINT N'=== plang 的 69 行:创建时间分布(对照) ==='
SELECT
  CONVERT(varchar(7), asp_time1, 120) AS 创建年月,
  COUNT(*) AS 行数
FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY CONVERT(varchar(7), asp_time1, 120)
ORDER BY 创建年月

PRINT N'=== 两表是否有单号重叠(理论上不该有) ==='
SELECT N'重叠单号数' AS 指标, COUNT(*) AS 数 FROM (
  SELECT h.[合同号] FROM bd_manu_order h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  INTERSECT
  SELECT p.pl_no FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'
) t
