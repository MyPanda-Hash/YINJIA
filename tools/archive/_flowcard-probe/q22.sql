SET NOCOUNT ON;
SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_ASM_INSP','QC_MOLD_INSP','QC_CUT_INSP');
SELECT 'qc_first_insp_head' t, COUNT(*) n FROM sys.tables WHERE name='qc_first_insp_head'
UNION ALL SELECT 'qc_proc_insp_head', COUNT(*) FROM sys.tables WHERE name='qc_proc_insp_head'
UNION ALL SELECT 'qc_asm_insp_head', COUNT(*) FROM sys.tables WHERE name='qc_asm_insp_head';
SELECT 'qc_first_insp_detail 不合格数量' c, COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('qc_first_insp_detail') AND name IN (N'不合格数量',N'不良数量')
UNION ALL SELECT 'qc_proc_insp_detail 不合格数量', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('qc_proc_insp_detail') AND name IN (N'不合格数量',N'不良数量');
