SET NOCOUNT ON;
SELECT 'bd_purchase_in' AS t, 单据状态, COUNT(*) FROM bd_purchase_in GROUP BY 单据状态
UNION ALL SELECT 'bd_purchase_in.单据状态2', 单据状态2, COUNT(*) FROM bd_purchase_in GROUP BY 单据状态2
UNION ALL SELECT 'bd_sale_out.单据状态', 单据状态, COUNT(*) FROM bd_sale_out GROUP BY 单据状态
UNION ALL SELECT 'bd_sale_out.单据状态2', 单据状态2, COUNT(*) FROM bd_sale_out GROUP BY 单据状态2;
