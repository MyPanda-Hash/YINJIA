SET NOCOUNT ON;
PRINT '=== 重复组按 src 分布 + 多余数量 ===';
SELECT 'inh' t, src, COUNT(*) 组, CAST(SUM(多余数量) AS decimal(18,4)) 多余合计 FROM (
  SELECT src, 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量, (COUNT(*)-1)*数量 多余数量, COUNT(*) n
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY src,单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) x
GROUP BY src
UNION ALL
SELECT 'outh', src, COUNT(*), CAST(SUM(多余数量) AS decimal(18,4)) FROM (
  SELECT src, 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量, (COUNT(*)-1)*数量 多余数量, COUNT(*) n
  FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY src,单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) y
GROUP BY src ORDER BY t, src;
