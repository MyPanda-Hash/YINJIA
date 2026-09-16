SET NOCOUNT ON;
-- KHDA/GFDA/INV/WH 的 query 字段(参照下拉的取值列)
SELECT panel_code, col_name, label, place FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','WH') AND place LIKE '%query%'
ORDER BY panel_code, seq;
-- PARTNER 面板还在吗
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code IN ('PARTNER','KHDA','GFDA');
