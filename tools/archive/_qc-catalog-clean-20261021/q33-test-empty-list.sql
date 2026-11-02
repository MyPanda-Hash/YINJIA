SET NOCOUNT ON;
SELECT h.单据编号, h.单据状态, ISNULL(h.asp_cancel,'N') hcancel, h.暂收单号,
 (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号=h.单据编号) all_n,
 (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') alive_n
FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
ORDER BY h.单据编号;
