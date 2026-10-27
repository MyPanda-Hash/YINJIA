SET NOCOUNT ON;
SELECT panel_code, seq, col_name, label, alias, data_type, ref_panel, ref_field,
       LEFT(ISNULL(dict_sql,''), 70) AS dict_sql, place, visible, hidden, editable
FROM yj_field
WHERE panel_code IN ('RD_MOLD_PROC','RD_PROD_INFO')
ORDER BY panel_code, seq, id;
