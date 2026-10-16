SET NOCOUNT ON;
PRINT '== 测试账套里制程检验单的探针遗留单 ==';
SELECT h.单据编号, h.单据日期, ISNULL(s.status, N'草稿') AS 状态, ISNULL(s.shr, N'') AS 审核人,
       ISNULL(h.asp_cancel, N'N') AS 头作废,
       (SELECT COUNT(*) FROM qc_proc_insp_detail d WHERE d.单据编号 = h.单据编号) AS 明细行
FROM qc_proc_insp_head h
LEFT JOIN yj_doc_status s ON s.panel_code = N'QC_PROC_INSP' AND s.doc_no = h.单据编号
ORDER BY h.单据编号 DESC;
GO
