SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.单据状态, ISNULL(h.asp_cancel,'N') hcancel, h.暂收单号,
 COUNT(dt.id) all_n, SUM(CASE WHEN dt.id IS NOT NULL AND ISNULL(dt.asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) alive_n
FROM qc_insp h LEFT JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
GROUP BY h.单据编号,h.单据日期,h.单据状态,h.asp_cancel,h.暂收单号 ORDER BY h.单据编号;
GO
SELECT 'qc_insp' k,COUNT(*) n FROM qc_insp UNION ALL SELECT 'detail',COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'status',COUNT(*) FROM yj_doc_status WHERE panel_code='QC_INSP'
UNION ALL SELECT 'flow',COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' OR target_panel_code='QC_INSP';
GO
SELECT 'bak_head' k,COUNT(*) n FROM _bak_qcinsp_empty_20261021
UNION ALL SELECT 'bak_detail',COUNT(*) FROM _bak_qcinsp_empty_detail_20261021
UNION ALL SELECT 'bak_status',COUNT(*) FROM _bak_qcinsp_empty_status_20261021
UNION ALL SELECT 'bak_flow',COUNT(*) FROM _bak_qcinsp_empty_flow_20261021;
