SET NOCOUNT ON;
WITH keep AS (
  SELECT MIN(r.id) id FROM qc_insp_rec r
  WHERE ISNULL(r.asp_cancel,N'N')<>N'Y' AND EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
   WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,N'N')<>N'Y' AND dt.物料编码=r.物料编码 AND ISNULL(dt.asp_cancel,N'N')<>N'Y')
  GROUP BY r.单据编号)
SELECT (SELECT COUNT(*) FROM keep) keep_n,
       (SELECT COUNT(*) FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,N'N')<>N'Y' AND r.id NOT IN (SELECT id FROM keep)) del_n,
       (SELECT COUNT(*) FROM keep WHERE id=138) has138;
