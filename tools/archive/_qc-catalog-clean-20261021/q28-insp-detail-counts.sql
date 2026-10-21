SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.单据状态, ISNULL(h.asp_cancel,'N') hcancel, h.暂收单号, h.供应商,
       COUNT(dt.id) detail_all,
       SUM(CASE WHEN dt.id IS NOT NULL AND ISNULL(dt.asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) detail_alive
FROM qc_insp h LEFT JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
GROUP BY h.单据编号,h.单据日期,h.单据状态,h.asp_cancel,h.暂收单号,h.供应商
ORDER BY h.单据编号;
GO
SELECT 'no_detail_any' k, COUNT(*) n FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号)
UNION ALL SELECT 'no_alive_detail', COUNT(*) FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
