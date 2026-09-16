SET NOCOUNT ON;
-- 测试数据状态修正:金蝶 bill_status=C(已审核)→ MES 单据状态 同步为 已审核
UPDATE bd_purchase_in SET 单据状态 = N'已审核' WHERE 单据状态2 = 'C' AND 单据状态 = N'草稿';
UPDATE bd_sale_out SET 单据状态 = N'已审核' WHERE 单据状态2 = 'C' AND 单据状态 = N'草稿';
-- 顺带补出库行的数量(金蝶接口有值但插入时漏写)
UPDATE bl_sale_out SET 数量 = 300 WHERE 单据编号='XSCK-20270901-00001' AND 存货名称=N'A级烧结炭棒/滤芯' AND 数量 IS NULL;
UPDATE bl_sale_out SET 数量 = 200 WHERE 单据编号='XSCK-20270901-00001' AND 存货名称=N'X烧结炭棒/滤芯' AND 数量 IS NULL;
-- 补采购入库行金额
UPDATE bl_purchase_in SET 金额 = 1000 WHERE 单据编号='CGRK-20260915-03213' AND 存货名称=N'端盖' AND 金额 IS NULL;
SELECT 'bd_purchase_in' AS t, 单据编号, 单据状态 FROM bd_purchase_in;
SELECT 'bd_sale_out' AS t, 单据编号, 单据状态 FROM bd_sale_out;
-- 库存状况表复核
SELECT 仓库, LEFT(存货,14) AS 存货, 现存量, 结存金额 FROM v_stock_balance;
