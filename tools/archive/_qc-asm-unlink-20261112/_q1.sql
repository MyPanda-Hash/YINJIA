SELECT TOP 5 工单号, 批次号, COUNT(*) AS rs, SUM(ISNULL(数量,0)) AS qty
FROM scjl
WHERE ISNULL(工单号,N'')<>N'' AND ISNULL(批次号,N'')<>N''
GROUP BY 工单号, 批次号
ORDER BY 工单号 DESC;

SELECT
  (SELECT COUNT(*) FROM qc_asm_insp_detail WHERE ISNULL(内部批次,N'')<>N'') AS asm_batch_rows,
  (SELECT COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(内部批次,N'')<>N'') AS proc_batch_rows;
