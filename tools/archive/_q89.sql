SET NOCOUNT ON;
-- 重置推送标记(清除备注里的金蝶标记也一并清)
UPDATE bd_purchase_in SET asp_user1 = '', 备注 = REPLACE(REPLACE(备注, N' [金蝶:CGRK-20260916-00003]', ''), N' [金蝶:CGRK-20260916-00006]', '') WHERE 单据编号 LIKE 'CGRK%';
UPDATE bd_purchase_in SET 备注 = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(备注, N' [金蝶:CGRK-20260916-00003]', ''), N' [金蝶:CGRK-20260916-00004]', ''), N' [金蝶:CGRK-20260916-00005]', ''), N' [金蝶:CGRK-20260916-00006]', ''), N' [金蝶:CGRK-20260916-00007]', ''), N' [金蝶:CGRK-20260916-00008]', ''), N' [金蝶:CGRK-20260916-00009]', ''), N' [金蝶:CGRK-20260916-00010]', ''), N' [金蝶:CGRK-20260916-00013]', ''), N' [金蝶:CGRK-20260916-00014]', ''), N' [金蝶:CGRK-20260916-00015]', '')
WHERE 单据编号 LIKE 'CGRK%';
UPDATE bd_sale_out SET asp_user1 = '', 备注 = '' WHERE 单据编号 LIKE 'XSCK%';
SELECT 单据编号, LEFT(ISNULL(备注,''),20) AS 备注, ISNULL(asp_user1,'') AS 标记 FROM bd_purchase_in WHERE 单据编号 LIKE 'CGRK%';
