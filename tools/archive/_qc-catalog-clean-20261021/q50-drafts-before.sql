SET NOCOUNT ON;
SELECT h.单据编号, s.doc_no, s.shr, s.pending, s.approve_node, s.saved,
       (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.合格数量,0)>0) pass_lines
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.单据编号;
