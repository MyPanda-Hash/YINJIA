SET NOCOUNT ON;
SELECT TOP 3 单据编号+N' | 客户名称='+ISNULL(客户名称,N'∅')+N' | 费用='+ISNULL(费用,N'∅')+N' | 期望交期='+ISNULL(期望交期,N'∅')+N' | 申请='+ISNULL(申请,N'∅')+N' | 审核='+ISNULL(审核,N'∅')+N' | 确认='+ISNULL(确认,N'∅')+N' | 进度='+ISNULL(进度描述,N'∅')+N' | 附件='+ISNULL(附件,N'∅') AS r
FROM rd_sample_ext_head ORDER BY id DESC;
GO
SELECT 单据编号+N' 行='+CONVERT(varchar(10),COUNT(*)) AS r FROM rd_sample_ext_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号;
GO
SELECT TOP 6 a.单据编号+N' | 产品整体规格='+ISNULL(a.产品整体规格,N'∅')+N' | 样品数量='+ISNULL(a.样品数量,N'∅') FROM rd_sample_ext_detail a WHERE ISNULL(a.asp_cancel,'N')<>'Y' ORDER BY a.id DESC;
GO
