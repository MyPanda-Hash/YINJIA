SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 单据状态, ISNULL(asp_cancel,'N') c, 审核人, 审核时间, 审批人, 审批时间, 检验员, 暂收单号
FROM qc_insp ORDER BY 单据编号;
GO
SELECT h.单据编号, s.doc_no, s.shr, s.shsj, s.pending, s.saved, s.archived, s.canceled
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
ORDER BY h.单据编号;
GO
SELECT name FROM sys.tables WHERE name LIKE '%user%' ORDER BY name;
