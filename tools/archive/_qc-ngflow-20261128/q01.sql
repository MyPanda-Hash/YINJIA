SELECT panel_code, panel_name, category, mode, head_table, line_table, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel
WHERE panel_code IN (N'QC_RECV', N'QC_INSP', N'QC_INSP_REC', N'QC_RETURN', N'QC_TC_IN', N'PURCHASE_IN', N'QC_FLOW')
ORDER BY panel_code;
GO
SELECT TOP 80 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_field') ORDER BY column_id;
