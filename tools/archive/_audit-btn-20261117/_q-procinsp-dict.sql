SET NOCOUNT ON;
SELECT panel_code, col_name, data_type, hidden, visible, editable, LEFT(dict_sql, 160) AS dict_sql
FROM yj_field WHERE panel_code = N'QC_PROC_INSP' AND col_name = N'处理方式';
