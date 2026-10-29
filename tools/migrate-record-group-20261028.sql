-- migrate-record-group-20261028.sql
-- 「一张单据按下拉分组填多组数据」——三张实验室使用记录表(2026-10-28 用户口径)
--
-- 用户原话:
--   「把这三张表按测试项目、设备名称、仪器名称这些下拉来切数据表填写,就是改为一张单据,
--    可以通过切换这些内容来给对应的项目、设备、仪器,分别填写数据,一张单据可填写的内容就多一些,
--    而不是不同项目、仪器、设备都要新建一张单」
--
-- 现状与差距:
--   · RD_EQUIP_USE(设备使用登记表):头上有「设备名称」下拉,行表 rd_equip_use_detail **已有** 设备名称 列,
--     但 yj_field 只登记了 query/header 两处,**明细行没有把设备名称当字段** ⇒ 保存时该列被丢弃,行无法按设备分组;
--   · RD_INSTR_USE(仪器使用记录表):同上,行表 rd_instr_use_detail 已有「仪器名称/型号」列;
--   · RD_SPIKE_WATER(加标水配置记录表):头上有「测试项目」下拉(变体列集也按它),
--     但行表 rd_spike_water_detail **连物理列都没有** ⇒ 本脚本补列。
--
-- 改法(最小侵入,不动已有数据):
--   1. rd_spike_water_detail 增加「测试项目」列(nvarchar(100) NULL,与头表同口径);
--   2. 三张表各补一条 place='detail' 的分组字段登记,使前端行模型里的分组值能被 ButtonService 映射落库;
--      hidden=1 / editable=0:该列是**归属标记**,不该出现在明细表格里让人手改(改了会串组)。
--
-- 兼容:已有单据的行分组列为空 ⇒ 前端按「当前下拉那一组」归组(core/panel/recordGroup.js,有单测),
--   老数据不会因此看不见;本脚本不回填任何业务数据。
--
-- 幂等:列与字段登记都先判存在;两账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
SET NOCOUNT ON;

-- ── 1. 加标水行表补「测试项目」物理列 ──
IF COL_LENGTH('dbo.rd_spike_water_detail', N'测试项目') IS NULL
BEGIN
    ALTER TABLE dbo.rd_spike_water_detail ADD [测试项目] nvarchar(100) NULL;
    PRINT N'[OK] rd_spike_water_detail 增加列:测试项目 nvarchar(100)';

    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID('dbo.rd_spike_water_detail') AND minor_id = 0 AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'加标水配置记录表行表:按测试项目分组的一行配置记录',
             N'SCHEMA', N'dbo', N'TABLE', N'rd_spike_water_detail';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID('dbo.rd_spike_water_detail')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.rd_spike_water_detail'), N'测试项目', 'ColumnId')
                     AND name = 'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', N'本行属于哪个测试项目(与单头「测试项目」同值;2026-10-28 分组填多组用)',
             N'SCHEMA', N'dbo', N'TABLE', N'rd_spike_water_detail', N'COLUMN', N'测试项目';
END
ELSE
    PRINT N'[SKIP] rd_spike_water_detail.测试项目 已存在';

-- ── 2. 三张表补「明细分组字段」登记 ──
-- 设备使用登记表:行上的「设备名称」= 该行属于哪台设备
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_EQUIP_USE' AND place = 'detail' AND label = N'设备名称')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_EQUIP_USE', N'设备名称', N'设备名称', N'文本', 'detail', 900, 120, 0, 0, 1, 1);
    PRINT N'[OK] RD_EQUIP_USE 增加明细分组字段:设备名称';
END
ELSE PRINT N'[SKIP] RD_EQUIP_USE.设备名称(detail) 已登记';

-- 仪器使用记录表:行上的「仪器名称/型号」= 该行属于哪台仪器
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_INSTR_USE' AND place = 'detail' AND label = N'仪器名称/型号')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_INSTR_USE', N'仪器名称/型号', N'仪器名称/型号', N'文本', 'detail', 900, 140, 0, 0, 1, 1);
    PRINT N'[OK] RD_INSTR_USE 增加明细分组字段:仪器名称/型号';
END
ELSE PRINT N'[SKIP] RD_INSTR_USE.仪器名称/型号(detail) 已登记';

-- 加标水配置记录表:行上的「测试项目」= 该行属于哪个测试项目
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'RD_SPIKE_WATER' AND place = 'detail' AND label = N'测试项目')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('RD_SPIKE_WATER', N'测试项目', N'测试项目', N'文本', 'detail', 900, 120, 0, 0, 1, 1);
    PRINT N'[OK] RD_SPIKE_WATER 增加明细分组字段:测试项目';
END
ELSE PRINT N'[SKIP] RD_SPIKE_WATER.测试项目(detail) 已登记';

-- ── 自检:三行分组字段都必须在 ──
SELECT panel_code, col_name, label, place, hidden, editable
FROM yj_field
WHERE place = 'detail'
  AND ((panel_code = 'RD_EQUIP_USE' AND label = N'设备名称')
    OR (panel_code = 'RD_INSTR_USE' AND label = N'仪器名称/型号')
    OR (panel_code = 'RD_SPIKE_WATER' AND label = N'测试项目'))
ORDER BY panel_code;
