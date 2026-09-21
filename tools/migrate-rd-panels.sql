-- 【已中性化 2026-09-15】数据记录表 8 面板英文首版(rd_filter_eff 等英文列表)已被
-- migrate-rd-record-sheets.sql(中文列终版)取代;本文件原含无守卫 yj_panel/yj_field INSERT,
-- 链上重跑撞主键必失败。面板注册现行真源 = migrate-rd-panel-register.sql。原文见 git 历史。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
PRINT N'migrate-rd-panels: 已中性化(被 migrate-rd-record-sheets/rd-panel-register 取代),本次跳过';
GO
