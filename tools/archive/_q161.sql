SET NOCOUNT ON;
-- ① 采购入库行·是否来料检验 改只读(商品档案联动,不可编辑)
UPDATE yj_field SET editable = 0, dict_sql = NULL
WHERE panel_code='PURCHASE_IN' AND col_name=N'是否来料检验';
-- ② 商品档案·检验方式 也改只读(存金蝶check_type,档案以金蝶为准本地不编辑)
UPDATE yj_field SET editable = 0
WHERE panel_code='INV' AND col_name=N'检验方式';
-- ③ 商品档案·是否来料检验 默认显示(此前hidden=1,改hidden=0便于档案页直接看)
UPDATE yj_field SET hidden = 0
WHERE panel_code='INV' AND col_name=N'是否来料检验';
SELECT panel_code, col_name, editable, hidden FROM yj_field WHERE (panel_code='PURCHASE_IN' AND col_name=N'是否来料检验') OR (panel_code='INV' AND col_name IN (N'检验方式',N'是否来料检验'));
