SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME='bd_finish_in' AND COLUMN_NAME IN (N'出货检验功能单号',N'出货检验表观单号');
SELECT label, data_type, ref_panel, ref_field, display_field, place, seq, required, hidden, visible FROM yj_field
 WHERE panel_code='FINISH_IN' AND label IN (N'出货检验功能单号',N'出货检验表观单号') ORDER BY seq;
SELECT ref_key, COUNT(*) AS n, STRING_AGG(locale, ',') AS locales FROM yj_translation
 WHERE scope='field' AND ref_key IN (N'出货检验功能单号',N'出货检验表观单号') GROUP BY ref_key;
