SET NOCOUNT ON;
SELECT panel_code, col_name, data_type, ref_panel, ref_field, display_field, place FROM yj_field
WHERE panel_code='STOCK_SUMMARY' AND col_name IN (N'仓库',N'存货');
