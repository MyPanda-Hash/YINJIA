-- migrate-bom-kingdee.sql
-- 金蝶云·星辰「BOM 单」基础资料(表头 + 子料分录):建表 + 面板元数据 + 多语言
-- 来源接口:GET https://api.kingdee.com/jdy/v2/bd/bom(《BOM单列表》,官方文档 id 9c2c4958712511eda0b361e90d734914)
--   形态 = 表头 Row + material_entity 子料分录(列表接口自带分录,**没有**独立详情接口:
--   /jdy/v2/bd/bom_detail → HTTP 400、/jdy/v2/bd/bom_list → HTTP 519,2026-10-04 实测)。
--
-- 为什么新建两张表而不是改造现有 bs_bom:
--   现有「物料清单」(面板 BOM / 表 bs_bom / 平表)是 MES 自己的父件-子件维护模型,被 4 处后端逻辑直读
--   (ScheduleBoardService / WoPickingHandler / ManuPurchaseReqHandler / WorkOrderListController)、
--   一个视图 v_wo_kit(齐套)、以及前端 BomMasterDetail.vue + BOM_FWD/BOM_REV 两个面板使用。
--   改造它 = 同时改这些消费点;用户 2026-10-04 拍板:**新建独立「BOM单」面板**,旧面板不动。
--
-- 字段口径(对齐接口,与「商品」同一套“只保留能同步过来的字段”原则,见 deploy/金蝶档案字段同步对照.md §一.2):
--   · 接口只给 id 无名称孪生的键( product_id / *_aux*_id / material_unit_id / material_baseunit_id /
--     material_auxprop_id / material_id / auditor_id / creator_id / modifier_id / custom_entity_field /
--     分录 id)一律不建面板字段,避免冗余;unit/material 的名称由同步器就近解析(见 sync-core.mjs BD_BOM);
--   · 列名一律中文(= 标签,ADR-0001 数据键永不翻译);新列禁用 % / ( ) / 空格 ⇒「成品率」「损耗率」不带 %;
--   · 全程幂等:重复执行影响 0 行。
-- 两账套都要执行:HSDZ_MES(正式)先、HSDZ_MES_TEST(测试)后。
SET NOCOUNT ON;

-- ══════════════ 1. 表头表 bs_bom_head ══════════════
IF OBJECT_ID(N'dbo.bs_bom_head') IS NULL
CREATE TABLE dbo.bs_bom_head (
    id                      bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bs_bom_head PRIMARY KEY,
    单据编号                nvarchar(100)  NOT NULL,   -- 金蝶 number(BOM单编号)
    产品编码                nvarchar(200)  NULL,       -- product_number
    产品名称                nvarchar(400)  NULL,       -- product_name
    版本号                  nvarchar(100)  NULL,       -- version
    成品率                  decimal(18,4)  NULL,       -- yield(接口字段说明为「成品率%」,列名按规范去 %)
    BOM备注                 nvarchar(1000) NULL,       -- bom_remark
    跳过该层级领用下级物料  bit            NULL,       -- isskip 1=是 0=否
    审核状态                nvarchar(20)   NULL,       -- status Z=未审核 C=已审核
    是否启用                bit            NULL,       -- enable 1/0
    状态                    nvarchar(20)   NULL,       -- MES 状态(启用/停用)
    停用                    bit            NULL,       -- MES 停用标志
    数据来源                nvarchar(50)   NULL,       -- billsource(PMBD=WEB录入 / WEBIMPORT=WEB引入)
    产品单位                nvarchar(100)  NULL,       -- product_unit_name
    产品单位编码            nvarchar(100)  NULL,       -- product_unit_number
    基本单位                nvarchar(100)  NULL,       -- product_baseunit_name
    基本单位编码            nvarchar(100)  NULL,       -- product_baseunit_number
    辅助属性                nvarchar(200)  NULL,       -- product_auxprop_name
    辅助属性编码            nvarchar(100)  NULL,       -- product_auxprop_number
    属性组1                 nvarchar(200)  NULL,       -- product_aux1_name
    属性组2                 nvarchar(200)  NULL,       -- product_aux2_name
    属性组3                 nvarchar(200)  NULL,       -- product_aux3_name
    属性组4                 nvarchar(200)  NULL,       -- product_aux4_name
    属性组5                 nvarchar(200)  NULL,       -- product_aux5_name
    审核人                  nvarchar(100)  NULL,       -- auditor_name
    审核时间                datetime2      NULL,       -- audit_time
    创建人                  nvarchar(100)  NULL,       -- creator_name
    创建时间                datetime2      NULL,       -- create_time
    修改人                  nvarchar(100)  NULL,       -- modifier_name
    修改时间                datetime2      NULL,       -- modify_time
    外部数据ID              nvarchar(128)  NULL,       -- 同步锚点:金蝶行 id
    外部单据号              nvarchar(400)  NULL,       -- 同步锚点:金蝶 number
    外部指纹                nvarchar(1000) NULL,       -- 指纹跳过用(列表级字段拼接)
    asp_user1               nvarchar(50)   NULL,
    asp_time1               datetime2      NULL,
    asp_user2               nvarchar(50)   NULL,
    asp_time2               datetime2      NULL,
    asp_cancel              nvarchar(1)    NULL CONSTRAINT df_bs_bom_head_asp_cancel DEFAULT N'N'
);
GO
-- 列补丁(表已存在但缺列的收敛路径)
IF COL_LENGTH(N'dbo.bs_bom_head', N'单据编号') IS NULL ALTER TABLE dbo.bs_bom_head ADD [单据编号] nvarchar(100) NOT NULL CONSTRAINT df_bs_bom_head_单据编号 DEFAULT N'';
IF COL_LENGTH(N'dbo.bs_bom_head', N'产品编码') IS NULL ALTER TABLE dbo.bs_bom_head ADD [产品编码] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'产品名称') IS NULL ALTER TABLE dbo.bs_bom_head ADD [产品名称] nvarchar(400) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'版本号') IS NULL ALTER TABLE dbo.bs_bom_head ADD [版本号] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'成品率') IS NULL ALTER TABLE dbo.bs_bom_head ADD [成品率] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'BOM备注') IS NULL ALTER TABLE dbo.bs_bom_head ADD [BOM备注] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'跳过该层级领用下级物料') IS NULL ALTER TABLE dbo.bs_bom_head ADD [跳过该层级领用下级物料] bit NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'审核状态') IS NULL ALTER TABLE dbo.bs_bom_head ADD [审核状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'是否启用') IS NULL ALTER TABLE dbo.bs_bom_head ADD [是否启用] bit NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'状态') IS NULL ALTER TABLE dbo.bs_bom_head ADD [状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'停用') IS NULL ALTER TABLE dbo.bs_bom_head ADD [停用] bit NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'数据来源') IS NULL ALTER TABLE dbo.bs_bom_head ADD [数据来源] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'产品单位') IS NULL ALTER TABLE dbo.bs_bom_head ADD [产品单位] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'产品单位编码') IS NULL ALTER TABLE dbo.bs_bom_head ADD [产品单位编码] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'基本单位') IS NULL ALTER TABLE dbo.bs_bom_head ADD [基本单位] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'基本单位编码') IS NULL ALTER TABLE dbo.bs_bom_head ADD [基本单位编码] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'辅助属性') IS NULL ALTER TABLE dbo.bs_bom_head ADD [辅助属性] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'辅助属性编码') IS NULL ALTER TABLE dbo.bs_bom_head ADD [辅助属性编码] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'属性组1') IS NULL ALTER TABLE dbo.bs_bom_head ADD [属性组1] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'属性组2') IS NULL ALTER TABLE dbo.bs_bom_head ADD [属性组2] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'属性组3') IS NULL ALTER TABLE dbo.bs_bom_head ADD [属性组3] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'属性组4') IS NULL ALTER TABLE dbo.bs_bom_head ADD [属性组4] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'属性组5') IS NULL ALTER TABLE dbo.bs_bom_head ADD [属性组5] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'审核人') IS NULL ALTER TABLE dbo.bs_bom_head ADD [审核人] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'审核时间') IS NULL ALTER TABLE dbo.bs_bom_head ADD [审核时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'创建人') IS NULL ALTER TABLE dbo.bs_bom_head ADD [创建人] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'创建时间') IS NULL ALTER TABLE dbo.bs_bom_head ADD [创建时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'修改人') IS NULL ALTER TABLE dbo.bs_bom_head ADD [修改人] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'修改时间') IS NULL ALTER TABLE dbo.bs_bom_head ADD [修改时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'外部数据ID') IS NULL ALTER TABLE dbo.bs_bom_head ADD [外部数据ID] nvarchar(128) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'外部单据号') IS NULL ALTER TABLE dbo.bs_bom_head ADD [外部单据号] nvarchar(400) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'外部指纹') IS NULL ALTER TABLE dbo.bs_bom_head ADD [外部指纹] nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'asp_user1') IS NULL ALTER TABLE dbo.bs_bom_head ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'asp_time1') IS NULL ALTER TABLE dbo.bs_bom_head ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'asp_user2') IS NULL ALTER TABLE dbo.bs_bom_head ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'asp_time2') IS NULL ALTER TABLE dbo.bs_bom_head ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_head', N'asp_cancel') IS NULL ALTER TABLE dbo.bs_bom_head ADD [asp_cancel] nvarchar(1) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_bs_bom_head_外部数据ID' AND object_id = OBJECT_ID(N'dbo.bs_bom_head'))
    CREATE UNIQUE INDEX uq_bs_bom_head_外部数据ID ON dbo.bs_bom_head([外部数据ID]) WHERE [外部数据ID] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bs_bom_head_单据编号' AND object_id = OBJECT_ID(N'dbo.bs_bom_head'))
    CREATE INDEX ix_bs_bom_head_单据编号 ON dbo.bs_bom_head([单据编号]);
GO

-- ══════════════ 2. 子料分录表 bs_bom_detail ══════════════
IF OBJECT_ID(N'dbo.bs_bom_detail') IS NULL
CREATE TABLE dbo.bs_bom_detail (
    id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bs_bom_detail PRIMARY KEY,
    单据编号        nvarchar(100)  NOT NULL,   -- 关联 bs_bom_head.单据编号(头行分组列)
    行号            int            NULL,       -- seq 分录行号
    子料编码        nvarchar(200)  NULL,       -- material_number
    子料名称        nvarchar(400)  NULL,       -- material_name
    子料单位        nvarchar(100)  NULL,       -- material_unit_id → 计量单位档案 id→名称 解析
    子料基本单位    nvarchar(100)  NULL,       -- material_baseunit_id → 计量单位档案 id→名称 解析
    材料用量        decimal(18,4)  NULL,       -- dosage_numerator
    产品产量        decimal(18,4)  NULL,       -- dosage_denominator
    单位用量        decimal(18,4)  NULL,       -- unitqty
    损耗率          decimal(18,4)  NULL,       -- scrap(接口说明为「损耗率%」,列名按规范去 %)
    固定损耗        decimal(18,4)  NULL,       -- fixed_loss
    发料方式        nvarchar(20)   NULL,       -- issue_pattern D=直接领料 A=倒冲领料 B=不领料
    关键件          bit            NULL,       -- iskeypieces
    替代件          bit            NULL,       -- isrepitem
    工位            nvarchar(100)  NULL,       -- machinepos
    发料仓库        nvarchar(200)  NULL,       -- stock_name
    发料仓库编码    nvarchar(100)  NULL,       -- stock_number
    发料仓位        nvarchar(200)  NULL,       -- sp_name
    发料仓位编码    nvarchar(100)  NULL,       -- sp_number
    物料备注        nvarchar(500)  NULL,       -- material_remark
    物料备注1       nvarchar(500)  NULL,       -- custom_txt1
    物料备注2       nvarchar(500)  NULL,       -- custom_txt2
    物料备注3       nvarchar(500)  NULL,       -- custom_txt3
    外部分录ID      nvarchar(128)  NULL,       -- 金蝶分录 id(仅留痕,不建面板字段)
    asp_user1       nvarchar(50)   NULL,
    asp_time1       datetime2      NULL,
    asp_user2       nvarchar(50)   NULL,
    asp_time2       datetime2      NULL,
    asp_cancel      nvarchar(1)    NULL CONSTRAINT df_bs_bom_detail_asp_cancel DEFAULT N'N'
);
GO
IF COL_LENGTH(N'dbo.bs_bom_detail', N'单据编号') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [单据编号] nvarchar(100) NOT NULL CONSTRAINT df_bs_bom_detail_单据编号 DEFAULT N'';
IF COL_LENGTH(N'dbo.bs_bom_detail', N'行号') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [行号] int NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'子料编码') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [子料编码] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'子料名称') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [子料名称] nvarchar(400) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'子料单位') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [子料单位] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'子料基本单位') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [子料基本单位] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'材料用量') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [材料用量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'产品产量') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [产品产量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'单位用量') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [单位用量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'损耗率') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [损耗率] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'固定损耗') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [固定损耗] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'发料方式') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [发料方式] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'关键件') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [关键件] bit NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'替代件') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [替代件] bit NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'工位') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [工位] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'发料仓库') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [发料仓库] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'发料仓库编码') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [发料仓库编码] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'发料仓位') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [发料仓位] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'发料仓位编码') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [发料仓位编码] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'物料备注') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [物料备注] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'物料备注1') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [物料备注1] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'物料备注2') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [物料备注2] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'物料备注3') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [物料备注3] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'外部分录ID') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [外部分录ID] nvarchar(128) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'asp_user1') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'asp_time1') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'asp_user2') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'asp_time2') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bs_bom_detail', N'asp_cancel') IS NULL ALTER TABLE dbo.bs_bom_detail ADD [asp_cancel] nvarchar(1) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bs_bom_detail_单据编号' AND object_id = OBJECT_ID(N'dbo.bs_bom_detail'))
    CREATE INDEX ix_bs_bom_detail_单据编号 ON dbo.bs_bom_detail([单据编号]);
GO

-- ══════════════ 3. 中文注明(表 + 关键列) ══════════════
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.bs_bom_head') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'「BOM单」表头(金蝶云·星辰 /jdy/v2/bd/bom 同步)', N'SCHEMA', N'dbo', N'TABLE', N'bs_bom_head';
ELSE EXEC sp_addextendedproperty N'MS_Description', N'「BOM单」表头(金蝶云·星辰 /jdy/v2/bd/bom 同步)', N'SCHEMA', N'dbo', N'TABLE', N'bs_bom_head';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N'dbo.bs_bom_detail') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'「BOM单」子料分录(金蝶 material_entity)', N'SCHEMA', N'dbo', N'TABLE', N'bs_bom_detail';
ELSE EXEC sp_addextendedproperty N'MS_Description', N'「BOM单」子料分录(金蝶 material_entity)', N'SCHEMA', N'dbo', N'TABLE', N'bs_bom_detail';
GO
DECLARE @tbl sysname, @col sysname, @cmt nvarchar(300), @sql nvarchar(max);
DECLARE cc CURSOR LOCAL FAST_FORWARD FOR
  SELECT tbl, col, cmt FROM (VALUES
    (N'bs_bom_head', N'单据编号', N'金蝶 BOM 单编号(number);表头/分录分组列'),
    (N'bs_bom_head', N'产品编码', N'金蝶 product_number(母件)'),
    (N'bs_bom_head', N'产品名称', N'金蝶 product_name(母件)'),
    (N'bs_bom_head', N'版本号', N'金蝶 version'),
    (N'bs_bom_head', N'成品率', N'金蝶 yield(接口说明「成品率%」)'),
    (N'bs_bom_head', N'BOM备注', N'金蝶 bom_remark'),
    (N'bs_bom_head', N'跳过该层级领用下级物料', N'金蝶 isskip 1=是 0=否'),
    (N'bs_bom_head', N'审核状态', N'金蝶 status:Z=未审核 C=已审核'),
    (N'bs_bom_head', N'是否启用', N'金蝶 enable 1=启用 0=禁用'),
    (N'bs_bom_head', N'状态', N'MES 状态(启用/停用)'),
    (N'bs_bom_head', N'数据来源', N'金蝶 billsource(PMBD=WEB录入 WEBIMPORT=WEB引入)'),
    (N'bs_bom_head', N'产品单位', N'金蝶 product_unit_name'),
    (N'bs_bom_head', N'基本单位', N'金蝶 product_baseunit_name'),
    (N'bs_bom_head', N'辅助属性', N'金蝶 product_auxprop_name'),
    (N'bs_bom_head', N'审核人', N'金蝶 auditor_name'),
    (N'bs_bom_head', N'审核时间', N'金蝶 audit_time'),
    (N'bs_bom_head', N'外部数据ID', N'同步锚点:金蝶 BOM 单 id'),
    (N'bs_bom_head', N'外部指纹', N'指纹跳过用(列表级字段拼接;无变化不写库)'),
    (N'bs_bom_detail', N'单据编号', N'关联 bs_bom_head.单据编号'),
    (N'bs_bom_detail', N'行号', N'金蝶分录 seq'),
    (N'bs_bom_detail', N'子料编码', N'金蝶 material_number'),
    (N'bs_bom_detail', N'子料名称', N'金蝶 material_name'),
    (N'bs_bom_detail', N'子料单位', N'金蝶 material_unit_id → 计量单位档案 id→名称'),
    (N'bs_bom_detail', N'子料基本单位', N'金蝶 material_baseunit_id → 计量单位档案 id→名称'),
    (N'bs_bom_detail', N'材料用量', N'金蝶 dosage_numerator'),
    (N'bs_bom_detail', N'产品产量', N'金蝶 dosage_denominator'),
    (N'bs_bom_detail', N'单位用量', N'金蝶 unitqty'),
    (N'bs_bom_detail', N'损耗率', N'金蝶 scrap(接口说明「损耗率%」)'),
    (N'bs_bom_detail', N'固定损耗', N'金蝶 fixed_loss'),
    (N'bs_bom_detail', N'发料方式', N'金蝶 issue_pattern:D=直接领料 A=倒冲领料 B=不领料'),
    (N'bs_bom_detail', N'关键件', N'金蝶 iskeypieces 1=是 0=否'),
    (N'bs_bom_detail', N'替代件', N'金蝶 isrepitem 1=是 0=否'),
    (N'bs_bom_detail', N'工位', N'金蝶 machinepos'),
    (N'bs_bom_detail', N'发料仓库', N'金蝶 stock_name'),
    (N'bs_bom_detail', N'发料仓位', N'金蝶 sp_name'),
    (N'bs_bom_detail', N'物料备注', N'金蝶 material_remark'),
    (N'bs_bom_detail', N'物料备注1', N'金蝶 custom_txt1'),
    (N'bs_bom_detail', N'物料备注2', N'金蝶 custom_txt2'),
    (N'bs_bom_detail', N'物料备注3', N'金蝶 custom_txt3')
  ) v(tbl, col, cmt);
OPEN cc;
FETCH NEXT FROM cc INTO @tbl, @col, @cmt;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NOT NULL
  BEGIN
    SET @sql = N'IF EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID(N''dbo.' + @tbl + N''') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N''dbo.' + @tbl + N'''), N''' + @col + N''', ''ColumnId'') AND ep.name = N''MS_Description'')'
      + N' EXEC sp_updateextendedproperty N''MS_Description'', N''' + REPLACE(@cmt, '''', '''''') + N''', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''' + @col + N''';'
      + N' ELSE EXEC sp_addextendedproperty N''MS_Description'', N''' + REPLACE(@cmt, '''', '''''') + N''', N''SCHEMA'', N''dbo'', N''TABLE'', N''' + @tbl + N''', N''COLUMN'', N''' + @col + N''';';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cc INTO @tbl, @col, @cmt;
END
CLOSE cc;
DEALLOCATE cc;
GO

-- ══════════════ 4. 面板元数据 yj_panel ══════════════
-- mode=doc + head/line:表头+明细两层(与「组装BOM表」RD_ASM_BOM 同款结构);
-- prefix 留空(金蝶同步单据不自动编号)、date_col 留空(接口无单据日期)。
IF EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = 'BOM_KD')
    UPDATE dbo.yj_panel SET
        panel_name = N'BOM单', panel_name_en = 'BOM', category = N'基础档案', mode = 'doc',
        head_table = 'bs_bom_head', line_table = 'bs_bom_detail', group_col = '单据编号',
        pk_col = 'id', code_col = '单据编号', prefix = NULL, date_col = NULL,
        page_size = 50, detail_key = 'items', module_group = N'基础设置', config = NULL
    WHERE panel_code = 'BOM_KD';
ELSE
    INSERT INTO dbo.yj_panel (panel_code, panel_name, panel_name_en, category, mode, head_table, line_table,
                              group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
    VALUES ('BOM_KD', N'BOM单', 'BOM', N'基础档案', 'doc', 'bs_bom_head', 'bs_bom_detail',
            '单据编号', 'id', '单据编号', NULL, NULL, 50, 'items', N'基础设置');
GO

-- ══════════════ 5. 面板字段 yj_field(整表重建,幂等) ══════════════
-- 全部 editable=0:金蝶同步主数据,界面只读(与商品·来料检验同口径);visible=1、hidden=0。
DELETE FROM dbo.yj_field WHERE panel_code = 'BOM_KD';
GO
INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
VALUES
 ('BOM_KD', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1),
 ('BOM_KD', N'产品编码', N'产品编码', N'参照', 'INV', N'存货编码', N'存货名称', N'query,header', 20, 140, 0, 1, 0, 1),
 ('BOM_KD', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, N'query,header', 30, 200, 0, 0, 0, 1),
 ('BOM_KD', N'版本号', N'版本号', N'文本', NULL, NULL, NULL, N'header', 40, 100, 0, 0, 0, 1),
 ('BOM_KD', N'成品率', N'成品率', N'小数', NULL, NULL, NULL, N'header', 50, 100, 0, 0, 0, 1),
 ('BOM_KD', N'BOM备注', N'BOM备注', N'文本', NULL, NULL, NULL, N'header', 60, 220, 0, 0, 0, 1),
 ('BOM_KD', N'审核状态', N'审核状态', N'文本', NULL, NULL, NULL, N'header', 70, 100, 0, 0, 0, 1),
 ('BOM_KD', N'是否启用', N'是否启用', N'是否', NULL, NULL, NULL, N'header', 80, 90, 0, 0, 0, 1),
 ('BOM_KD', N'数据来源', N'数据来源', N'文本', NULL, NULL, NULL, N'header', 90, 110, 0, 0, 0, 1),
 ('BOM_KD', N'产品单位', N'产品单位', N'文本', NULL, NULL, NULL, N'header', 100, 110, 0, 0, 0, 1),
 ('BOM_KD', N'产品单位编码', N'产品单位编码', N'文本', NULL, NULL, NULL, N'header', 110, 120, 0, 0, 0, 1),
 ('BOM_KD', N'基本单位', N'基本单位', N'文本', NULL, NULL, NULL, N'header', 120, 110, 0, 0, 0, 1),
 ('BOM_KD', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL, N'header', 130, 120, 0, 0, 0, 1),
 ('BOM_KD', N'辅助属性', N'辅助属性', N'文本', NULL, NULL, NULL, N'header', 140, 140, 0, 0, 0, 1),
 ('BOM_KD', N'辅助属性编码', N'辅助属性编码', N'文本', NULL, NULL, NULL, N'header', 150, 130, 0, 0, 0, 1),
 ('BOM_KD', N'属性组1', N'属性组1', N'文本', NULL, NULL, NULL, N'header', 160, 140, 0, 0, 0, 1),
 ('BOM_KD', N'属性组2', N'属性组2', N'文本', NULL, NULL, NULL, N'header', 170, 140, 0, 0, 0, 1),
 ('BOM_KD', N'属性组3', N'属性组3', N'文本', NULL, NULL, NULL, N'header', 180, 140, 0, 0, 0, 1),
 ('BOM_KD', N'属性组4', N'属性组4', N'文本', NULL, NULL, NULL, N'header', 190, 140, 0, 0, 0, 1),
 ('BOM_KD', N'属性组5', N'属性组5', N'文本', NULL, NULL, NULL, N'header', 200, 140, 0, 0, 0, 1),
 ('BOM_KD', N'跳过该层级领用下级物料', N'跳过该层级领用下级物料', N'是否', NULL, NULL, NULL, N'header', 210, 180, 0, 0, 0, 1),
 ('BOM_KD', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, N'header', 220, 110, 0, 0, 0, 1),
 ('BOM_KD', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL, N'header', 230, 150, 0, 0, 0, 1),
 ('BOM_KD', N'行号', N'行号', N'整数', NULL, NULL, NULL, N'detail', 10, 70, 0, 0, 0, 1),
 ('BOM_KD', N'子料编码', N'子料编码', N'参照', 'INV', N'存货编码', N'存货名称', N'detail', 20, 140, 0, 1, 0, 1),
 ('BOM_KD', N'子料名称', N'子料名称', N'文本', NULL, NULL, NULL, N'detail', 30, 200, 0, 0, 0, 1),
 ('BOM_KD', N'子料单位', N'子料单位', N'文本', NULL, NULL, NULL, N'detail', 40, 110, 0, 0, 0, 1),
 ('BOM_KD', N'子料基本单位', N'子料基本单位', N'文本', NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, 1),
 ('BOM_KD', N'材料用量', N'材料用量', N'小数', NULL, NULL, NULL, N'detail', 60, 110, 0, 0, 0, 1),
 ('BOM_KD', N'产品产量', N'产品产量', N'小数', NULL, NULL, NULL, N'detail', 70, 110, 0, 0, 0, 1),
 ('BOM_KD', N'单位用量', N'单位用量', N'小数', NULL, NULL, NULL, N'detail', 80, 110, 0, 0, 0, 1),
 ('BOM_KD', N'损耗率', N'损耗率', N'小数', NULL, NULL, NULL, N'detail', 90, 100, 0, 0, 0, 1),
 ('BOM_KD', N'固定损耗', N'固定损耗', N'小数', NULL, NULL, NULL, N'detail', 100, 110, 0, 0, 0, 1),
 ('BOM_KD', N'发料方式', N'发料方式', N'文本', NULL, NULL, NULL, N'detail', 110, 110, 0, 0, 0, 1),
 ('BOM_KD', N'关键件', N'关键件', N'是否', NULL, NULL, NULL, N'detail', 120, 90, 0, 0, 0, 1),
 ('BOM_KD', N'替代件', N'替代件', N'是否', NULL, NULL, NULL, N'detail', 130, 90, 0, 0, 0, 1),
 ('BOM_KD', N'工位', N'工位', N'文本', NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, 1),
 ('BOM_KD', N'发料仓库', N'发料仓库', N'文本', NULL, NULL, NULL, N'detail', 150, 140, 0, 0, 0, 1),
 ('BOM_KD', N'发料仓库编码', N'发料仓库编码', N'文本', NULL, NULL, NULL, N'detail', 160, 140, 0, 0, 0, 1),
 ('BOM_KD', N'发料仓位', N'发料仓位', N'文本', NULL, NULL, NULL, N'detail', 170, 130, 0, 0, 0, 1),
 ('BOM_KD', N'发料仓位编码', N'发料仓位编码', N'文本', NULL, NULL, NULL, N'detail', 180, 140, 0, 0, 0, 1),
 ('BOM_KD', N'物料备注', N'物料备注', N'文本', NULL, NULL, NULL, N'detail', 190, 200, 0, 0, 0, 1),
 ('BOM_KD', N'物料备注1', N'物料备注1', N'文本', NULL, NULL, NULL, N'detail', 200, 150, 0, 0, 0, 1),
 ('BOM_KD', N'物料备注2', N'物料备注2', N'文本', NULL, NULL, NULL, N'detail', 210, 150, 0, 0, 0, 1),
 ('BOM_KD', N'物料备注3', N'物料备注3', N'文本', NULL, NULL, NULL, N'detail', 220, 150, 0, 0, 0, 1);
GO

-- ══════════════ 6. 多语言(yj_translation;已有译名不覆盖) ══════════════
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'BOM单' AND locale = 'en')
    INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'BOM单', 'en', N'BOM', 'manual');
GO
DECLARE @k nvarchar(200), @en nvarchar(300), @s nvarchar(max);
DECLARE tr CURSOR LOCAL FAST_FORWARD FOR
  SELECT k, en FROM (VALUES
    (N'成品率', N'Finished Rate'), (N'BOM备注', N'BOM Remark'), (N'审核状态', N'Audit Status'),
    (N'是否启用', N'Enabled'), (N'产品单位', N'Product Unit'), (N'产品单位编码', N'Product Unit Code'),
    (N'基本单位', N'Base Unit'), (N'材料用量', N'Material Qty'), (N'产品产量', N'Product Output'),
    (N'单位用量', N'Qty per Unit'), (N'属性组1', N'Aux Group 1'), (N'属性组2', N'Aux Group 2'),
    (N'属性组3', N'Aux Group 3'), (N'属性组4', N'Aux Group 4'), (N'属性组5', N'Aux Group 5'),
    (N'跳过该层级领用下级物料', N'Skip Level (Issue Sub-items Directly)'),
    (N'子料编码', N'Component Code'), (N'子料名称', N'Component Name'),
    (N'子料单位', N'Component Unit'), (N'子料基本单位', N'Component Base Unit'),
    (N'固定损耗', N'Fixed Loss'), (N'发料方式', N'Issue Pattern'), (N'关键件', N'Key Item'),
    (N'替代件', N'Substitute Item'), (N'工位', N'Work Position'),
    (N'发料仓库', N'Issue Warehouse'), (N'发料仓库编码', N'Issue Warehouse Code'),
    (N'发料仓位', N'Issue Bin'), (N'发料仓位编码', N'Issue Bin Code'),
    (N'物料备注', N'Material Remark'), (N'物料备注1', N'Material Remark 1'),
    (N'物料备注2', N'Material Remark 2'), (N'物料备注3', N'Material Remark 3'),
    (N'行号', N'Line No.')
  ) v(k, en);
OPEN tr;
FETCH NEXT FROM tr INTO @k, @en;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'field' AND ref_key = @k AND locale = 'en')
  BEGIN
    SET @s = N'INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source) VALUES (''field'', N''' + REPLACE(@k, '''', '''''') + N''', ''en'', N''' + REPLACE(@en, '''', '''''') + N''', ''manual'');';
    EXEC sp_executesql @s;
  END
  FETCH NEXT FROM tr INTO @k, @en;
END
CLOSE tr;
DEALLOCATE tr;
GO

-- ══════════════ 7. 自检 ══════════════
DECLARE @f int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = 'BOM_KD');
DECLARE @t int = (SELECT COUNT(*) FROM dbo.yj_field f WHERE f.panel_code = 'BOM_KD'
                    AND NOT EXISTS (SELECT 1 FROM dbo.yj_translation tr WHERE tr.scope = 'field' AND tr.ref_key = f.label AND tr.locale = 'en'));
DECLARE @bad int = (SELECT COUNT(*) FROM dbo.yj_field f
                    WHERE f.panel_code = 'BOM_KD' AND f.col_name IS NOT NULL
                      AND ((f.place LIKE '%header%' AND COL_LENGTH(N'dbo.bs_bom_head', f.col_name) IS NULL)
                        OR (f.place LIKE '%detail%' AND f.place NOT LIKE '%header%' AND COL_LENGTH(N'dbo.bs_bom_detail', f.col_name) IS NULL)));
PRINT N'[' + DB_NAME() + N'] BOM_KD 字段数=' + CAST(@f AS nvarchar(10))
    + N',缺 en 译名=' + CAST(@t AS nvarchar(10)) + N',列悬空=' + CAST(@bad AS nvarchar(10));
IF @f <> 45 RAISERROR(N'BOM_KD 字段数应为 45,实际不符', 16, 1);
IF @t <> 0 RAISERROR(N'BOM_KD 存在缺 en 译名的字段标签', 16, 1);
IF @bad <> 0 RAISERROR(N'BOM_KD 存在指向不存在物理列的字段', 16, 1);
GO
