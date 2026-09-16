-- migrate-hide-empty-fields.sql — 隐藏已显示但当前数据全空的字段(50条沙箱测试数据口径)
-- 数据同步到正式环境后金蝶有值会自动填回来;用户可通过 表格调整/表头调整 勾选恢复
SET NOCOUNT ON;

-- ══ SO_ORDER(行)══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'SO_ORDER' AND col_name IN (
  N'图片url', N'商品助记码', N'仓库id', N'仓库名称', N'仓库编码', N'仓位id', N'仓位名称', N'仓位编码',
  N'辅助属性id', N'辅助属性名称', N'辅助属性编码',
  N'辅助属性1id', N'辅助属性1名称', N'辅助属性1编码',
  N'辅助属性2id', N'辅助属性2名称', N'辅助属性2编码',
  N'辅助属性3id', N'辅助属性3名称', N'辅助属性3编码',
  N'条形码', N'换算公式', N'批次号', N'产地', N'注册证号', N'生产许可证号', N'生产日期', N'有效日期',
  N'序列号格式', N'辅助单位id', N'辅助单位名称', N'辅助单位编码',
  N'源单id', N'源单id_src_bill_no', N'源单类型id', N'源单类型名称', N'源单类型编码', N'源单日期',
  N'外部商品编码', N'外部商品单位');

-- ══ SO_ORDER(头)══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'SO_ORDER' AND col_name IN (
  N'币种', N'结算状态', N'交货方式', N'发货人', N'发货联系电话', N'发货地址');

-- ══ PU_ORDER ══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'PU_ORDER' AND col_name IN (
  N'结算期限', N'备注', N'交货方式', N'仓库编码', N'条形码', N'源单类型名称', N'供应商商品编码');

-- ══ KHDA(客户)══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'KHDA' AND col_name IN (
  N'khjb', N'sui_no', N'bank', N'email', N'bz', N'价格等级编码', N'开票名称',
  N'创建人', N'收票邮箱', N'收票手机号', N'开户地址',
  N'联系人邮箱', N'联系人生日', N'联系人QQ', N'联系人微信');

-- ══ GFDA(供应商)══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'GFDA' AND col_name IN (
  N'addr', N'sui_no', N'开票名称', N'开户地址',
  N'供应商联系人座机', N'供应商联系人邮箱', N'供应商联系人地址');

-- ══ INV(商品)══
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = 'INV' AND col_name IN (
  N'条形码', N'品牌', N'建档日期', N'产地', N'保质期单位', N'生产许可证', N'注册证号',
  N'默认生产车间编码', N'倒冲仓库名称', N'倒冲仓库编码', N'倒冲仓位名称',
  N'最近成交供应商', N'品牌编码', N'默认仓库', N'默认仓库编码', N'多单位', N'图片链接');

GO
-- 自检
SELECT panel_code, COUNT(*) AS 显示 FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','KHDA','GFDA','INV')
  AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-hide-empty-fields 完成';
GO
