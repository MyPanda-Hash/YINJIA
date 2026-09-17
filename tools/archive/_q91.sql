SET NOCOUNT ON;
-- 重置推送标记(金蝶端已删,MES 需重新推)
UPDATE bd_purchase_in SET asp_user1 = '', 备注 = CASE WHEN 备注 LIKE N'%[金蝶:%' THEN LEFT(备注, CHARINDEX(N' [金蝶:', 备注) - 1) ELSE 备注 END WHERE 单据编号 LIKE 'CGRK%' AND asp_user1 = 'mes-push';
UPDATE bd_sale_out SET asp_user1 = '', 备注 = CASE WHEN 备注 LIKE N'%[金蝶:%' THEN LEFT(备注, CHARINDEX(N' [金蝶:', 备注) - 1) ELSE 备注 END WHERE 单据编号 LIKE 'XSCK%' AND asp_user1 = 'mes-push';
SELECT 单据编号, 单据状态, ISNULL(asp_user1,'') AS 标记 FROM bd_purchase_in WHERE 单据编号 LIKE 'CGRK%';
