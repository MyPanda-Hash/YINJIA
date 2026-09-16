SET NOCOUNT ON;
DELETE FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name IN (
  N'存货图片', N'产成品图片', N'换算率', N'单价2', N'含税单价2',
  N'费用调整', N'费用金额', N'现存量说明', N'计量单位组合',
  N'币种', N'资金批次', N'合同号最新', N'业务类型', N'入库类别',
  N'供应商简称', N'匹配来源单号', N'项目', N'验货人', N'外部单据号',
  N'采购订单号', N'来源单据', N'合同号', N'来源单号', N'销售订单号', N'采购类型');
DELETE FROM yj_field WHERE panel_code='SALE_OUT' AND col_name IN (
  N'存货图片', N'产成品图片', N'换算率', N'单价2', N'含税单价2',
  N'费用调整', N'费用金额', N'现存量说明', N'计量单位组合',
  N'币种', N'资金批次', N'合同号最新', N'业务类型',
  N'供应商简称', N'匹配来源单号', N'项目', N'验货人', N'外部单据号',
  N'采购订单号', N'来源单据', N'合同号', N'来源单号', N'销售订单号', N'采购类型');
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
  AND (label LIKE '%[a-z]%' OR label LIKE '%[A-Z]%')
  AND label NOT LIKE N'%[%]%'
ORDER BY panel_code;
