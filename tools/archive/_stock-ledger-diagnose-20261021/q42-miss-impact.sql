SET NOCOUNT ON;
-- ① 10-18 那批缺流水单据,按 9/30 前/后拆分(决定它对 kucun 与台账的影响)
IF OBJECT_ID('tempdb..#missOut') IS NOT NULL DROP TABLE #missOut;
SELECT l.id, l.单据编号, 日期 = h.单据日期, 数量 = l.数量
INTO #missOut
FROM bd_material_out h JOIN bl_material_out l ON l.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND CONVERT(char(10), h.asp_time1, 120) = '2026-10-18'
  AND ISNULL(l.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM outh f WHERE f.src = 6 AND f.rid = l.id);

IF OBJECT_ID('tempdb..#missIn') IS NOT NULL DROP TABLE #missIn;
SELECT l.id, l.单据编号, 日期 = h.单据日期, 数量 = l.实收数量
INTO #missIn
FROM bd_finish_in h JOIN bl_finish_in l ON l.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND CONVERT(char(10), h.asp_time1, 120) = '2026-10-18'
  AND ISNULL(l.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM inh f WHERE f.src = 2 AND f.rid = l.id);

SELECT 批次 = '缺·产成品入库(入)', 行数 = COUNT(*), 数量 = SUM(数量),
       其中9月 = SUM(CASE WHEN 日期 < '2026-10-01' THEN 数量 ELSE 0 END),
       其中10月 = SUM(CASE WHEN 日期 >= '2026-10-01' THEN 数量 ELSE 0 END)
FROM #missIn
UNION ALL
SELECT '缺·材料出库(出)', COUNT(*), SUM(数量),
       SUM(CASE WHEN 日期 < '2026-10-01' THEN 数量 ELSE 0 END),
       SUM(CASE WHEN 日期 >= '2026-10-01' THEN 数量 ELSE 0 END)
FROM #missOut;

-- ② 台账口径:现在 / 补上这批之后
SELECT 口径 = '现在(全部流水,排除月结结转)', 合计 = CAST(SUM(净额) AS decimal(18,4)) FROM (
  SELECT 数量 AS 净额 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z
UNION ALL
SELECT '补上 10-18 缺流水之后', CAST(
  (SELECT SUM(净额) FROM (
     SELECT 数量 AS 净额 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
     UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') z)
  + ISNULL((SELECT SUM(数量) FROM #missIn),0) - ISNULL((SELECT SUM(数量) FROM #missOut),0) AS decimal(18,4))
UNION ALL
SELECT 'kucun 现存量合计(9/30 口径)', CAST(SUM(yl) AS decimal(18,4)) FROM kucun
UNION ALL
SELECT 'kucun 若只补 9 月那部分缺流水', CAST(SUM(yl) + ISNULL((SELECT SUM(数量) FROM #missIn WHERE 日期 < '2026-10-01'),0)
       - ISNULL((SELECT SUM(数量) FROM #missOut WHERE 日期 < '2026-10-01'),0) AS decimal(18,4)) FROM kucun;

-- ③ 台账视图本身(库存台账面板读它)
SELECT 行数 = COUNT(*), 最早 = MIN(单据日期), 最晚 = MAX(单据日期) FROM v_stock_ledger;
SELECT 方向 = CASE WHEN 收入数量 > 0 THEN '入' WHEN 发出数量 > 0 THEN '出' ELSE '其它' END,
       行数 = COUNT(*), 收入 = SUM(收入数量), 发出 = SUM(发出数量)
FROM v_stock_movement GROUP BY CASE WHEN 收入数量 > 0 THEN '入' WHEN 发出数量 > 0 THEN '出' ELSE '其它' END;
