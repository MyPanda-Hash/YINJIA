SET NOCOUNT ON;
SELECT panel_code, col_name, place, hidden, visible FROM yj_field WHERE (panel_code='INV' AND col_name IN (N'检验方式',N'是否来料检验')) OR (panel_code='PURCHASE_IN' AND col_name IN (N'采购订单号',N'是否来料检验')) ORDER BY panel_code, seq;
SELECT TOP 2 存货编码, 检验方式, 是否来料检验 FROM bs_inv;
