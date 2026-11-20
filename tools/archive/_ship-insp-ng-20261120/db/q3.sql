SET NOCOUNT ON;
SELECT 'FIELD' AS kind, panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, place, seq, required, hidden, visible, tab_key
FROM yj_field WHERE panel_code IN ('QC_PROC_INSP','QC_ASM_INSP','QC_BHC')
ORDER BY panel_code, seq;
