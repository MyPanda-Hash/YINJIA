-- migrate-hide-junk-fields.sql — 隐藏英文标签字段 + 全是 false/0 的布尔字段
-- 口径:①标签含英文字母(id/src_bill_no 等)且无业务含义 → 隐藏
--      ②布尔字段在已同步的 50 条中全为 0/false → 隐藏(金蝶有真值后可勾选恢复)
SET NOCOUNT ON;

-- ══ 1) 英文标签字段 ══
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'GFDA' AND col_name = N'group_id';
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'KHDA' AND col_name IN (
  N'价格等级-id', N'国家-id', N'省-id', N'市-id', N'区-id', N'部门-id', N'类别-id', N'业务员-id',
  N'结算期限id', N'结算客户id');
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'SO_ORDER' AND col_name IN (
  N'商品id', N'基本单位id', N'单位id', N'序列号流转ID', N'源单id_src_inter_id', N'源单分录id',
  N'单据整单折前价税合计_bill_dis_before_amount');

-- ══ 2) 布尔字段全是 0/false 的 ══
-- INV(商品):50条全 false 的
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'INV' AND col_name IN (
  N'是否启用保质期', N'是否启用辅助属性', N'是否启用称重', N'是否序列号管理', N'是否自制', N'是否倒冲领料');
-- KHDA(客户):自动抵扣预付款 全 false
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'KHDA' AND col_name = N'自动抵扣预收款';
-- GFDA(供应商):同上
UPDATE yj_field SET hidden = 1, visible = 0 WHERE panel_code = 'GFDA' AND col_name = N'自动抵扣预收款';

GO
SELECT panel_code, COUNT(*) AS 显示 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','KHDA','GFDA','INV')
  AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-hide-junk-fields 完成';
GO
