SET NOCOUNT ON;
SELECT 'rd_approval='+CAST(COUNT(*) AS varchar(10)) FROM rd_approval WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT 'rd_approval_detail='+CAST(COUNT(*) AS varchar(10)) FROM rd_approval_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT TOP 5 单据编号+N'|'+ISNULL(文档编号,N'')+N'|'+ISNULL(客户名,N'')+N'|'+ISNULL(申请立项人,N'')+N'|'+ISNULL(单据日期,N'') FROM rd_approval ORDER BY id DESC;
GO
SELECT 'rd_sample_ext_head='+CAST(COUNT(*) AS varchar(10)) FROM rd_sample_ext_head WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT 'rd_sample_ext_detail='+CAST(COUNT(*) AS varchar(10)) FROM rd_sample_ext_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT TOP 5 单据编号+N'|'+ISNULL(客户名称,N'')+N'|'+ISNULL(申请,N'')+N'|'+ISNULL(审核,N'')+N'|'+ISNULL(确认,N'')+N'|'+ISNULL(单据日期,N'') FROM rd_sample_ext_head ORDER BY id DESC;
GO
SELECT 'rd_prod_info_head='+CAST(COUNT(*) AS varchar(10)) FROM rd_prod_info_head WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT 'rd_prod_info_detail='+CAST(COUNT(*) AS varchar(10)) FROM rd_prod_info_detail WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT 'rd_sample_nondev_head='+CAST(COUNT(*) AS varchar(10)) FROM rd_sample_nondev_head WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
