SET NOCOUNT ON;
-- 修复前置检查:检验方案参照目标、四个字段列、译名现状
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_qc_plan' ORDER BY ORDINAL_POSITION;
GO
SELECT panel_code, panel_name, mode FROM yj_panel WHERE panel_code='QC_PLAN';
GO
SELECT ref_key, locale, text FROM yj_translation WHERE scope='field' AND ref_key IN (N'检验员',N'检验日期',N'检验方案',N'总结论') ORDER BY ref_key, locale;
GO
SELECT COL_LENGTH('dbo.qc_insp', N'检验员') AS c_检验员, COL_LENGTH('dbo.qc_insp', N'检验日期') AS c_检验日期, COL_LENGTH('dbo.qc_insp', N'检验方案') AS c_检验方案, COL_LENGTH('dbo.qc_insp', N'总结论') AS c_总结论;
GO
