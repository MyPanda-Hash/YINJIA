USE HSDZ_MES; SET NOCOUNT ON;
SELECT place, seq, col_name, label, data_type, required, editable, visible FROM yj_field
WHERE panel_code = N'RD_PROD_INFO' ORDER BY place, seq;