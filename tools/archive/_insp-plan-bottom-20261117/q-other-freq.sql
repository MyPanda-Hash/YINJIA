SET NOCOUNT ON;
SELECT 'FIELD' AS kind, panel_code, col_name, data_type, dict_sql
FROM yj_field WHERE panel_code IN (N'QC_ASM_INSP', N'QC_FIRST_INSP', N'QC_PROC_INSP')
  AND (col_name LIKE N'%频率%' OR col_name LIKE N'%应对%') ORDER BY panel_code, col_name;
GO
SELECT 'ASM' AS kind, ISNULL([检查频率], N'(null)') AS v, COUNT(*) n FROM qc_asm_insp_detail GROUP BY [检查频率] ORDER BY n DESC;
GO
SELECT 'FIRST' AS kind, ISNULL([检查频率], N'(null)') AS v, COUNT(*) n FROM qc_first_insp_detail GROUP BY [检查频率] ORDER BY n DESC;
GO
SELECT 'PROC' AS kind, ISNULL([检查频率], N'(null)') AS v, COUNT(*) n FROM qc_proc_insp_detail GROUP BY [检查频率] ORDER BY n DESC;
GO
