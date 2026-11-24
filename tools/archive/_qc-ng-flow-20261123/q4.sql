SET NOCOUNT ON;
SELECT 'QC_PROC_INSP' AS panel, ISNULL([总结论],N'(空)') AS verdict, COUNT(*) AS cnt
  FROM dbo.qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL([总结论],N'(空)')
UNION ALL
SELECT 'QC_ASM_INSP', ISNULL([总结论],N'(空)'), COUNT(*)
  FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL([总结论],N'(空)')
ORDER BY panel, cnt DESC;
-- 表观单据里「结果判断/内部批次判断」判过不合格的有多少(只判了行、没改总结论的情况)
SELECT COUNT(*) AS asm_rows_ng FROM dbo.qc_asm_insp_detail WHERE ISNULL([结果判断],N'')=N'不合格' AND ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS proc_rows_ng FROM dbo.qc_proc_insp_detail WHERE ISNULL([结果判断],N'')=N'不合格' AND ISNULL(asp_cancel,'N')<>'Y';
