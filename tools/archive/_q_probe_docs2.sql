SET NOCOUNT ON;
PRINT '== yj_doc_status 列 ==';
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_doc_status') ORDER BY c.column_id;
PRINT '== 测试账套:制程检验单头(最近 12 张) ==';
SELECT TOP 12 h.单据编号, h.单据日期, ISNULL(h.asp_cancel, N'N') AS 头作废,
       (SELECT COUNT(*) FROM qc_proc_insp_detail d WHERE d.单据编号 = h.单据编号) AS 明细行
FROM qc_proc_insp_head h ORDER BY h.单据编号 DESC;
GO
