SET NOCOUNT ON;
SELECT N'头·采购订单号' AS item, (SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'采购订单号') AS n
UNION ALL SELECT N'商品·检验方式', (SELECT COUNT(*) FROM yj_field WHERE panel_code='INV' AND col_name=N'检验方式')
UNION ALL SELECT N'行·是否来料检验', (SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'是否来料检验');
SELECT TOP 3 l.存货编码, l.是否来料检验 FROM bl_purchase_in l WHERE l.是否来料检验 IS NOT NULL;
