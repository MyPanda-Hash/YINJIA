SET NOCOUNT ON;
SELECT DB_NAME() db;
SELECT TOP 4 [单据编号],[工单号],[工单行号],[工单行id] FROM dbo.v_qc_asm_insp_detail ORDER BY [单据日期] DESC;
SELECT COUNT(*) total_rows,
       SUM(CASE WHEN [工单行id] IS NULL THEN 1 ELSE 0 END) null_line,
       COUNT(DISTINCT [单据编号] + '#' + CAST([工单行号] AS varchar(20))) distinct_lines
  FROM dbo.v_qc_asm_insp_detail;
SELECT COUNT(*) total_rows, SUM(CASE WHEN [工单行id] IS NULL THEN 1 ELSE 0 END) null_line FROM dbo.v_qc_proc_insp_detail;
