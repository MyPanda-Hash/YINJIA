-- 【已中性化 2026-09-15】工序派工单首版(英文列 bl_dispatch)已被 migrate-dispatch-fix(中文列)+ 
-- fix-db-restore-20260915.sql(服务器口径终态)取代;本文件原含无条件 DROP TABLE bl_dispatch,
-- 在链上重跑会摧毁中文表。仅保留 GXLX 字典种子(幂等)。原文见 git 历史。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb='GXLX' AND dm='GXLX01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','GXLX01',N'工序派工','GXLX','N'),
('0','GXLX02',N'委外派工','GXLX','N');
GO
PRINT N'migrate-dispatch: 已中性化(建表/注册由 fix-db-restore-20260915.sql 终态接管),仅补 GXLX 字典';
GO
