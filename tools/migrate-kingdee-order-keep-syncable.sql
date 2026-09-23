-- migrate-kingdee-order-keep-syncable.sql — 销售/采购订单面板只保留「同步真能写入」的字段
-- 口径:与档案一致(用户确认 2026-09-15)。用哨兵代理跑 mapHead/mapLines:
--   取到接口值的键=可同步;映射里硬编码 null 的键(部门负责人/项目/品牌/到货地址/发货状态/
--   合同号/订金金额/付款方式/现存量说明)= 永远无值 → 从面板删除(物理列保留)。
-- 生成器:tools/archive/_gen-order-keep-syncable.mjs
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ SO_ORDER:保留 26 删 3 ══
DELETE FROM yj_field WHERE panel_code='SO_ORDER' AND col_name IN (N'品牌', N'部门负责人', N'项目');
GO

-- ══ PU_ORDER:保留 28 删 7 ══
DELETE FROM yj_field WHERE panel_code='PU_ORDER' AND col_name IN (N'项目', N'到货地址', N'发货状态', N'合同号', N'订金金额', N'付款方式', N'现存量说明');
GO

SELECT panel_code, COUNT(*) AS 可同步字段数 FROM yj_field WHERE panel_code IN ('SO_ORDER','PU_ORDER') GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-kingdee-order-keep-syncable 完成';
GO