-- 【已中性化 2026-09-15】本脚本是视图修复链的历史中间态(t.* + 显式 asp_cancel 的包装层写法),
-- 仅适用于当时头表还没有 asp_cancel 列的库;现在的表结构下重跑必然报"CREATE VIEW 列名重复"。
-- 且开头游标会 DROP 全部 v_% 视图(2026-09-15 修复事故中它清掉了所有报表视图)。
-- 视图终态统一由 fix-db-restore-20260915.sql(服务器快照口径) + migrate-view-id/ascancel 维护。
-- 原文见 git 历史;如需回看生成逻辑,本文件不做任何事。
SET NOCOUNT ON;
PRINT N'fix-views-def: 已中性化(被 fix-db-restore-20260915.sql 取代),本次跳过';
GO
