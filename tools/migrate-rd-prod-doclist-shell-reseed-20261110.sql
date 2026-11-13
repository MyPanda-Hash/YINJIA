-- migrate-rd-prod-doclist-shell-reseed-20261110.sql — 产品文件列表(RD_PROD_DOCLIST) 承载单据兜底补种
--
-- 背景(2026-11-10 生产报障):该面板是「单单据 + 矩阵」——库里必须有且仅有 1 张承载单据 PDL-0001,
--   列表页才有一行可挂矩阵。生产上这行**丢了**(rd_prod_doclist_head 0 行),前端拿不到单据 ⇒ 面板空白
--   (同期还有前台渲染报错,已由 67747a9e 修)。原始种子在 tools/migrate-rd-prod-doclist.sql 里,但那个脚本
--   早已执行完毕、注册在 yj_schema_log ⇒ DbSync 不会重放,种子永远不会自己回来。
--
-- 做法:独立一条幂等脚本,专门兜底承载单据 —— 以后每次部署跑一遍,丢了就补回。
--   ① head 缺失则插 PDL-0001;② yj_doc_status 缺失则补(archived='N', 与原始种子同口径)。
-- 注意:不覆盖已存在行(有人改过密级/文件管理人也不冲掉)。
IF DB_NAME() = N'master' USE HSDZ_MES;
SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT 1 FROM rd_prod_doclist_head WHERE ISNULL(asp_cancel,'N') <> 'Y')
INSERT INTO rd_prod_doclist_head (单据编号, 单据日期, 密级, 文件使用范围, 文件管理人, 备注)
VALUES (N'PDL-0001', CONVERT(nvarchar(30), CONVERT(date, GETDATE()), 23), N'保密', N'工程技术中心', N'陈秀丽', N'产品文件列表视图宿主单据');
GO

IF NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code = N'RD_PROD_DOCLIST' AND doc_no = N'PDL-0001')
INSERT INTO yj_doc_status (panel_code, doc_no, saved, archived) VALUES (N'RD_PROD_DOCLIST', N'PDL-0001', 'Y', N'');
GO

IF NOT EXISTS (SELECT 1 FROM rd_prod_doclist_head WHERE ISNULL(asp_cancel,'N') <> 'Y')
  RAISERROR(N'[FAIL] RD_PROD_DOCLIST 承载单据补种失败', 12, 1) WITH NOWAIT;
GO
SELECT COUNT(*) AS head_rows FROM rd_prod_doclist_head WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
RAISERROR(N'[PASS] RD_PROD_DOCLIST 承载单据在位（缺失已补）', 10, 1) WITH NOWAIT;
GO
