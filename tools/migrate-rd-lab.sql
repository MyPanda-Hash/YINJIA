-- 【已中性化 2026-09-15】实验室 4 面板英文首版已被 migrate-rd-lab-sheets.sql(中文列终版)取代;
-- 本文件原含无守卫 yj_panel/yj_field INSERT,链上重跑撞主键必失败。
-- 面板注册现行真源 = migrate-rd-panel-register.sql。原文见 git 历史。
USE HSDZ_MES;
SET NOCOUNT ON;
PRINT N'migrate-rd-lab: 已中性化(被 migrate-rd-lab-sheets/rd-panel-register 取代),本次跳过';
GO
