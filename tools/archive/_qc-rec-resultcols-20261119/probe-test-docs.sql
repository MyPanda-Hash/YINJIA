SET NOCOUNT ON;
SELECT TOP 20 h.单据编号, h.物料编码, h.结果列数, ISNULL(s.pending,'N') AS pending, s.shr, h.asp_time1
  FROM dbo.qc_insp_rec h
  LEFT JOIN dbo.yj_doc_status s ON s.doc_no = h.单据编号
 ORDER BY h.asp_time1 DESC;
