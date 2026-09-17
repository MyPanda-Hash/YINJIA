SET NOCOUNT ON;
SELECT 'PURCHASE_IN' AS p, COUNT(*) AS fields FROM yj_field WHERE panel_code='PURCHASE_IN'
UNION ALL SELECT 'SALE_OUT', COUNT(*) FROM yj_field WHERE panel_code='SALE_OUT';
SELECT 'bd_purchase_in' AS t, COUNT(*) AS cols FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_purchase_in')
UNION ALL SELECT 'bl_purchase_in', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_purchase_in')
UNION ALL SELECT 'bd_sale_out', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_sale_out')
UNION ALL SELECT 'bl_sale_out', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_sale_out');
-- 看采购入库现有头字段
SELECT place, col_name, label FROM yj_field WHERE panel_code='PURCHASE_IN' ORDER BY place, seq;
