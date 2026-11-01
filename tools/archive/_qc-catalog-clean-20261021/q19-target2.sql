SET NOCOUNT ON;
CREATE TABLE #keep (id int PRIMARY KEY);
INSERT #keep SELECT MIN(r.id) FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,N'N')<>N'Y' AND EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
 WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,N'N')<>N'Y' AND dt.物料编码=r.物料编码 AND ISNULL(dt.asp_cancel,N'N')<>N'Y')
GROUP BY r.单据编号;
SELECT COUNT(*) keep_n FROM #keep;
SELECT r.id, r.单据编号 FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,N'N')<>N'Y' AND r.id NOT IN (SELECT id FROM #keep) AND r.id IN (52,138,140);
