-- 【已中性化 2026-09-15】同 fix-views-def.sql:视图修复链历史中间态(开篇全量 DROP 视图),
-- 视图终态由 fix-db-restore-20260915.sql + migrate-view-id/ascancel 维护。原文见 git 历史。
SET NOCOUNT ON;
PRINT N'fix-views-v3: 已中性化(被 fix-db-restore-20260915.sql 取代),本次跳过';
GO
