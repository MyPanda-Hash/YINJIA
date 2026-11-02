SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 供应商, 单据状态, ISNULL(asp_cancel,'N') c, 批次号
FROM sl_recv WHERE 单据编号 LIKE 'SL-2026-10-01%' ORDER BY 单据编号;
GO
SELECT doc_no, canceled, saved, pending FROM yj_doc_status WHERE panel_code='QC_RECV' AND doc_no LIKE 'SL-2026-10-01%' ORDER BY doc_no;
