SET NOCOUNT ON;
DECLARE @d TABLE(no nvarchar(60) PRIMARY KEY);
INSERT @d SELECT h.单据编号 FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
SELECT 'modify_log' k, COUNT(*) n FROM yj_doc_modify_log l JOIN @d d ON d.no=l.doc_no WHERE l.panel_code='QC_INSP'
UNION ALL SELECT 'archive_log', COUNT(*) FROM yj_archive_change_log l JOIN @d d ON d.no=l.doc_no WHERE l.panel_code='QC_INSP'
UNION ALL SELECT 'catalog_ref', COUNT(*) FROM qc_catalog_detail c JOIN @d d ON d.no=c.检验单号
UNION ALL SELECT 'rec_ref', COUNT(*) FROM qc_insp_rec r JOIN @d d ON d.no=r.来料检验单号;
