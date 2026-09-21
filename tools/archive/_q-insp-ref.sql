SET NOCOUNT ON;
PRINT '=== QC_INSP(来料检验单)供应商类字段参照口径 ===';
SELECT seq, col_name, label, data_type, ref_panel, ref_field, display_field
FROM yj_field WHERE panel_code='QC_INSP' ORDER BY seq;
GO
