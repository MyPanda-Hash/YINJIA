-- migrate-qc-recv-pool-clean.sql — 暂收入库单号池残留清理(2026-09-15)
-- 背景: QC_RECV 暂收入库单已由 migrate-qc-recv-drop.sql 整体下线(表/注册/译名/状态全清),
--       但 s_allno 号池仍留 3 行 ZS 取号记录(ZS-2026-09-0001..0003,均为当时建测试单取的号)。
--       面板已不存在,ZS 前缀不会再被 FormNoService 取号,这些行是纯惰性残留,按用户口径一并删除。
-- 幂等: 可重复执行(DELETE 按条件,无匹配即空操作)。
SET NOCOUNT ON;
DELETE FROM s_allno WHERE lb = 'ZS';
GO
SELECT COUNT(*) AS zs_left FROM s_allno WHERE lb = 'ZS';
PRINT N'migrate-qc-recv-pool-clean 完成:暂收入库单 ZS 号池残留清零';
GO
