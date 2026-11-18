SET NOCOUNT ON;
SELECT h.单据编号, h.结果列数, d.检验项, d.结果1, d.结果5, d.结果6, d.结果7, d.结果8
  FROM dbo.qc_insp_rec h
  JOIN dbo.qc_insp_rec_detail d ON d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y'
 WHERE h.单据编号 IN ('JYSJ-2026-11-0007')
 ORDER BY d.id;
