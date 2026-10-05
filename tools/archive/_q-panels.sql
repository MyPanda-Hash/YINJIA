SET NOCOUNT ON;
GO
SELECT panel_code, panel_name, panel_name_en, line_table, head_table, prefix, date_col, module_group FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP','PURCHASE_IN');
GO
