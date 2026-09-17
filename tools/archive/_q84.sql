SET NOCOUNT ON;
UPDATE bd_purchase_in SET asp_user1 = '' WHERE 单据编号 LIKE 'CGRK%' AND ISNULL(asp_user1,'')='mes-push' AND 单据编号 <> 'CGRK-20260916-03215';
UPDATE bd_sale_out SET asp_user1 = '' WHERE 单据编号 LIKE 'XSCK%';
