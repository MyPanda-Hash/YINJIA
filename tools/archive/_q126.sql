SET NOCOUNT ON;
-- 清除销售订单数据(头+行)
DELETE FROM bl_so_order;
DELETE FROM bd_so_order;
SELECT N'销售订单已清空' AS r;
