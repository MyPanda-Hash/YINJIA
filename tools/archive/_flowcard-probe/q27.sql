SET NOCOUNT ON;
SELECT 'qc_first_insp_head' t, COUNT(*) n, MAX(单据日期) mx, MAX(asp_time1) mt FROM qc_first_insp_head
UNION ALL SELECT 'qc_proc_insp_head', COUNT(*), MAX(单据日期), MAX(asp_time1) FROM qc_proc_insp_head
UNION ALL SELECT 'qc_asm_insp_head', COUNT(*), MAX(单据日期), MAX(asp_time1) FROM qc_asm_insp_head;
SELECT panel_code, panel_name, module_group FROM yj_panel WHERE panel_code LIKE 'QC_%';
