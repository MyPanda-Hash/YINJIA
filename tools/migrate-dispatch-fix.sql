-- 【已中性化 2026-09-15】中文列 bl_dispatch 的建表/注册已由 fix-db-restore-20260915.sql 以服务器口径
-- 统一接管(该脚本原为无守卫 CREATE TABLE + 无守卫字段 INSERT,链上重跑必失败/重复)。
-- 原文见 git 历史。
USE HSDZ_MES;
SET NOCOUNT ON;
UPDATE yj_panel SET head_table = 'bd_dispatch', group_col = N'单据编号' WHERE panel_code = 'DISPATCH' AND ISNULL(head_table,'') = '';
GO
PRINT N'migrate-dispatch-fix: 已中性化(bl_dispatch/DISPATCH 元数据由 fix-db-restore-20260915.sql 终态接管)';
GO
