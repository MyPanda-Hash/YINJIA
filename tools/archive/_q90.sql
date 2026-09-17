SET NOCOUNT ON;
SELECT N'采购入库头' AS t, COUNT(*) AS n FROM bd_purchase_in UNION ALL
SELECT N'采购入库行', COUNT(*) FROM bl_purchase_in UNION ALL
SELECT N'销售出库头', COUNT(*) FROM bd_sale_out UNION ALL
SELECT N'销售出库行', COUNT(*) FROM bl_sale_out;
SELECT 单据编号, 单据状态, ISNULL(asp_user1,'') AS push标记 FROM bd_purchase_in;
SELECT 单据编号, 单据状态, ISNULL(asp_user1,'') AS push标记 FROM bd_sale_out;
