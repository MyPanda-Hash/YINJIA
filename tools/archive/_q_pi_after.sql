SET NOCOUNT ON;
SELECT TOP 6 单据编号, 单据日期, 供应商, 来源单据, 来源单号, 外部单据号, 采购订单号, 单据状态 FROM bd_purchase_in ORDER BY id DESC;
GO
SELECT TOP 8 单据编号, 行号, 存货编码, 实收数量, 计量单位, 单价, 采购订单行号, 源单编号 FROM bl_purchase_in ORDER BY id DESC;
GO
SELECT POSITION=COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_purchase_in' AND COLUMN_NAME IN (N'采购订单行号',N'源单行号',N'行号');
GO
SELECT panel_code, col_name, label, place, hidden, visible FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name IN (N'来源单号',N'来源单据',N'外部单据号',N'源单行号');
GO
