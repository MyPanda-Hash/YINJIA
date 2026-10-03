SET NOCOUNT ON;
SELECT '用「标准库」类型的字段' AS t, panel_code, col_name, label, dict_sql, place, editable
FROM yj_field WHERE data_type = N'标准库' ORDER BY panel_code, place, seq;
SELECT 'QC_INSP_REC 字段' AS t, col_name, label, data_type, dict_sql, place, seq, visible
FROM yj_field WHERE panel_code = 'QC_INSP_REC' ORDER BY place, seq;
SELECT 'qc_insp_rec_detail 列' AS t, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('qc_insp_rec_detail') ORDER BY c.column_id;
SELECT 'qc_insp_rec 行数' AS t, COUNT(*) AS n FROM qc_insp_rec;
SELECT 'qc_insp_rec_detail 行数' AS t, COUNT(*) AS n FROM qc_insp_rec_detail;
SELECT 'qc_catalog_detail 行数' AS t, COUNT(*) AS n FROM qc_catalog_detail;
SELECT '检验项目相关字段(全库)' AS t, panel_code, col_name, label, data_type, place FROM yj_field
WHERE label LIKE N'%检验项目%' OR col_name LIKE N'%检验项目%' ORDER BY panel_code, place, seq;
