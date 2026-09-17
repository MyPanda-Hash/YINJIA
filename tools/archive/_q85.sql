SET NOCOUNT ON;
UPDATE bd_purchase_in SET asp_user1 = '' WHERE 单据编号 LIKE 'CGRK%' AND asp_user1 = 'mes-push';
UPDATE bd_sale_out SET asp_user1 = '' WHERE 单据编号 LIKE 'XSCK%';
