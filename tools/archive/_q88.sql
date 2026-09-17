SET NOCOUNT ON;
UPDATE bd_purchase_in SET asp_user1 = '' WHERE asp_user1 = 'mes-push' AND 单据编号 LIKE 'CGRK%';
UPDATE bd_sale_out SET asp_user1 = '' WHERE asp_user1 = 'mes-push' AND 单据编号 LIKE 'XSCK%';
