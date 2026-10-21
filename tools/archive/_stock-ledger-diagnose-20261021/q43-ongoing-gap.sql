SET NOCOUNT ON;
-- 10-19 之后入库的单据,有没有再出现"已审核但没流水"(判断缺口是否还在继续)
SELECT 类型 = '材料出库', 已审核单 = COUNT(*),
       无流水单 = SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_material_out h
LEFT JOIN (SELECT 单据编号, 流水行 = COUNT(*) FROM outh GROUP BY 单据编号) m ON m.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND h.asp_time1 >= '2026-10-19'
UNION ALL
SELECT '产成品入库', COUNT(*), SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_finish_in h
LEFT JOIN (SELECT 单据编号, 流水行 = COUNT(*) FROM inh WHERE src = 2 GROUP BY 单据编号) m ON m.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND h.asp_time1 >= '2026-10-19'
UNION ALL
SELECT '采购入库', COUNT(*), SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_purchase_in h
LEFT JOIN (SELECT 单据编号, 流水行 = COUNT(*) FROM inh WHERE src = 1 GROUP BY 单据编号) m ON m.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND h.asp_time1 >= '2026-10-19'
UNION ALL
SELECT '销售出库', COUNT(*), SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_sale_out h
LEFT JOIN (SELECT 单据编号, 流水行 = COUNT(*) FROM outh WHERE src = 5 GROUP BY 单据编号) m ON m.单据编号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND h.asp_time1 >= '2026-10-19';
