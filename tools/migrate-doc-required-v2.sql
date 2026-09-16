-- migrate-doc-required-v2.sql — 四单据必填项完善(表头+明细行,含"至少一行"校验)
-- 原则:表头=编号/日期/往来单位;明细=存货/数量/单位/单价;自动计算字段不必填
SET NOCOUNT ON;

-- ══ SO_ORDER 销售订单 ══
-- 表头
UPDATE yj_field SET required=1 WHERE panel_code='SO_ORDER' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期', N'客户', N'业务员');
UPDATE yj_field SET required=0 WHERE panel_code='SO_ORDER' AND place LIKE '%header%' AND col_name NOT IN (
  N'单据编号', N'单据日期', N'客户', N'业务员');
-- 明细(输入项必填,计算项不必填)
UPDATE yj_field SET required=1 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'数量', N'销售单位', N'单价');
UPDATE yj_field SET required=0 WHERE panel_code='SO_ORDER' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'折扣金额', N'税额', N'现存量', N'预计交货日期', N'备注');

-- ══ PU_ORDER 采购订单 ══
UPDATE yj_field SET required=1 WHERE panel_code='PU_ORDER' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期', N'供应商', N'币种', N'汇率');
UPDATE yj_field SET required=0 WHERE panel_code='PU_ORDER' AND place LIKE '%header%' AND col_name NOT IN (
  N'单据编号', N'单据日期', N'供应商', N'币种', N'汇率');
UPDATE yj_field SET required=1 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name IN (
  N'物料编码', N'物料名称', N'数量', N'单位', N'单价');
UPDATE yj_field SET required=0 WHERE panel_code='PU_ORDER' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'折扣%', N'折扣金额', N'现存量', N'预计到货日期', N'备注', N'数量2', N'计量单位2');

-- ══ PURCHASE_IN 采购入库 ══
UPDATE yj_field SET required=1 WHERE panel_code='PURCHASE_IN' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期', N'供应商');
UPDATE yj_field SET required=0 WHERE panel_code='PURCHASE_IN' AND place LIKE '%header%' AND col_name NOT IN (
  N'单据编号', N'单据日期', N'供应商');
UPDATE yj_field SET required=1 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'实收数量', N'计量单位', N'单价');
UPDATE yj_field SET required=0 WHERE panel_code='PURCHASE_IN' AND place='detail' AND col_name IN (
  N'税率%', N'含税单价', N'金额', N'含税金额', N'实收数量2', N'计量单位2', N'现存量', N'批号', N'备注');

-- ══ SALE_OUT 销售出库 ══
UPDATE yj_field SET required=1 WHERE panel_code='SALE_OUT' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期', N'客户');
UPDATE yj_field SET required=0 WHERE panel_code='SALE_OUT' AND place LIKE '%header%' AND col_name NOT IN (
  N'单据编号', N'单据日期', N'客户');
UPDATE yj_field SET required=1 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (
  N'存货编码', N'存货名称', N'数量', N'计量单位', N'售价');
UPDATE yj_field SET required=0 WHERE panel_code='SALE_OUT' AND place='detail' AND col_name IN (
  N'税率%', N'含税售价', N'销售金额', N'含税销售金额', N'退货数量', N'现存量', N'批号', N'备注');

GO
-- 自检
SELECT panel_code, place, col_name FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT') AND required=1
ORDER BY panel_code, place, seq;
GO
PRINT N'四单据必填项设置完成';
GO
