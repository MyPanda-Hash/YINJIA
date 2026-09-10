-- fix-proj-customer-ref.sql — 项目档案「客户」参照改名称口径
-- 背景:PROJ.客户 原配置 ref_field=dm(代码),选择/显示都是客户代码;
--       用户确认应显示客户名称(与销售订单.客户 存名称口径一致)。
-- 1) 参照口径 dm→mc:选择后存客户名称、显示客户名称;
-- 2) 存量行一次性翻译:已存代码的行按 dm_kh(dm→mc) 刷成名称,对不上 dm 的保持原值。
-- 幂等:两条 UPDATE 重跑无副作用。
UPDATE yj_field SET ref_field = N'mc'
WHERE panel_code = 'PROJ' AND col_name = N'客户' AND ref_field = N'dm';

UPDATE p SET p.[客户] = k.mc
FROM bs_proj p
JOIN dm_kh k ON p.[客户] = k.dm
WHERE p.[客户] <> k.mc;

PRINT N'项目.客户 参照口径修复完成';
GO
