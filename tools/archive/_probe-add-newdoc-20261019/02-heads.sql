SET NOCOUNT ON;
SELECT 单据编号, 单据日期 FROM sl_recv ORDER BY 单据编号 DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY;
SELECT s.单据编号, s.canceled, s.shr, s.archived, s.pending, s.saved FROM yj_doc_status s WHERE s.panel_code='QC_RECV' ORDER BY s.doc_no DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY;
