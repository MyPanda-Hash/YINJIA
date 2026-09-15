-- 【已中性化 2026-09-15】"大整理"(厂商→往来单位合并 + 删 GFDA/CKDA/YWYDA 三面板)是 2026-08 末的
-- 一次性重组脚本:GFDA 等面板后来已恢复在用(智能供应链供应商档案,金蝶同步落表 dm_gf),
-- 现在重跑会再次删掉这三个面板及其字段(包括金蝶对齐成果)。ALTER 无守卫重跑也必失败。
-- 历史重组已完成,无需再执行。原文见 git 历史。
USE HSDZ_MES;
SET NOCOUNT ON;
PRINT N'cleanup-base-panels: 已中性化(历史重组已完成,GFDA/CKDA/YWYDA 现为在用面板),本次跳过';
GO
