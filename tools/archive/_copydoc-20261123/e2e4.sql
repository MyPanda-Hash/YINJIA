SET NOCOUNT ON;
SELECT 单据编号+N' | 客户名='+ISNULL(客户名,N'∅')+N' | 客户编号='+ISNULL(客户编号,N'∅')+N' | 文档编号='+ISNULL(文档编号,N'∅')+N' | 申请立项人='+ISNULL(申请立项人,N'∅')+N' | 申请立项日期='+ISNULL(申请立项日期,N'∅')+N' | 项目等级='+ISNULL(项目等级,N'∅')+N' | 备用1='+ISNULL(备用1,N'∅')+N' | 附件1='+ISNULL(附件1,N'∅')+N' | 密级='+ISNULL(密级,N'∅') AS r
FROM rd_approval WHERE 单据编号 IN (N'LXA-2026-11-0031',N'LXA-2026-11-0033');
GO
SELECT doc_no+N' saved='+ISNULL(saved,N'∅')+N' pending='+ISNULL(pending,N'∅')+N' archived='+ISNULL(archived,N'∅')+N' canceled='+ISNULL(canceled,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_APPROVAL' AND doc_no IN (N'LXA-2026-11-0031',N'LXA-2026-11-0033');
GO
SELECT TOP 5 单据编号+N' | 产品编号='+ISNULL(产品编号,N'∅')+N' | 产品名称='+ISNULL(产品名称,N'∅')+N' | 客户名称='+ISNULL(客户名称,N'∅')+N' | 审核人一级='+ISNULL(审核人一级,N'∅')+N' | 审核人二级='+ISNULL(审核人二级,N'∅')+N' | 审核人='+ISNULL(审核人,N'∅')+N' | 责任人='+ISNULL(责任人,N'∅')+N' | 编辑人='+ISNULL(编辑人,N'∅') AS r FROM rd_prod_info_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
