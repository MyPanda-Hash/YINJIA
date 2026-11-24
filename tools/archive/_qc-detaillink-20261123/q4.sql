SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, line_table, head_table, code_col, pk_col, date_col FROM yj_panel WHERE panel_code IN ('QC_ASM_INSP','QC_PROC_INSP','QC_ASM_INSP_DETAIL','QC_PROC_INSP_DETAIL','WORK_ORDER_LIST');
