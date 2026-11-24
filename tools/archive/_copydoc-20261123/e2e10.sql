SET NOCOUNT ON;
SELECT 'HEAD new | 客户名称='+ISNULL(客户名称,N'∅')+N' | 费用='+ISNULL(费用,N'∅')+N' | 期望交期='+ISNULL(期望交期,N'∅')+N' | 申请='+ISNULL(申请,N'∅')+N' | 审核='+ISNULL(审核,N'∅')+N' | 确认='+ISNULL(确认,N'∅')+N' | 备注='+ISNULL(备注,N'∅')+N' | 进度描述='+ISNULL(进度描述,N'∅') AS r
FROM rd_sample_nondev_head WHERE 单据编号=N'SPN2-2026-11-0002';
GO
SELECT 'DETAIL new | '+ISNULL(产品编码,N'∅')+' / '+ISNULL(样品数量,N'∅') AS r FROM rd_sample_nondev_detail WHERE 单据编号=N'SPN2-2026-11-0002';
GO
SELECT 'STATUS new | saved='+ISNULL(saved,N'∅')+N' pending='+ISNULL(pending,N'∅')+N' archived='+ISNULL(archived,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_SAMPLE_ND' AND doc_no=N'SPN2-2026-11-0002';
GO
