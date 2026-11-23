SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, code_col, prefix, date_col
FROM yj_panel
WHERE panel_code IN (N'RD_APPROVAL',N'RD_PROD_INFO',N'RD_SAMPLE_EXT',N'RD_SAMPLE_ND');
GO
