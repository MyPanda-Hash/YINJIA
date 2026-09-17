SET NOCOUNT ON;
-- 补 asp_time1/asp_time2(脚本插入的记录没经过引擎,补上让增量查询能命中)
UPDATE bd_purchase_in SET asp_time1 = ISNULL(asp_time1, GETDATE()), asp_time2 = ISNULL(asp_time2, GETDATE()) WHERE asp_time2 IS NULL;
UPDATE bd_sale_out SET asp_time1 = ISNULL(asp_time1, GETDATE()), asp_time2 = ISNULL(asp_time2, GETDATE()) WHERE asp_time2 IS NULL;
-- 清推送标记(重新开始)
UPDATE bd_purchase_in SET asp_user1 = '' WHERE 单据编号 LIKE 'CGRK%' OR 单据编号 LIKE 'TEST%';
UPDATE bd_sale_out SET asp_user1 = '' WHERE 单据编号 LIKE 'XSCK%' OR 单据编号 LIKE 'TEST%';
SELECT 单据编号, asp_time2 FROM bd_purchase_in WHERE 单据状态 = N'已审核';
