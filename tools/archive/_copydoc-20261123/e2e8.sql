SET NOCOUNT ON;
SELECT 'HEAD src | 客户名='+ISNULL(客户名,N'∅')+N' | 客户编号='+ISNULL(客户编号,N'∅')+N' | 文档编号='+ISNULL(文档编号,N'∅')+N' | 申请立项人='+ISNULL(申请立项人,N'∅')+N' | 申请立项日期='+ISNULL(申请立项日期,N'∅')+N' | 项目等级='+ISNULL(项目等级,N'∅')+N' | 备用1='+ISNULL(备用1,N'∅')+N' | 附件1='+ISNULL(附件1,N'∅')+N' | 立项背景='+ISNULL(立项背景,N'∅')+N' | 单据日期='+ISNULL(单据日期,N'∅') AS r
FROM rd_approval WHERE 单据编号=N'LXA-2026-11-0031';
GO
SELECT 'HEAD new | 客户名='+ISNULL(客户名,N'∅')+N' | 客户编号='+ISNULL(客户编号,N'∅')+N' | 文档编号='+ISNULL(文档编号,N'∅')+N' | 申请立项人='+ISNULL(申请立项人,N'∅')+N' | 申请立项日期='+ISNULL(申请立项日期,N'∅')+N' | 项目等级='+ISNULL(项目等级,N'∅')+N' | 备用1='+ISNULL(备用1,N'∅')+N' | 附件1='+ISNULL(附件1,N'∅')+N' | 立项背景='+ISNULL(立项背景,N'∅')+N' | 单据日期='+ISNULL(单据日期,N'∅') AS r
FROM rd_approval WHERE 单据编号=N'LXA-2026-11-0034';
GO
SELECT 'DETAIL new | 行='+CONVERT(varchar(10),COUNT(*)) AS r FROM rd_approval_detail WHERE 单据编号=N'LXA-2026-11-0034' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号;
GO
SELECT 'DETAIL new rows | '+ISNULL(备用1,N'∅')+' / '+ISNULL(备用2,N'∅') AS r FROM rd_approval_detail WHERE 单据编号=N'LXA-2026-11-0034';
GO
SELECT 'STATUS new | saved='+ISNULL(saved,N'∅')+N' pending='+ISNULL(pending,N'∅')+N' archived='+ISNULL(archived,N'∅') AS r FROM yj_doc_status WHERE panel_code='RD_APPROVAL' AND doc_no=N'LXA-2026-11-0034';
GO
