SET NOCOUNT ON;
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code IN ('QC_PROC_INSP','QC_ASM_INSP');
SELECT ref_key, locale, text FROM yj_translation WHERE scope='panel' AND ref_key LIKE N'出货检验%' ORDER BY ref_key, locale;
SELECT col_name, label, data_type, ref_panel, ref_field, place, seq, visible FROM yj_field WHERE panel_code='QC_BHC' AND col_name IN (N'出货检验单号',N'工单号');
