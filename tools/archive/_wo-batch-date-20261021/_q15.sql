SET NOCOUNT ON;
SELECT TOP 100 panel_code, label, place, data_type, seq FROM yj_field
WHERE panel_code IN ('WO_REPORT','WO_REPORT_LIST','QC_FIRST_INSP','QC_PROC_INSP','QC_ASM_INSP','FINISH_IN','WO_COMPLETION_LIST')
  AND (label LIKE N'%日期%' OR label LIKE N'%时间%') ORDER BY panel_code, seq;
GO
