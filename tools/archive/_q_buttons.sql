SET NOCOUNT ON;
PRINT '== A. QC_PROC_INSP 的按钮 ==';
SELECT id, panel_code, button_name, button_type, seq, group_name, param, remark
FROM dbo.yj_panel_button WHERE panel_code = N'QC_PROC_INSP' ORDER BY seq, id;

PRINT '== B. 有「审核」按钮的面板(前 15) ==';
SELECT TOP 15 panel_code, button_name, button_type, seq FROM dbo.yj_panel_button
WHERE button_name IN (N'审核', N'弃审', N'反审核') ORDER BY panel_code, button_name;

PRINT '== C. QC_PROC_INSP 面板行 ==';
SELECT panel_code, panel_name, mode, table_name, detail_table, code_field, id_field, prefix,
       module_group, state_field, config
FROM dbo.yj_panel WHERE panel_code = N'QC_PROC_INSP';

PRINT '== D. 同类检验单(成品/首件/工序)的按钮对照 ==';
SELECT panel_code, button_name, button_type, seq FROM dbo.yj_panel_button
WHERE panel_code IN (N'QC_ASM_INSP', N'QC_FIRST_INSP', N'QC_MOLD_INSP', N'QC_CUT_INSP')
ORDER BY panel_code, seq, id;
GO
