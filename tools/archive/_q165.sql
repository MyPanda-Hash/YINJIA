SET NOCOUNT ON;
UPDATE yj_field SET place = N'detail', seq = 44, editable = 0 WHERE panel_code='INV' AND col_name=N'来料检验';
SELECT col_name, place, editable FROM yj_field WHERE panel_code='INV' AND col_name IN (N'来料检验',N'商品类型');
