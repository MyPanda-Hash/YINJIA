SET NOCOUNT ON;
SELECT TOP 8 h.单据编号, ISNULL(h.总结论,N'') AS v, COUNT(d.id) AS rows_
FROM qc_proc_insp_head h LEFT JOIN qc_proc_insp_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(h.总结论,N'')=''
GROUP BY h.单据编号, h.总结论
HAVING COUNT(d.id) > 0
ORDER BY h.单据编号 DESC;
