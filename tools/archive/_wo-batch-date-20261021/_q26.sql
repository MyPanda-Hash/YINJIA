SET NOCOUNT ON;
SELECT panel_code, label, col_name, place, seq FROM yj_field
WHERE panel_code IN ('WO_REPORT','WO_REPORT_LIST','FINISH_IN','QC_FIRST_INSP','QC_PROC_INSP','QC_ASM_INSP')
  AND (col_name IN ('批次号','批号','lot_no') OR label LIKE N'%批%')
ORDER BY panel_code, seq;
GO
