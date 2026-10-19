SET NOCOUNT ON;
SELECT id, 单据编号, 单据日期, 单据状态, 供应商, 审核人, 创建时间 = CONVERT(varchar, GETDATE(), 120) FROM sl_recv WHERE 单据编号 IN ('SL-2026-10-0033','SL-2026-10-0032','SL-2026-10-0016','SL-2026-10-0007') ORDER BY 单据编号 DESC, id;
SELECT doc_no, shr, shsj, saved, canceled, archived, update_at FROM yj_doc_status WHERE panel_code='QC_RECV' AND doc_no IN ('SL-2026-10-0033','SL-2026-10-0032','SL-2026-10-0016','SL-2026-10-0007') ORDER BY doc_no DESC;
