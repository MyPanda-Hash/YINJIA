SET NOCOUNT ON;
SELECT 单据 = '采购入库', 状态 = ISNULL(单据状态,'<NULL>'), 单数 = COUNT(*) FROM bd_purchase_in GROUP BY 单据状态
UNION ALL SELECT '产成品入库', ISNULL(单据状态,'<NULL>'), COUNT(*) FROM bd_finish_in GROUP BY 单据状态
UNION ALL SELECT '其他入库', ISNULL(单据状态,'<NULL>'), COUNT(*) FROM bd_other_in GROUP BY 单据状态
UNION ALL SELECT '销售出库', ISNULL(单据状态,'<NULL>'), COUNT(*) FROM bd_sale_out GROUP BY 单据状态
UNION ALL SELECT '材料出库', ISNULL(单据状态,'<NULL>'), COUNT(*) FROM bd_material_out GROUP BY 单据状态
UNION ALL SELECT '其他出库', ISNULL(单据状态,'<NULL>'), COUNT(*) FROM bd_other_out GROUP BY 单据状态
ORDER BY 1,2;

SELECT panel = panel_code, 留痕 = COUNT(*), 已审核 = SUM(CASE WHEN shr IS NOT NULL THEN 1 ELSE 0 END),
       已作废 = SUM(CASE WHEN canceled = 'Y' THEN 1 ELSE 0 END)
FROM yj_doc_status GROUP BY panel_code ORDER BY panel_code;
