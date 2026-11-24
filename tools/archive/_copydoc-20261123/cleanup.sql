SET NOCOUNT ON;
-- 本轮 E2E 造出的单据与测试数据(逐项删干净:head + detail + status)
DELETE FROM yj_doc_status WHERE panel_code='RD_APPROVAL' AND doc_no IN (N'LXA-2026-11-0033',N'LXA-2026-11-0034',N'LXA-2026-11-0040');
GO
DELETE FROM rd_approval_detail WHERE 单据编号 IN (N'LXA-2026-11-0033',N'LXA-2026-11-0034',N'LXA-2026-11-0040');
GO
DELETE FROM rd_approval WHERE 单据编号 IN (N'LXA-2026-11-0033',N'LXA-2026-11-0034',N'LXA-2026-11-0040');
GO
-- 源单恢复原值(测试时被种过客户名/文档编号/申请立项人等)
UPDATE rd_approval SET 客户名=NULL, 客户编号=NULL, 文档编号=N'', 申请立项人=NULL, 申请立项日期=N'2026-11-20',
  项目等级=NULL, 备用1=NULL, 附件1=NULL, 立项背景=NULL
WHERE 单据编号=N'LXA-2026-11-0031';
GO
DELETE FROM rd_approval_detail WHERE 单据编号=N'LXA-2026-11-0031';
GO
-- 产品信息表:PI-2026-11-0007 是复制出来的草稿
DELETE FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no=N'PI-2026-11-0007';
GO
DELETE FROM rd_prod_info_detail WHERE 单据编号=N'PI-2026-11-0007';
GO
DELETE FROM rd_prod_info_head WHERE 单据编号=N'PI-2026-11-0007';
GO
-- 外部开发样品:两轮复制出的 admin-2026-11-23-01/02
DELETE FROM yj_doc_status WHERE panel_code='RD_SAMPLE_EXT' AND doc_no IN (N'admin-2026-11-23-01',N'admin-2026-11-23-02');
GO
DELETE FROM rd_sample_ext_detail WHERE 单据编号 IN (N'admin-2026-11-23-01',N'admin-2026-11-23-02');
GO
DELETE FROM rd_sample_ext_head WHERE 单据编号 IN (N'admin-2026-11-23-01',N'admin-2026-11-23-02');
GO
-- 外部非开发样品:种的源单 + 复制出的草稿
DELETE FROM yj_doc_status WHERE panel_code='RD_SAMPLE_ND' AND doc_no IN (N'SPN2-E2E-SRC-01',N'SPN2-2026-11-0002');
GO
DELETE FROM rd_sample_nondev_detail WHERE 单据编号 IN (N'SPN2-E2E-SRC-01',N'SPN2-2026-11-0002');
GO
DELETE FROM rd_sample_nondev_head WHERE 单据编号 IN (N'SPN2-E2E-SRC-01',N'SPN2-2026-11-0002');
GO
-- 号池里这几个号也撤掉(否则本地说法上号已用)
DELETE FROM s_allno WHERE dh IN (N'LXA-2026-11-0033',N'LXA-2026-11-0034',N'LXA-2026-11-0040',N'admin-2026-11-23-01',N'admin-2026-11-23-02',N'SPN2-2026-11-0002',N'PI-2026-11-0007');
GO
SELECT 'CLEAN|approval='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_approval WHERE 单据编号 LIKE N'LXA-2026-11-00%'))
  +N'|approval_detail='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_approval_detail))
  +N'|prod_head='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_prod_info_head))
  +N'|sample_ext='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_ext_head))
  +N'|nondev='+CONVERT(varchar(10),(SELECT COUNT(*) FROM rd_sample_nondev_head))
  +N'|status='+CONVERT(varchar(10),(SELECT COUNT(*) FROM yj_doc_status WHERE doc_no LIKE N'%E2E%' OR doc_no LIKE N'admin-2026-11-23-%')) AS r;
GO
