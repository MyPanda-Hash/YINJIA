SET NOCOUNT ON;
SELECT N'--- 源 SPW-2026-11-0008 ---' AS r;
GO
SELECT 单据编号+N' | 客户名称='+ISNULL(客户名称,N'∅')+N' | 申请='+ISNULL(申请,N'∅')+N' | 审核='+ISNULL(审核,N'∅')+N' | 确认='+ISNULL(确认,N'∅')+N' | 单据日期='+ISNULL(单据日期,N'∅')+N' | asp_user1='+ISNULL(asp_user1,N'∅') AS r FROM rd_sample_ext_head WHERE 单据编号 IN (N'SPW-2026-11-0008',N'admin-2026-11-23-01');
GO
SELECT 单据编号+N' | 产品整体规格='+ISNULL(产品整体规格,N'∅')+N' | 炭棒规格='+ISNULL(炭棒规格,N'∅')+N' | 样品数量='+ISNULL(样品数量,N'∅')+N' | asp_cancel='+ISNULL(asp_cancel,N'∅') AS r FROM rd_sample_ext_detail WHERE 单据编号 IN (N'SPW-2026-11-0008',N'admin-2026-11-23-01');
GO
SELECT doc_no+N' saved='+ISNULL(saved,N'∅')+N' pending='+ISNULL(pending,N'∅')+N' archived='+ISNULL(archived,N'∅')+N' canceled='+ISNULL(canceled,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_SAMPLE_EXT' AND doc_no IN (N'SPW-2026-11-0008',N'admin-2026-11-23-01');
GO
