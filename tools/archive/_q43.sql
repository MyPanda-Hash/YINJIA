SET NOCOUNT ON;
SELECT panel_code, place, col_name, data_type FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND data_type=N'日期' AND place LIKE '%header%'
ORDER BY panel_code;
-- 也查下哪些 时间 字段还是 文本
SELECT panel_code, place, col_name FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND data_type=N'文本' AND (col_name LIKE N'%时间%' OR col_name LIKE N'%到期%')
ORDER BY panel_code;
