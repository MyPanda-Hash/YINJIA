SET NOCOUNT ON;
SELECT r.id, r.单据编号, r.物料编码, r.来料检验单号, r.来料数量, r.物料批次
FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,'')<>''
  AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y')
ORDER BY r.id;
GO
SELECT 'target_cnt' k, COUNT(*) n FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,'N')<>'Y'
AND (ISNULL(r.来料检验单号,'')='' OR NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'));
