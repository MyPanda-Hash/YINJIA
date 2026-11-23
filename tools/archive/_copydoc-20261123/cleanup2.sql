SET NOCOUNT ON;
-- 这 5 张是**我浏览面板时**由前端 autoDraftOnEnter 自动建的空白草稿(RD_APPROVAL 进面板即建),
-- 不是功能产物、也不是用户数据(建单时间 2026-11-23 10:32:01,客户名/文档编号全空)。
SELECT 'WILL-DELETE|'+单据编号+N'|客户名='+ISNULL(客户名,N'∅')+N'|文档编号='+ISNULL(文档编号,N'∅')+N'|立项背景='+ISNULL(立项背景,N'∅')+N'|创建='+CONVERT(varchar(19),asp_time1,120) AS r
FROM rd_approval WHERE 单据编号 IN (N'LXA-2026-11-0035',N'LXA-2026-11-0036',N'LXA-2026-11-0037',N'LXA-2026-11-0038',N'LXA-2026-11-0039');
GO
DELETE FROM yj_doc_status WHERE panel_code='RD_APPROVAL' AND doc_no IN (N'LXA-2026-11-0035',N'LXA-2026-11-0036',N'LXA-2026-11-0037',N'LXA-2026-11-0038',N'LXA-2026-11-0039');
GO
DELETE FROM rd_approval_detail WHERE 单据编号 IN (N'LXA-2026-11-0035',N'LXA-2026-11-0036',N'LXA-2026-11-0037',N'LXA-2026-11-0038',N'LXA-2026-11-0039');
GO
DELETE FROM rd_approval WHERE 单据编号 IN (N'LXA-2026-11-0035',N'LXA-2026-11-0036',N'LXA-2026-11-0037',N'LXA-2026-11-0038',N'LXA-2026-11-0039');
GO
DELETE FROM s_allno WHERE dh IN (N'LXA-2026-11-0035',N'LXA-2026-11-0036',N'LXA-2026-11-0037',N'LXA-2026-11-0038',N'LXA-2026-11-0039');
GO
SELECT 'FINAL|rd_approval='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_approval))
 +N'|detail='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_approval_detail))
 +N'|prod_head='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_prod_info_head))
 +N'|prod_detail='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_prod_info_detail))
 +N'|ext_head='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_ext_head))
 +N'|ext_detail='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_ext_detail))
 +N'|nondev_head='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_nondev_head))
 +N'|nondev_detail='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_nondev_detail)) AS r;
GO
