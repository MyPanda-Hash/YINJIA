SET NOCOUNT ON;
PRINT '=== 工序质检单:是否绑定工单号 ===';
SELECT 'QC_MOLD_INSP' AS panel, COUNT(*) AS rows_cnt, SUM(CASE WHEN ISNULL(工单号,N'')<>N'' THEN 1 ELSE 0 END) AS with_wo FROM dbo.qc_mold_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_CUT_INSP', COUNT(*), SUM(CASE WHEN ISNULL(工单号,N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.qc_cut_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_ASM_INSP', COUNT(*), SUM(CASE WHEN ISNULL(工单号,N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_FIRST_INSP', COUNT(*), SUM(CASE WHEN ISNULL(工单号,N'')<>N'' THEN 1 ELSE 0 END) FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y';
PRINT '=== 追溯入口面板 ===';
SELECT panel_code, panel_name FROM dbo.yj_panel WHERE panel_name LIKE N'%追溯%' OR panel_name LIKE N'%批号%' OR panel_code LIKE N'%TRACE%' ORDER BY panel_code;
