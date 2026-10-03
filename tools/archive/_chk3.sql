SET NOCOUNT ON
SELECT CAST(COUNT(*) AS varchar)+'/7 补齐' FROM (VALUES ('INV',N'最新成本'),('UOM',N'换算率'),('PU_ORDER',N'数量2'),('PU_ORDER',N'计量单位2'),('STOCK_STATUS',N'预警数量'),('DEPT',N'电话'),('WH',N'联系人')) v(p,c) WHERE EXISTS(SELECT 1 FROM yj_field f WHERE f.panel_code=v.p AND f.col_name=v.c)
