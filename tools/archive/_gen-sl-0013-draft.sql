-- _gen-sl-0013-draft.sql — 手工造一张送料暂收单草稿 SL-2026-09-0013(验证 检验目录 生单联动)
-- 口径对齐应用写法:号池 s_allno(comm='0',GETDATE())/业务行 asp_time1=东八区时间/yj_doc_status saved='Y'
-- 幂等:已存在则跳过,可安全重跑。一次性探针脚本(2026-09-28,任务:检验目录生成验证)。
IF NOT EXISTS (SELECT 1 FROM s_allno WHERE dh = N'SL-2026-09-0013')
INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
VALUES ('0', N'SL-2026-09-0013', 'SL', '2026-09', 'admin', GETDATE(), 'N')
GO
IF NOT EXISTS (SELECT 1 FROM sl_recv WHERE 单据编号 = N'SL-2026-09-0013')
INSERT INTO sl_recv (单据编号, 单据日期, 供应商代码, 供应商, 部门名称, 单据状态, asp_user1, asp_time1, asp_cancel)
VALUES (N'SL-2026-09-0013', CONVERT(varchar(10), DATEADD(hour, 8, GETDATE()), 120), N'YJ-KY', N'科研实验室用品', N'采购部', N'草稿', 'admin', DATEADD(hour, 8, SYSDATETIME()), 'N')
GO
IF NOT EXISTS (SELECT 1 FROM sl_recv_detail WHERE 单据编号 = N'SL-2026-09-0013')
INSERT INTO sl_recv_detail (单据编号, 物料编码, 物料名称, 数量, 计量单位, asp_user1, asp_time1, asp_cancel)
VALUES (N'SL-2026-09-0013', N'Y-CSA-23', N'第四代亚硫酸钙球', 200, N'kg', 'admin', DATEADD(hour, 8, SYSDATETIME()), 'N')
GO
IF NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code = 'QC_RECV' AND doc_no = N'SL-2026-09-0013')
INSERT INTO yj_doc_status (panel_code, doc_no, canceled, saved, update_at)
VALUES ('QC_RECV', N'SL-2026-09-0013', 'N', 'Y', GETDATE())
GO
