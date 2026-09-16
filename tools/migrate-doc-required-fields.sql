-- migrate-doc-required-fields.sql — 四单据必填项与自动计算字段设置
-- 原则:
--   必填(required=1) = 用户必须手工输入的(编号/日期/往来/存货/数量/单位/单价/售价)
--   不必填(required=0) = 自动计算的(金额/含税单价/含税金额/税额/折扣金额/总重)
SET NOCOUNT ON;

-- ══ SO_ORDER 销售订单 ══
-- 表头必填:已有(单据编号/日期/客户)
-- 明细必填:输入项(存货/数量/单位/单价)
UPDATE yj_field SET required=1 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'数量', N'销售单位', N'单价');
-- 明细不必填:自动计算项
UPDATE yj_field SET required=0 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'折扣金额', N'税额', N'现存量');

-- ══ PU_ORDER 采购订单 ══
-- 已有很好的必填集,补充确认
UPDATE yj_field SET required=1 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name IN (
  N'物料编码', N'物料名称', N'数量', N'单位', N'单价');
UPDATE yj_field SET required=0 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'折扣%', N'折扣金额', N'现存量', N'数量2', N'计量单位2');

-- ══ PURCHASE_IN 采购入库 ══
UPDATE yj_field SET required=1 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'实收数量', N'计量单位', N'单价');
UPDATE yj_field SET required=0 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'实收数量2', N'计量单位2', N'现存量', N'批号');

-- ══ SALE_OUT 销售出库 ══
UPDATE yj_field SET required=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'数量', N'计量单位', N'售价');
UPDATE yj_field SET required=0 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (
  N'税率%', N'含税售价', N'销售金额', N'含税销售金额', N'退货数量', N'现存量', N'批号');

GO
-- 自检:各面板必填字段
SELECT panel_code, place, col_name, label FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT') AND required=1
ORDER BY panel_code, place, seq;
GO
PRINT N'必填项设置完成';
GO
