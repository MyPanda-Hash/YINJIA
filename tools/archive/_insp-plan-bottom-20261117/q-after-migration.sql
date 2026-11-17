SET NOCOUNT ON;
SELECT 'LIB' AS kind, lib_code, item_code, content, enabled, seq
FROM yj_std_lib WHERE lib_code IN (N'INSP_FREQ_OQC', N'INSP_FREQ') ORDER BY lib_code, seq;
GO
SELECT 'FIELD' AS kind, panel_code, col_name, data_type, dict_sql
FROM yj_field WHERE col_name IN (N'检测频率', N'检查频率') ORDER BY panel_code;
GO
SELECT 'LOG' AS kind, script_name, applied_at FROM yj_schema_log
 WHERE script_name LIKE N'%insp-freq-oqc%';
GO
