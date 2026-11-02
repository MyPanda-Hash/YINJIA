SET NOCOUNT ON;
-- 流水 vs 来源单据 全面对账(只读)
IF OBJECT_ID('tempdb..#doc') IS NOT NULL DROP TABLE #doc;
SELECT src, id, 单据编号, 数量 AS 单据数量
INTO #doc
FROM (
  SELECT src = 1, id, 单据编号, CAST(实收数量 AS decimal(18,4)) AS 数量 FROM bl_purchase_in
  UNION ALL SELECT 2, id, 单据编号, CAST(实收数量 AS decimal(18,4)) FROM bl_finish_in
  UNION ALL SELECT 3, id, 单据编号, CAST(数量 AS decimal(18,4)) FROM bl_other_in
  UNION ALL SELECT 5, id, 单据编号, CAST(数量 AS decimal(18,4)) FROM bl_sale_out
  UNION ALL SELECT 6, id, 单据编号, CAST(数量 AS decimal(18,4)) FROM bl_material_out
  UNION ALL SELECT 7, id, 单据编号, CAST(数量 AS decimal(18,4)) FROM bl_other_out
) t;

PRINT '=== ① 流水能不能找到自己的来源单据行 ===';
SELECT 方向 = '入', f.src, 流水行 = COUNT(*),
       有rid = SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END),
       匹配到单据行 = SUM(CASE WHEN d.id IS NULL THEN 0 ELSE 1 END),
       匹配不上 = SUM(CASE WHEN d.id IS NULL THEN 1 ELSE 0 END),
       单号也不一致 = SUM(CASE WHEN d.id IS NOT NULL AND ISNULL(d.单据编号,N'') <> ISNULL(f.单据编号,N'') THEN 1 ELSE 0 END)
FROM inh f LEFT JOIN #doc d ON d.src = f.src AND d.id = f.rid
GROUP BY f.src
UNION ALL
SELECT '出', f.src, COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END),
       SUM(CASE WHEN d.id IS NULL THEN 0 ELSE 1 END), SUM(CASE WHEN d.id IS NULL THEN 1 ELSE 0 END),
       SUM(CASE WHEN d.id IS NOT NULL AND ISNULL(d.单据编号,N'') <> ISNULL(f.单据编号,N'') THEN 1 ELSE 0 END)
FROM outh f LEFT JOIN #doc d ON d.src = f.src AND d.id = f.rid
GROUP BY f.src
ORDER BY 1, 2;

PRINT '=== ② 数量与单据行不一致 ===';
SELECT 方向 = '入', f.src, 比对行 = COUNT(*), 不一致 = SUM(CASE WHEN ABS(f.数量 - d.单据数量) > 0.0001 THEN 1 ELSE 0 END),
       差额 = CAST(SUM(f.数量 - d.单据数量) AS decimal(18,4))
FROM inh f JOIN #doc d ON d.src = f.src AND d.id = f.rid GROUP BY f.src
UNION ALL
SELECT '出', f.src, COUNT(*), SUM(CASE WHEN ABS(f.数量 - d.单据数量) > 0.0001 THEN 1 ELSE 0 END),
       CAST(SUM(f.数量 - d.单据数量) AS decimal(18,4))
FROM outh f JOIN #doc d ON d.src = f.src AND d.id = f.rid GROUP BY f.src
ORDER BY 1, 2;

PRINT '=== ③ 重复键(src,rid,物料,批号 同一行被写多次) ===';
SELECT 方向 = '入', 重复键数 = COUNT(*), 多余行数 = SUM(n - 1) FROM (
  SELECT src, rid, 物料编码, 批号 = ISNULL(批号,N'<NULL>'), n = COUNT(*)
  FROM inh GROUP BY src, rid, 物料编码, ISNULL(批号,N'<NULL>')) a WHERE n > 1
UNION ALL
SELECT '出', COUNT(*), SUM(n - 1) FROM (
  SELECT src, rid, 物料编码, 批号 = ISNULL(批号,N'<NULL>'), n = COUNT(*)
  FROM outh GROUP BY src, rid, 物料编码, ISNULL(批号,N'<NULL>')) b WHERE n > 1;

PRINT '=== ④ 已审核单据行却没有流水(漏记) ===';
;WITH h1 AS (SELECT DISTINCT rid FROM inh WHERE src = 1 AND ISNULL(asp_cancel,'N') <> 'Y'),
      h2 AS (SELECT DISTINCT rid FROM inh WHERE src = 2 AND ISNULL(asp_cancel,'N') <> 'Y'),
      h3 AS (SELECT DISTINCT rid FROM inh WHERE src = 3 AND ISNULL(asp_cancel,'N') <> 'Y'),
      h5 AS (SELECT DISTINCT rid FROM outh WHERE src = 5 AND ISNULL(asp_cancel,'N') <> 'Y'),
      h6 AS (SELECT DISTINCT rid FROM outh WHERE src = 6 AND ISNULL(asp_cancel,'N') <> 'Y'),
      h7 AS (SELECT DISTINCT rid FROM outh WHERE src = 7 AND ISNULL(asp_cancel,'N') <> 'Y')
SELECT 类型 = '采购入库', 已审核行 = COUNT(*), 有流水 = SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_purchase_in l JOIN bd_purchase_in d ON d.单据编号 = l.单据编号 LEFT JOIN h1 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核'
UNION ALL
SELECT '产成品入库', COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_finish_in l JOIN bd_finish_in d ON d.单据编号 = l.单据编号 LEFT JOIN h2 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核'
UNION ALL
SELECT '其他入库', COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_other_in l JOIN bd_other_in d ON d.单据编号 = l.单据编号 LEFT JOIN h3 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核'
UNION ALL
SELECT '销售出库', COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_sale_out l JOIN bd_sale_out d ON d.单据编号 = l.单据编号 LEFT JOIN h5 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核'
UNION ALL
SELECT '材料出库', COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_material_out l JOIN bd_material_out d ON d.单据编号 = l.单据编号 LEFT JOIN h6 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核'
UNION ALL
SELECT '其他出库', COUNT(*), SUM(CASE WHEN f.rid IS NULL THEN 0 ELSE 1 END)
FROM bl_other_out l JOIN bd_other_out d ON d.单据编号 = l.单据编号 LEFT JOIN h7 f ON f.rid = l.id
WHERE ISNULL(l.asp_cancel,'N') <> 'Y' AND d.单据状态 = N'已审核';

PRINT '=== ⑤ 未审核/已作废单据却已经有流水 ===';
SELECT 情形 = '采购入库·草稿或作废但有流水', 流水行 = COUNT(*) FROM inh f
 WHERE f.src = 1 AND EXISTS (SELECT 1 FROM bd_purchase_in h WHERE h.单据编号 = f.单据编号 AND ISNULL(h.单据状态,N'') <> N'已审核')
UNION ALL
SELECT '产成品入库·草稿或作废但有流水', COUNT(*) FROM inh f
 WHERE f.src = 2 AND EXISTS (SELECT 1 FROM bd_finish_in h WHERE h.单据编号 = f.单据编号 AND ISNULL(h.单据状态,N'') <> N'已审核')
UNION ALL
SELECT '销售出库·草稿或作废但有流水', COUNT(*) FROM outh f
 WHERE f.src = 5 AND EXISTS (SELECT 1 FROM bd_sale_out h WHERE h.单据编号 = f.单据编号 AND ISNULL(h.单据状态,N'') <> N'已审核')
UNION ALL
SELECT '材料出库·草稿或作废但有流水', COUNT(*) FROM outh f
 WHERE f.src = 6 AND EXISTS (SELECT 1 FROM bd_material_out h WHERE h.单据编号 = f.单据编号 AND ISNULL(h.单据状态,N'') <> N'已审核');
