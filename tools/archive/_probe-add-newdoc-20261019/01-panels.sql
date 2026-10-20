SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, code_col, prefix, date_col FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP');
