SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 单据状态, 供应商 FROM sl_recv WHERE 单据编号 IN ('SL-2026-10-0034','SL-2026-10-0131') ORDER BY 单据编号;
SELECT doc_no, shr, shsj, saved, archived, canceled FROM yj_doc_status WHERE panel_code='QC_RECV' AND doc_no IN ('SL-2026-10-0034','SL-2026-10-0131','SL-2026-10-0033');
