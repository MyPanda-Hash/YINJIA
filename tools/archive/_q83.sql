SET NOCOUNT ON;
UPDATE bd_purchase_in SET asp_user1 = '' WHERE 单据编号 LIKE 'CGRK%';
UPDATE bd_sale_out SET asp_user1 = '' WHERE 单据编号 LIKE 'XSCK%';
SELECT COUNT(*) AS 可推采购入库 FROM bd_purchase_in WHERE 单据编号 LIKE 'CGRK%' AND ISNULL(asp_user1,'')<>'mes-push';
SELECT COUNT(*) AS 可推销售出库 FROM bd_sale_out WHERE 单据编号 LIKE 'XSCK%' AND ISNULL(asp_user1,'')<>'mes-push';
