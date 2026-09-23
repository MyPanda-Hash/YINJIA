-- _seed-prodDocList-test.sql — 产品文件列表重启测试用探针数据(**用完即删**)
-- 用途:本机 rd_dev_task 为空(0 行),没有已下发产品 ⇒ /px/prodDocList 只能返回空矩阵,
--       测不出"状态推导 / 是否受控"是否真的工作。故注入两张可丢弃的测试产品:
--   ZZTEST-1:4 个下游面板各一张**已归档**单 ⇒ 预期 4 格 开发完毕、是否受控=是、受控日期取最晚归档
--   ZZTEST-2:仅成型工艺清单一张草稿        ⇒ 预期 该格 开发中、其余 未开发、是否受控=否
-- 清理脚本见 _seed-prodDocList-test-cleanup.sql
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
USE HSDZ_MES;

DELETE FROM rd_dev_task     WHERE 产品编号 LIKE 'ZZTEST-%';
DELETE FROM yj_doc_status   WHERE doc_no   LIKE 'ZZT-%';
DELETE FROM rd_mold_proc_head WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_asm_proc_head  WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_spec_doc_head  WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_insp_plan_head WHERE 单据编号 LIKE 'ZZT-%';

INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 下发人, 下发时间, 目标面板, asp_user1, asp_time1) VALUES
 ('ZZTEST-1', N'自测产品一', 'PI-ZZT-1', 'admin', SYSDATETIME(), 'RD_MOLD_PROC', 'admin', SYSDATETIME()),
 ('ZZTEST-1', N'自测产品一', 'PI-ZZT-1', 'admin', SYSDATETIME(), 'RD_ASM_PROC',  'admin', SYSDATETIME()),
 ('ZZTEST-1', N'自测产品一', 'PI-ZZT-1', 'admin', SYSDATETIME(), 'RD_SPEC_DOC',  'admin', SYSDATETIME()),
 ('ZZTEST-1', N'自测产品一', 'PI-ZZT-1', 'admin', SYSDATETIME(), 'RD_INSP_PLAN', 'admin', SYSDATETIME()),
 ('ZZTEST-2', N'自测产品二', 'PI-ZZT-2', 'admin', SYSDATETIME(), 'RD_MOLD_PROC', 'admin', SYSDATETIME());

INSERT INTO rd_mold_proc_head (单据编号, 产品编号, 产品名称) VALUES ('ZZT-M1', 'ZZTEST-1', N'自测产品一');
INSERT INTO rd_asm_proc_head  (单据编号, 产品编号, 产品名称) VALUES ('ZZT-A1', 'ZZTEST-1', N'自测产品一');
INSERT INTO rd_spec_doc_head  (单据编号, 编号, 名称)          VALUES ('ZZT-S1', 'ZZTEST-1', N'自测产品一规格书');
INSERT INTO rd_insp_plan_head (单据编号, 产品编号, 标题)      VALUES ('ZZT-I1', 'ZZTEST-1', N'自测产品一检验计划');
INSERT INTO yj_doc_status (panel_code, doc_no, archived, archived_at) VALUES
 ('RD_MOLD_PROC', 'ZZT-M1', 'Y', '2026-09-20 09:00:00'),
 ('RD_ASM_PROC',  'ZZT-A1', 'Y', '2026-09-20 09:30:00'),
 ('RD_SPEC_DOC',  'ZZT-S1', 'Y', '2026-09-20 10:00:00'),
 ('RD_INSP_PLAN', 'ZZT-I1', 'Y', '2026-09-20 10:15:00');

INSERT INTO rd_mold_proc_head (单据编号, 产品编号, 产品名称) VALUES ('ZZT-M2', 'ZZTEST-2', N'自测产品二');
INSERT INTO yj_doc_status (panel_code, doc_no, archived, saved) VALUES ('RD_MOLD_PROC', 'ZZT-M2', 'N', 'N');

PRINT N'测试数据已注入';
SELECT 产品编号, COUNT(*) AS 面板数 FROM rd_dev_task WHERE 产品编号 LIKE 'ZZTEST-%' GROUP BY 产品编号;
