SET NOCOUNT ON;
SELECT 单据编号+N' | 客户名称='+ISNULL(客户名称,N'∅')+N' | 费用='+ISNULL(费用,N'∅')+N' | 期望交期='+ISNULL(期望交期,N'∅')+N' | 单据日期='+ISNULL(单据日期,N'∅')+N' | 申请='+ISNULL(申请,N'∅')+N' | 审核='+ISNULL(审核,N'∅')+N' | 确认='+ISNULL(确认,N'∅')+N' | 进度描述='+ISNULL(进度描述,N'∅')+N' | 备注='+ISNULL(备注,N'∅') AS r
FROM rd_sample_ext_head WHERE 单据编号 IN (N'SPW-2026-11-0008',N'admin-2026-11-23-02');
GO
SELECT 单据编号+N' | 产品整体规格='+ISNULL(产品整体规格,N'∅')+N' | 炭棒规格='+ISNULL(炭棒规格,N'∅')+N' | 样品数量='+ISNULL(样品数量,N'∅')+N' | 组装要求='+ISNULL(组装要求,N'∅') AS r FROM rd_sample_ext_detail WHERE 单据编号 IN (N'SPW-2026-11-0008',N'admin-2026-11-23-02') ORDER BY 单据编号, id;
GO
SELECT doc_no+N' saved='+ISNULL(saved,N'∅')+N' pending='+ISNULL(pending,N'∅')+N' archived='+ISNULL(archived,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_SAMPLE_EXT' AND doc_no IN (N'SPW-2026-11-0008',N'admin-2026-11-23-02');
GO
