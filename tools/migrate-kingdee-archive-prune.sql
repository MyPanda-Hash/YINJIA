-- migrate-kingdee-archive-prune.sql — 档案字段严格对齐金蝶口径:删 MES 独有面板字段 + 去重复列
-- 口径(用户确认 2026-09-15):只保留金蝶云·星辰真实接口字段;MES 里有、金蝶没有的面板字段删除。
--   物理列一律保留(部分 MES 业务逻辑读列,如品检分流),只删 yj_field(面板不再展示)。
--   本会话早前新增的"与旧列语义重复"的列一并删除,改映射到旧列。
-- 幂等:DELETE/UPDATE 直写同值,DROP 带 COL_LENGTH 守卫。
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
SET NOCOUNT ON;
GO

-- ══ 1. 删除本会话新建的重复列(改用旧列:gj/sheng/shi/qu、允许零库存出库、单位类型)══
IF COL_LENGTH('dbo.dm_kh', N'国家') IS NOT NULL ALTER TABLE dbo.dm_kh DROP COLUMN [国家];
IF COL_LENGTH('dbo.dm_kh', N'省') IS NOT NULL ALTER TABLE dbo.dm_kh DROP COLUMN [省];
IF COL_LENGTH('dbo.dm_kh', N'市') IS NOT NULL ALTER TABLE dbo.dm_kh DROP COLUMN [市];
IF COL_LENGTH('dbo.dm_kh', N'区') IS NOT NULL ALTER TABLE dbo.dm_kh DROP COLUMN [区];
IF COL_LENGTH('dbo.bs_wh', N'允许负库存') IS NOT NULL ALTER TABLE dbo.bs_wh DROP COLUMN [允许负库存];
IF COL_LENGTH('dbo.bs_uom', N'换算类型') IS NOT NULL ALTER TABLE dbo.bs_uom DROP COLUMN [换算类型];
GO
DELETE FROM yj_field WHERE panel_code = 'BD_CUSTOMER' AND col_name IN (N'国家', N'省', N'市', N'区');
DELETE FROM yj_field WHERE panel_code = 'BD_STORE' AND col_name = N'允许负库存';
DELETE FROM yj_field WHERE panel_code = 'BD_UOM' AND col_name = N'换算类型';
GO

-- ══ 2. 旧列按金蝶口径注册/改名(国家省市/允许零库存出库/单位类型/参考成本)══
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'gj')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'gj', N'国家', N'文本', N'detail', 900, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'sheng')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'sheng', N'省', N'文本', N'detail', 900, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'shi')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'shi', N'市', N'文本', N'detail', 900, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'KHDA' AND col_name = 'qu')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('KHDA', N'qu', N'区', N'文本', N'detail', 900, 100, 1, 0, 0, 1);
GO
-- 金蝶有对应 → 从隐藏恢复并统一用金蝶名
UPDATE yj_field SET label = N'允许负库存', hidden = 0, visible = 1 WHERE panel_code = 'WH'  AND col_name = N'允许零库存出库';
UPDATE yj_field SET label = N'换算类型',   hidden = 0, visible = 1 WHERE panel_code = 'UOM' AND col_name = N'单位类型';
UPDATE yj_field SET hidden = 0, visible = 1 WHERE panel_code = 'INV' AND col_name = N'参考成本';  -- 金蝶 price_entity.price_cost_price
GO

-- ══ 3. 删除 MES 独有(金蝶接口无)的面板字段 ══
-- 商品:是否检验/检验方式/数据来源/ERP更新时间/最新成本 为 MES 自用(品检分流由列驱动,列保留)
DELETE FROM yj_field WHERE panel_code = 'INV' AND col_name IN (N'是否检验', N'检验方式', N'数据来源', N'ERP更新时间', N'最新成本');
-- 职员:金蝶只有 mobile(敏感跳过),无 办公电话/证件类型/职务/职称/业务员
DELETE FROM yj_field WHERE panel_code = 'EMP' AND col_name IN (N'办公电话', N'证件类型', N'职务', N'职称', N'业务员');
-- 部门:金蝶 department 无 部门类型/电话
DELETE FROM yj_field WHERE panel_code = 'DEPT' AND col_name IN (N'部门类型', N'电话');
-- 仓库:金蝶 store 无 仓库类型(仅 group_id 无名称)/所属车间/联系人
DELETE FROM yj_field WHERE panel_code = 'WH' AND col_name IN (N'仓库类型', N'所属车间', N'联系人');
-- 计量单位:金蝶 measure_unit 无 主单位/换算率(换算关系在主单位面板)
DELETE FROM yj_field WHERE panel_code = 'UOM' AND col_name IN (N'主单位', N'换算率');
-- 供应商:金蝶 supplier 无 级别/到货地址
DELETE FROM yj_field WHERE panel_code = 'GFDA' AND col_name IN (N'csjb', N'ckadd');
GO

-- ══ 4. 自检:各档案面板剩余字段(应全部能在金蝶接口键里找到对应)══
SELECT panel_code, COUNT(*) AS 面板字段数 FROM yj_field
WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
GROUP BY panel_code ORDER BY panel_code;
PRINT N'migrate-kingdee-archive-prune 完成(档案字段严格对齐金蝶口径)';
GO
