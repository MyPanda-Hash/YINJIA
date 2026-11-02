SET NOCOUNT ON;
SELECT 'cat_del' k, COUNT(*) n FROM qc_catalog_detail d
WHERE ISNULL(d.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
               WHERE h.单据编号=d.检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
                 AND dt.物料编码=d.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y');
SELECT 'rec_del' k, COUNT(*) n FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
               WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
                 AND dt.物料编码=r.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y');
SELECT 'rec_keep' k, COUNT(*) n FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,'N')<>'Y'
AND EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
           WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
             AND dt.物料编码=r.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y');
