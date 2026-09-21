SET NOCOUNT ON;
SELECT panel_code, panel_name, panel_name_en FROM yj_panel WHERE panel_code='QC_TC_IN';
GO
SELECT scope, ref_key, locale, text, source FROM yj_translation WHERE ref_key IN (N'特采单', N'管控使用');
GO
