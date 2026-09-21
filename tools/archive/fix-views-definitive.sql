-- 【已中性化 2026-09-15】同 fix-views-def.sql:视图修复链历史中间态(一次性重建 20 视图,
-- 头表已有 asp_cancel 的现结构下重跑必报重复列,且开篇全量 DROP 视图),
-- 视图终态由 fix-db-restore-20260915.sql(服务器快照口径)+ migrate-view-id/ascancel 维护。原文见 git 历史。
SET NOCOUNT ON;
PRINT N'fix-views-definitive: 已中性化(被 fix-db-restore-20260915.sql 取代),本次跳过';
GO
