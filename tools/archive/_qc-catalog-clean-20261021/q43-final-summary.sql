SET NOCOUNT ON;
SELECT 'qc_insp 总' k, COUNT(*) n FROM qc_insp
UNION ALL SELECT 'qc_insp 未作废', COUNT(*) FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_insp 无未作废明细(应0)', COUNT(*) FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
   AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')
UNION ALL SELECT 'qc_insp_detail', COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'qc_catalog_detail 有效', COUNT(*) FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'qc_insp_rec 有效', COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'QC_INSP 状态孤儿', COUNT(*) FROM yj_doc_status s WHERE s.panel_code='QC_INSP'
   AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=s.doc_no);
