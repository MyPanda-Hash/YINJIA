/* ============================================================
   migrate-other-docs-rebuild-20261014.sql — 2026-10-14
   其他入库单 / 其他出库单:重建三件套(单据 + 明细表 + 统计表)+ 字段对照金蝶 + 转ERP 支撑列

   由 tools/archive/_gen-other-docs-migration.mjs 生成(勿手改;改规格后重跑生成器)。

   背景(用户 2026-10-14 口径):「其他出库/入库也是一样(同产品入库:补转ERP、字段对照金蝶),
     详细和统计也要做」——这 6 个面板 + 10 张表 + 8 视图曾于 2026-10-08 整体下架
     (tools/migrate-drop-extra-docs-pu-req-20261008.sql;回退抓手 tools/archive/_panel-age/_backup-20261008/)
     本次按**金蝶接口字段**重建,面板编码/单号前缀/模块归属沿用下架前登记(OI/OO、库存核算)。

   字段取舍依据(实测,非推测):
     · 金蝶字段清单 tools/archive/_dump-out/kingdee-3docs-fields-1014.md
     · 逐键非空率   tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md(取样 30 张真实单据)
       其他入库 表头 48 键(恒空 26)/分录 73 键(恒空 44);其他出库 表头 45 键(恒空 20)/分录 73 键(恒空 52)
       ⇒ 只登记「有数据」的键 + 链路必需族(转ERP 回写/拉取幂等/金蝶状态);恒空键不登记(用户口径:不要无用数据)。
     · 保存接口     tools/archive/_dump-out/kingdee-save-inv-other-1014.md · kingdee-transtype-1014.md
       ⚠ 其他入库/出库保存**必须传 trans_type_id**(单发 number/name/trans_type 均报「请填写"业务类型"」),
         而金蝶**无业务类型档案接口**(9 条候选路径全 519)⇒ 按账套在 MES 侧配置(真实账套实测 12/13)。

   命名口径对照参照面板:表头/明细/视图列名沿用 bl_purchase_in / bl_material_out /
     v_purchase_in_detail / v_purchase_in_stats 的词汇(用户口径「显示字段对照采购入库单和销售出库单」)。

   幂等(OBJECT_ID 守卫 + NOT EXISTS + 末尾自检);两账套均执行。
   ============================================================ */
SET NOCOUNT ON;
GO
-- ① 建表 bd_other_in(其他入库单 表头)
IF OBJECT_ID(N'dbo.bd_other_in', N'U') IS NULL
CREATE TABLE dbo.bd_other_in (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据日期] date NULL,
    [单据编号] nvarchar(50) NULL,
    [单据状态] nvarchar(20) NULL,
    [业务类型] nvarchar(50) NULL,
    [业务类型编码] nvarchar(50) NULL,
    [业务类型id] nvarchar(20) NULL,
    [供应商编码] nvarchar(50) NULL,
    [供应商] nvarchar(100) NULL,
    [部门] nvarchar(50) NULL,
    [部门编码] nvarchar(50) NULL,
    [经手人] nvarchar(50) NULL,
    [经手人编码] nvarchar(50) NULL,
    [备注] nvarchar(500) NULL,
    [创建人] nvarchar(50) NULL,
    [创建时间] nvarchar(30) NULL,
    [修改人] nvarchar(50) NULL,
    [修改时间] nvarchar(30) NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    [外部数据ID] nvarchar(50) NULL,
    [外部单据号] nvarchar(50) NULL,
    [外部指纹] nvarchar(200) NULL,
    [是否已转ERP] nvarchar(10) NULL,
    [ERP单号] nvarchar(50) NULL,
    [转ERP操作人] nvarchar(50) NULL,
    [转ERP时间] datetime2 NULL,
    [金蝶单据状态] nvarchar(20) NULL,
    [金蝶审核人] nvarchar(50) NULL,
    [金蝶审核时间] nvarchar(30) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL,
    [备用1] nvarchar(100) NULL, [备用2] nvarchar(100) NULL, [备用3] nvarchar(100) NULL, [备用4] nvarchar(100) NULL, [备用5] nvarchar(100) NULL, [备用6] nvarchar(100) NULL, [备用7] nvarchar(100) NULL, [备用8] nvarchar(100) NULL, [备用9] nvarchar(100) NULL, [备用10] nvarchar(100) NULL, [备用11] nvarchar(100) NULL, [备用12] nvarchar(100) NULL, [备用13] nvarchar(100) NULL, [备用14] nvarchar(100) NULL, [备用15] nvarchar(100) NULL, [备用16] nvarchar(100) NULL, [备用17] nvarchar(100) NULL, [备用18] nvarchar(100) NULL, [备用19] nvarchar(100) NULL, [备用20] nvarchar(100) NULL
);
GO
-- ① 建表 bl_other_in(其他入库单 明细)
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NULL
CREATE TABLE dbo.bl_other_in (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据编号] nvarchar(50) NULL,
    [序号] int NULL,
    [存货编码] nvarchar(50) NULL,
    [存货名称] nvarchar(100) NULL,
    [规格型号] nvarchar(100) NULL,
    [仓库] nvarchar(50) NULL,
    [仓库编码] nvarchar(50) NULL,
    [计量单位] nvarchar(20) NULL,
    [基本单位名称] nvarchar(50) NULL,
    [基本单位编码] nvarchar(50) NULL,
    [基本单位id] nvarchar(50) NULL,
    [辅助单位名称] nvarchar(50) NULL,
    [辅助单位编码] nvarchar(50) NULL,
    [辅助单位id] nvarchar(50) NULL,
    [换算率] nvarchar(50) NULL,
    [换算系数] nvarchar(50) NULL,
    [辅助换算系数] nvarchar(50) NULL,
    [数量] decimal(18,4) NULL,
    [辅助数量] decimal(18,4) NULL,
    [库存数量] nvarchar(50) NULL,
    [单价] decimal(18,4) NULL,
    [金额] decimal(18,4) NULL,
    [明细备注] nvarchar(200) NULL,
    [批号] nvarchar(50) NULL,
    [成本] nvarchar(50) NULL,
    [单位成本] nvarchar(50) NULL,
    [存货图片] nvarchar(300) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL,
    [备用1] nvarchar(100) NULL, [备用2] nvarchar(100) NULL, [备用3] nvarchar(100) NULL, [备用4] nvarchar(100) NULL, [备用5] nvarchar(100) NULL, [备用6] nvarchar(100) NULL, [备用7] nvarchar(100) NULL, [备用8] nvarchar(100) NULL, [备用9] nvarchar(100) NULL, [备用10] nvarchar(100) NULL, [备用11] nvarchar(100) NULL, [备用12] nvarchar(100) NULL, [备用13] nvarchar(100) NULL, [备用14] nvarchar(100) NULL, [备用15] nvarchar(100) NULL, [备用16] nvarchar(100) NULL, [备用17] nvarchar(100) NULL, [备用18] nvarchar(100) NULL, [备用19] nvarchar(100) NULL, [备用20] nvarchar(100) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bl_other_in_docno' AND object_id = OBJECT_ID(N'dbo.bl_other_in'))
    CREATE INDEX ix_bl_other_in_docno ON dbo.bl_other_in([单据编号]);
GO
-- ①b 防御性补列(bd_other_in / bl_other_in:列缺失即补,幂等)
IF COL_LENGTH(N'dbo.bd_other_in', N'单据日期') IS NULL ALTER TABLE dbo.bd_other_in ADD [单据日期] date NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'单据日期') IS NULL ALTER TABLE dbo.bd_other_in ADD [单据日期] date NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'单据编号') IS NULL ALTER TABLE dbo.bd_other_in ADD [单据编号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'单据状态') IS NULL ALTER TABLE dbo.bd_other_in ADD [单据状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型') IS NULL ALTER TABLE dbo.bd_other_in ADD [业务类型] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型编码') IS NULL ALTER TABLE dbo.bd_other_in ADD [业务类型编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型id') IS NULL ALTER TABLE dbo.bd_other_in ADD [业务类型id] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'供应商编码') IS NULL ALTER TABLE dbo.bd_other_in ADD [供应商编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'供应商') IS NULL ALTER TABLE dbo.bd_other_in ADD [供应商] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'部门') IS NULL ALTER TABLE dbo.bd_other_in ADD [部门] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'部门编码') IS NULL ALTER TABLE dbo.bd_other_in ADD [部门编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'经手人') IS NULL ALTER TABLE dbo.bd_other_in ADD [经手人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'经手人编码') IS NULL ALTER TABLE dbo.bd_other_in ADD [经手人编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备注') IS NULL ALTER TABLE dbo.bd_other_in ADD [备注] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'创建人') IS NULL ALTER TABLE dbo.bd_other_in ADD [创建人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'创建时间') IS NULL ALTER TABLE dbo.bd_other_in ADD [创建时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'修改人') IS NULL ALTER TABLE dbo.bd_other_in ADD [修改人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'修改时间') IS NULL ALTER TABLE dbo.bd_other_in ADD [修改时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'审核人') IS NULL ALTER TABLE dbo.bd_other_in ADD [审核人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'审核时间') IS NULL ALTER TABLE dbo.bd_other_in ADD [审核时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'外部数据ID') IS NULL ALTER TABLE dbo.bd_other_in ADD [外部数据ID] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'外部单据号') IS NULL ALTER TABLE dbo.bd_other_in ADD [外部单据号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'外部指纹') IS NULL ALTER TABLE dbo.bd_other_in ADD [外部指纹] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'是否已转ERP') IS NULL ALTER TABLE dbo.bd_other_in ADD [是否已转ERP] nvarchar(10) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'ERP单号') IS NULL ALTER TABLE dbo.bd_other_in ADD [ERP单号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'转ERP操作人') IS NULL ALTER TABLE dbo.bd_other_in ADD [转ERP操作人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'转ERP时间') IS NULL ALTER TABLE dbo.bd_other_in ADD [转ERP时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶单据状态') IS NULL ALTER TABLE dbo.bd_other_in ADD [金蝶单据状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶审核人') IS NULL ALTER TABLE dbo.bd_other_in ADD [金蝶审核人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶审核时间') IS NULL ALTER TABLE dbo.bd_other_in ADD [金蝶审核时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_user1') IS NULL ALTER TABLE dbo.bd_other_in ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_time1') IS NULL ALTER TABLE dbo.bd_other_in ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_user2') IS NULL ALTER TABLE dbo.bd_other_in ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_time2') IS NULL ALTER TABLE dbo.bd_other_in ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_cancel') IS NULL ALTER TABLE dbo.bd_other_in ADD [asp_cancel] char(1) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用1') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用1] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用2') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用2] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用3') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用3] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用4') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用4] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用5') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用5] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用6') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用6] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用7') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用7] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用8') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用8] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用9') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用9] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用10') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用10] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用11') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用11] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用12') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用12] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用13') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用13] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用14') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用14] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用15') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用15] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用16') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用16] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用17') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用17] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用18') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用18] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用19') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用19] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_in', N'备用20') IS NULL ALTER TABLE dbo.bd_other_in ADD [备用20] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'单据编号') IS NULL ALTER TABLE dbo.bl_other_in ADD [单据编号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'序号') IS NULL ALTER TABLE dbo.bl_other_in ADD [序号] int NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'存货编码') IS NULL ALTER TABLE dbo.bl_other_in ADD [存货编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'存货名称') IS NULL ALTER TABLE dbo.bl_other_in ADD [存货名称] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'规格型号') IS NULL ALTER TABLE dbo.bl_other_in ADD [规格型号] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'仓库') IS NULL ALTER TABLE dbo.bl_other_in ADD [仓库] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'仓库编码') IS NULL ALTER TABLE dbo.bl_other_in ADD [仓库编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'计量单位') IS NULL ALTER TABLE dbo.bl_other_in ADD [计量单位] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_other_in ADD [基本单位名称] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_other_in ADD [基本单位编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位id') IS NULL ALTER TABLE dbo.bl_other_in ADD [基本单位id] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位名称') IS NULL ALTER TABLE dbo.bl_other_in ADD [辅助单位名称] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_other_in ADD [辅助单位编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_other_in ADD [辅助单位id] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'换算率') IS NULL ALTER TABLE dbo.bl_other_in ADD [换算率] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'换算系数') IS NULL ALTER TABLE dbo.bl_other_in ADD [换算系数] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助换算系数') IS NULL ALTER TABLE dbo.bl_other_in ADD [辅助换算系数] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'数量') IS NULL ALTER TABLE dbo.bl_other_in ADD [数量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助数量') IS NULL ALTER TABLE dbo.bl_other_in ADD [辅助数量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'库存数量') IS NULL ALTER TABLE dbo.bl_other_in ADD [库存数量] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'单价') IS NULL ALTER TABLE dbo.bl_other_in ADD [单价] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'金额') IS NULL ALTER TABLE dbo.bl_other_in ADD [金额] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'明细备注') IS NULL ALTER TABLE dbo.bl_other_in ADD [明细备注] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'批号') IS NULL ALTER TABLE dbo.bl_other_in ADD [批号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'成本') IS NULL ALTER TABLE dbo.bl_other_in ADD [成本] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'单位成本') IS NULL ALTER TABLE dbo.bl_other_in ADD [单位成本] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'存货图片') IS NULL ALTER TABLE dbo.bl_other_in ADD [存货图片] nvarchar(300) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_user1') IS NULL ALTER TABLE dbo.bl_other_in ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_time1') IS NULL ALTER TABLE dbo.bl_other_in ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_user2') IS NULL ALTER TABLE dbo.bl_other_in ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_time2') IS NULL ALTER TABLE dbo.bl_other_in ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_cancel') IS NULL ALTER TABLE dbo.bl_other_in ADD [asp_cancel] char(1) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用1') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用1] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用2') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用2] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用3') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用3] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用4') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用4] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用5') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用5] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用6') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用6] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用7') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用7] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用8') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用8] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用9') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用9] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用10') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用10] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用11') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用11] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用12') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用12] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用13') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用13] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用14') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用14] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用15') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用15] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用16') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用16] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用17') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用17] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用18') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用18] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用19') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用19] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_in', N'备用20') IS NULL ALTER TABLE dbo.bl_other_in ADD [备用20] nvarchar(100) NULL;
GO
-- ① 建表 bd_other_out(其他出库单 表头)
IF OBJECT_ID(N'dbo.bd_other_out', N'U') IS NULL
CREATE TABLE dbo.bd_other_out (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据日期] date NULL,
    [单据编号] nvarchar(50) NULL,
    [单据状态] nvarchar(20) NULL,
    [业务类型] nvarchar(50) NULL,
    [业务类型编码] nvarchar(50) NULL,
    [业务类型id] nvarchar(20) NULL,
    [部门] nvarchar(50) NULL,
    [部门编码] nvarchar(50) NULL,
    [经手人] nvarchar(50) NULL,
    [经手人编码] nvarchar(50) NULL,
    [备注] nvarchar(500) NULL,
    [创建人] nvarchar(50) NULL,
    [创建时间] nvarchar(30) NULL,
    [修改人] nvarchar(50) NULL,
    [修改时间] nvarchar(30) NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    [外部数据ID] nvarchar(50) NULL,
    [外部单据号] nvarchar(50) NULL,
    [外部指纹] nvarchar(200) NULL,
    [是否已转ERP] nvarchar(10) NULL,
    [ERP单号] nvarchar(50) NULL,
    [转ERP操作人] nvarchar(50) NULL,
    [转ERP时间] datetime2 NULL,
    [金蝶单据状态] nvarchar(20) NULL,
    [金蝶审核人] nvarchar(50) NULL,
    [金蝶审核时间] nvarchar(30) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL,
    [备用1] nvarchar(100) NULL, [备用2] nvarchar(100) NULL, [备用3] nvarchar(100) NULL, [备用4] nvarchar(100) NULL, [备用5] nvarchar(100) NULL, [备用6] nvarchar(100) NULL, [备用7] nvarchar(100) NULL, [备用8] nvarchar(100) NULL, [备用9] nvarchar(100) NULL, [备用10] nvarchar(100) NULL, [备用11] nvarchar(100) NULL, [备用12] nvarchar(100) NULL, [备用13] nvarchar(100) NULL, [备用14] nvarchar(100) NULL, [备用15] nvarchar(100) NULL, [备用16] nvarchar(100) NULL, [备用17] nvarchar(100) NULL, [备用18] nvarchar(100) NULL, [备用19] nvarchar(100) NULL, [备用20] nvarchar(100) NULL
);
GO
-- ① 建表 bl_other_out(其他出库单 明细)
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NULL
CREATE TABLE dbo.bl_other_out (
    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [单据编号] nvarchar(50) NULL,
    [序号] int NULL,
    [存货编码] nvarchar(50) NULL,
    [存货名称] nvarchar(100) NULL,
    [规格型号] nvarchar(100) NULL,
    [仓库] nvarchar(50) NULL,
    [仓库编码] nvarchar(50) NULL,
    [计量单位] nvarchar(20) NULL,
    [基本单位名称] nvarchar(50) NULL,
    [基本单位编码] nvarchar(50) NULL,
    [基本单位id] nvarchar(50) NULL,
    [辅助单位名称] nvarchar(50) NULL,
    [辅助单位编码] nvarchar(50) NULL,
    [辅助单位id] nvarchar(50) NULL,
    [换算率] nvarchar(50) NULL,
    [换算系数] nvarchar(50) NULL,
    [辅助换算系数] nvarchar(50) NULL,
    [数量] decimal(18,4) NULL,
    [辅助数量] decimal(18,4) NULL,
    [库存数量] nvarchar(50) NULL,
    [单价] decimal(18,4) NULL,
    [金额] decimal(18,4) NULL,
    [明细备注] nvarchar(200) NULL,
    [批号] nvarchar(50) NULL,
    asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL,
    [备用1] nvarchar(100) NULL, [备用2] nvarchar(100) NULL, [备用3] nvarchar(100) NULL, [备用4] nvarchar(100) NULL, [备用5] nvarchar(100) NULL, [备用6] nvarchar(100) NULL, [备用7] nvarchar(100) NULL, [备用8] nvarchar(100) NULL, [备用9] nvarchar(100) NULL, [备用10] nvarchar(100) NULL, [备用11] nvarchar(100) NULL, [备用12] nvarchar(100) NULL, [备用13] nvarchar(100) NULL, [备用14] nvarchar(100) NULL, [备用15] nvarchar(100) NULL, [备用16] nvarchar(100) NULL, [备用17] nvarchar(100) NULL, [备用18] nvarchar(100) NULL, [备用19] nvarchar(100) NULL, [备用20] nvarchar(100) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bl_other_out_docno' AND object_id = OBJECT_ID(N'dbo.bl_other_out'))
    CREATE INDEX ix_bl_other_out_docno ON dbo.bl_other_out([单据编号]);
GO
-- ①b 防御性补列(bd_other_out / bl_other_out:列缺失即补,幂等)
IF COL_LENGTH(N'dbo.bd_other_out', N'单据日期') IS NULL ALTER TABLE dbo.bd_other_out ADD [单据日期] date NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'单据日期') IS NULL ALTER TABLE dbo.bd_other_out ADD [单据日期] date NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'单据编号') IS NULL ALTER TABLE dbo.bd_other_out ADD [单据编号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'单据状态') IS NULL ALTER TABLE dbo.bd_other_out ADD [单据状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型') IS NULL ALTER TABLE dbo.bd_other_out ADD [业务类型] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型编码') IS NULL ALTER TABLE dbo.bd_other_out ADD [业务类型编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型id') IS NULL ALTER TABLE dbo.bd_other_out ADD [业务类型id] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'部门') IS NULL ALTER TABLE dbo.bd_other_out ADD [部门] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'部门编码') IS NULL ALTER TABLE dbo.bd_other_out ADD [部门编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'经手人') IS NULL ALTER TABLE dbo.bd_other_out ADD [经手人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'经手人编码') IS NULL ALTER TABLE dbo.bd_other_out ADD [经手人编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备注') IS NULL ALTER TABLE dbo.bd_other_out ADD [备注] nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'创建人') IS NULL ALTER TABLE dbo.bd_other_out ADD [创建人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'创建时间') IS NULL ALTER TABLE dbo.bd_other_out ADD [创建时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'修改人') IS NULL ALTER TABLE dbo.bd_other_out ADD [修改人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'修改时间') IS NULL ALTER TABLE dbo.bd_other_out ADD [修改时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'审核人') IS NULL ALTER TABLE dbo.bd_other_out ADD [审核人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'审核时间') IS NULL ALTER TABLE dbo.bd_other_out ADD [审核时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'外部数据ID') IS NULL ALTER TABLE dbo.bd_other_out ADD [外部数据ID] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'外部单据号') IS NULL ALTER TABLE dbo.bd_other_out ADD [外部单据号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'外部指纹') IS NULL ALTER TABLE dbo.bd_other_out ADD [外部指纹] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'是否已转ERP') IS NULL ALTER TABLE dbo.bd_other_out ADD [是否已转ERP] nvarchar(10) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'ERP单号') IS NULL ALTER TABLE dbo.bd_other_out ADD [ERP单号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'转ERP操作人') IS NULL ALTER TABLE dbo.bd_other_out ADD [转ERP操作人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'转ERP时间') IS NULL ALTER TABLE dbo.bd_other_out ADD [转ERP时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶单据状态') IS NULL ALTER TABLE dbo.bd_other_out ADD [金蝶单据状态] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶审核人') IS NULL ALTER TABLE dbo.bd_other_out ADD [金蝶审核人] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶审核时间') IS NULL ALTER TABLE dbo.bd_other_out ADD [金蝶审核时间] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_user1') IS NULL ALTER TABLE dbo.bd_other_out ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_time1') IS NULL ALTER TABLE dbo.bd_other_out ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_user2') IS NULL ALTER TABLE dbo.bd_other_out ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_time2') IS NULL ALTER TABLE dbo.bd_other_out ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_cancel') IS NULL ALTER TABLE dbo.bd_other_out ADD [asp_cancel] char(1) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用1') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用1] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用2') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用2] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用3') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用3] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用4') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用4] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用5') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用5] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用6') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用6] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用7') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用7] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用8') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用8] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用9') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用9] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用10') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用10] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用11') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用11] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用12') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用12] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用13') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用13] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用14') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用14] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用15') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用15] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用16') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用16] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用17') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用17] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用18') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用18] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用19') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用19] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bd_other_out', N'备用20') IS NULL ALTER TABLE dbo.bd_other_out ADD [备用20] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'单据编号') IS NULL ALTER TABLE dbo.bl_other_out ADD [单据编号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'序号') IS NULL ALTER TABLE dbo.bl_other_out ADD [序号] int NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'存货编码') IS NULL ALTER TABLE dbo.bl_other_out ADD [存货编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'存货名称') IS NULL ALTER TABLE dbo.bl_other_out ADD [存货名称] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'规格型号') IS NULL ALTER TABLE dbo.bl_other_out ADD [规格型号] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'仓库') IS NULL ALTER TABLE dbo.bl_other_out ADD [仓库] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'仓库编码') IS NULL ALTER TABLE dbo.bl_other_out ADD [仓库编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'计量单位') IS NULL ALTER TABLE dbo.bl_other_out ADD [计量单位] nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位名称') IS NULL ALTER TABLE dbo.bl_other_out ADD [基本单位名称] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位编码') IS NULL ALTER TABLE dbo.bl_other_out ADD [基本单位编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位id') IS NULL ALTER TABLE dbo.bl_other_out ADD [基本单位id] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位名称') IS NULL ALTER TABLE dbo.bl_other_out ADD [辅助单位名称] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位编码') IS NULL ALTER TABLE dbo.bl_other_out ADD [辅助单位编码] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位id') IS NULL ALTER TABLE dbo.bl_other_out ADD [辅助单位id] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'换算率') IS NULL ALTER TABLE dbo.bl_other_out ADD [换算率] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'换算系数') IS NULL ALTER TABLE dbo.bl_other_out ADD [换算系数] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助换算系数') IS NULL ALTER TABLE dbo.bl_other_out ADD [辅助换算系数] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'数量') IS NULL ALTER TABLE dbo.bl_other_out ADD [数量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助数量') IS NULL ALTER TABLE dbo.bl_other_out ADD [辅助数量] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'库存数量') IS NULL ALTER TABLE dbo.bl_other_out ADD [库存数量] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'单价') IS NULL ALTER TABLE dbo.bl_other_out ADD [单价] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'金额') IS NULL ALTER TABLE dbo.bl_other_out ADD [金额] decimal(18,4) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'明细备注') IS NULL ALTER TABLE dbo.bl_other_out ADD [明细备注] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'批号') IS NULL ALTER TABLE dbo.bl_other_out ADD [批号] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_user1') IS NULL ALTER TABLE dbo.bl_other_out ADD [asp_user1] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_time1') IS NULL ALTER TABLE dbo.bl_other_out ADD [asp_time1] datetime2 NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_user2') IS NULL ALTER TABLE dbo.bl_other_out ADD [asp_user2] nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_time2') IS NULL ALTER TABLE dbo.bl_other_out ADD [asp_time2] datetime2 NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_cancel') IS NULL ALTER TABLE dbo.bl_other_out ADD [asp_cancel] char(1) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用1') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用1] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用2') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用2] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用3') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用3] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用4') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用4] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用5') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用5] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用6') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用6] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用7') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用7] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用8') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用8] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用9') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用9] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用10') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用10] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用11') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用11] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用12') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用12] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用13') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用13] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用14') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用14] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用15') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用15] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用16') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用16] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用17') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用17] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用18') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用18] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用19') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用19] nvarchar(100) NULL;
IF COL_LENGTH(N'dbo.bl_other_out', N'备用20') IS NULL ALTER TABLE dbo.bl_other_out ADD [备用20] nvarchar(100) NULL;
GO
-- ② 中文注明(bd_other_in / bl_other_in)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=0 AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'其他入库单表头(金蝶 inv_other_in 镜像;2026-10-08 下架后于 2026-10-14 按金蝶字段重建)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=0 AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'其他入库单明细(金蝶 inv_other_in 分录镜像)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in';
GO
IF COL_LENGTH(N'dbo.bd_other_in', N'单据日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'单据日期', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据日期(金蝶 bill_date)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'单据日期';
IF COL_LENGTH(N'dbo.bd_other_in', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号;金蝶侧单号存 外部单据号)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bd_other_in', N'单据状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'单据状态', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据状态(MES 单据状态快照;面板不登记该字段,界面状态由 yj_doc_status 派生 —— 与采购入库单/产成品入库单/材料出库单同款)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'单据状态';
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'业务类型', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型(金蝶 trans_type_name;候选 = 其他入库)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'业务类型';
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'业务类型编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型编码(金蝶 trans_type_number,如 QTRKLX01/QTCKLX01)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'业务类型编码';
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'业务类型id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型id(金蝶 trans_type_id,保存接口**必需**;无档案接口故按账套配置:真实账套 其他入库=12 / 其他出库=13)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'业务类型id';
IF COL_LENGTH(N'dbo.bd_other_in', N'供应商编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'供应商编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'供应商编码(金蝶 supplier_number;其他入库实测 100% 有值)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'供应商编码';
IF COL_LENGTH(N'dbo.bd_other_in', N'供应商') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'供应商', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'供应商(金蝶 supplier_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'供应商';
IF COL_LENGTH(N'dbo.bd_other_in', N'部门') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'部门', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'部门(金蝶 dept_name;参照部门档案)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'部门';
IF COL_LENGTH(N'dbo.bd_other_in', N'部门编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'部门编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'部门编码(金蝶 dept_number;转ERP 推 dept_number)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'部门编码';
IF COL_LENGTH(N'dbo.bd_other_in', N'经手人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'经手人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'经手人(金蝶 emp_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'经手人';
IF COL_LENGTH(N'dbo.bd_other_in', N'经手人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'经手人编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'经手人编码(金蝶 emp_number;转ERP 推 emp_number)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'经手人编码';
IF COL_LENGTH(N'dbo.bd_other_in', N'备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'备注', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注(金蝶 remark)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'备注';
IF COL_LENGTH(N'dbo.bd_other_in', N'创建人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'创建人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人(金蝶 creator_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'创建人';
IF COL_LENGTH(N'dbo.bd_other_in', N'创建时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'创建时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间(金蝶 create_time;按同族面板惯例存文本)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'创建时间';
IF COL_LENGTH(N'dbo.bd_other_in', N'修改人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'修改人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(金蝶 modifier_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'修改人';
IF COL_LENGTH(N'dbo.bd_other_in', N'修改时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'修改时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(金蝶 modify_time)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'修改时间';
IF COL_LENGTH(N'dbo.bd_other_in', N'审核人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'审核人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人(MES 审核留痕 / 金蝶 auditor_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'审核人';
IF COL_LENGTH(N'dbo.bd_other_in', N'审核时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'审核时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间(金蝶 audit_time)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'审核时间';
IF COL_LENGTH(N'dbo.bd_other_in', N'外部数据ID') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'外部数据ID', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部数据ID(金蝶单据内部 id;拉取同步幂等键,与 bd_so_order/bd_pu_order 同款)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'外部数据ID';
IF COL_LENGTH(N'dbo.bd_other_in', N'外部单据号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'外部单据号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部单据号(金蝶侧单号,如 QTRK-20261014-00092 / QTCK-20261014-01172)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'外部单据号';
IF COL_LENGTH(N'dbo.bd_other_in', N'外部指纹') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'外部指纹', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部指纹(金蝶关键字段拼接,增量同步变更判据)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'外部指纹';
IF COL_LENGTH(N'dbo.bd_other_in', N'是否已转ERP') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'是否已转ERP', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'是否已转ERP(转ERP 成功置「是」;弃审由 ButtonService 清回「否」)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'是否已转ERP';
IF COL_LENGTH(N'dbo.bd_other_in', N'ERP单号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'ERP单号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'ERP单号(金蝶保存响应 data.id_number_map 回写)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'ERP单号';
IF COL_LENGTH(N'dbo.bd_other_in', N'转ERP操作人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'转ERP操作人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP操作人', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'转ERP操作人';
IF COL_LENGTH(N'dbo.bd_other_in', N'转ERP时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'转ERP时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'转ERP时间';
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶单据状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'金蝶单据状态', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶单据状态(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'金蝶单据状态';
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶审核人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'金蝶审核人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核人(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'金蝶审核人';
IF COL_LENGTH(N'dbo.bd_other_in', N'金蝶审核时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'金蝶审核时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核时间(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'金蝶审核时间';
IF COL_LENGTH(N'dbo.bl_other_in', N'序号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'序号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'序号(金蝶分录 seq)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'序号';
IF COL_LENGTH(N'dbo.bl_other_in', N'存货编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'存货编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'存货编码(金蝶 material_number;参照商品档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'存货编码';
IF COL_LENGTH(N'dbo.bl_other_in', N'存货名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'存货名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'存货名称(金蝶 material_name;参照商品档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'存货名称';
IF COL_LENGTH(N'dbo.bl_other_in', N'规格型号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'规格型号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'规格型号(金蝶 material_model)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'规格型号';
IF COL_LENGTH(N'dbo.bl_other_in', N'仓库') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'仓库', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库(金蝶 stock_name;参照仓库档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'仓库';
IF COL_LENGTH(N'dbo.bl_other_in', N'仓库编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'仓库编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库编码(金蝶 stock_number;转ERP 按它解析 stock_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'仓库编码';
IF COL_LENGTH(N'dbo.bl_other_in', N'计量单位') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'计量单位', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(金蝶 unit_name)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'计量单位';
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'基本单位名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位名称(金蝶 base_unit_name)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'基本单位名称';
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'基本单位编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位编码(金蝶 base_unit_number)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'基本单位编码';
IF COL_LENGTH(N'dbo.bl_other_in', N'基本单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'基本单位id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位id(金蝶 base_unit_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'基本单位id';
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'辅助单位名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'辅助单位名称';
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'辅助单位编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位编码(金蝶 aux_unit_number)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'辅助单位编码';
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'辅助单位id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位id(金蝶 aux_unit_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'辅助单位id';
IF COL_LENGTH(N'dbo.bl_other_in', N'换算率') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'换算率', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'换算率';
IF COL_LENGTH(N'dbo.bl_other_in', N'换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'换算系数', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'换算系数(金蝶 coefficient)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'换算系数';
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'辅助换算系数', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助换算系数(金蝶 aux_coefficient)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'辅助换算系数';
IF COL_LENGTH(N'dbo.bl_other_in', N'数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'数量(金蝶 qty;主单位数量)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'数量';
IF COL_LENGTH(N'dbo.bl_other_in', N'辅助数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'辅助数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助数量(金蝶 aux_qty;多单位商品才有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'辅助数量';
IF COL_LENGTH(N'dbo.bl_other_in', N'库存数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'库存数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'库存数量(金蝶 inv_qty;同族面板惯例存文本)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'库存数量';
IF COL_LENGTH(N'dbo.bl_other_in', N'单价') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'单价', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单价(业务单价)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'单价';
IF COL_LENGTH(N'dbo.bl_other_in', N'金额') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'金额', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金额', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'金额';
IF COL_LENGTH(N'dbo.bl_other_in', N'明细备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'明细备注', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'明细备注(金蝶 comment;列名 备注,标签 明细备注 —— 与表头「备注」区分)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'明细备注';
IF COL_LENGTH(N'dbo.bl_other_in', N'批号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'批号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号(金蝶 batch_no;其他入库实测 0% 有值,但**库存记账要用它做库存键**——与采购入库/产成品入库/其他出库同款,故建列并登记)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'批号';
IF COL_LENGTH(N'dbo.bl_other_in', N'成本') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'成本', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'成本(金蝶 cost;其他入库实测 19% 行有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'成本';
IF COL_LENGTH(N'dbo.bl_other_in', N'单位成本') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'单位成本', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单位成本(金蝶 unit_cost;其他入库实测 19% 行有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'单位成本';
IF COL_LENGTH(N'dbo.bl_other_in', N'存货图片') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'存货图片', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'存货图片(金蝶 picture;其他入库实测 14% 行有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'存货图片';
GO
IF COL_LENGTH(N'dbo.bd_other_in', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bd_other_in', N'单据日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'单据日期', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据日期', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'单据日期';
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'asp_user1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'asp_time1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单时间(审计四件套;明细/统计视图的「创建时间/制单人」取此列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'asp_user2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'asp_time2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.bd_other_in', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_in'), N'asp_cancel', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'作废标记(Y=已作废)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_in', N'COLUMN', N'asp_cancel';
IF COL_LENGTH(N'dbo.bl_other_in', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'asp_user1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'asp_time1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单时间(审计四件套;明细/统计视图的「创建时间/制单人」取此列)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'asp_user2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'asp_time2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.bl_other_in', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_in') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_in'), N'asp_cancel', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'作废标记(Y=已作废)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_in', N'COLUMN', N'asp_cancel';
GO
-- ② 中文注明(bd_other_out / bl_other_out)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=0 AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'其他出库单表头(金蝶 inv_other_out 镜像;2026-10-08 下架后于 2026-10-14 按金蝶字段重建)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=0 AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'其他出库单明细(金蝶 inv_other_out 分录镜像)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out';
GO
IF COL_LENGTH(N'dbo.bd_other_out', N'单据日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'单据日期', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据日期(金蝶 bill_date)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'单据日期';
IF COL_LENGTH(N'dbo.bd_other_out', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号;金蝶侧单号存 外部单据号)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bd_other_out', N'单据状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'单据状态', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据状态(MES 单据状态快照;面板不登记该字段,界面状态由 yj_doc_status 派生 —— 与采购入库单/产成品入库单/材料出库单同款)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'单据状态';
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'业务类型', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型(金蝶 trans_type_name;候选 = 其他出库)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'业务类型';
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'业务类型编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型编码(金蝶 trans_type_number,如 QTRKLX01/QTCKLX01)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'业务类型编码';
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'业务类型id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务类型id(金蝶 trans_type_id,保存接口**必需**;无档案接口故按账套配置:真实账套 其他入库=12 / 其他出库=13)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'业务类型id';
IF COL_LENGTH(N'dbo.bd_other_out', N'部门') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'部门', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'部门(金蝶 dept_name;其他出库实测 97% 有值;参照部门档案)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'部门';
IF COL_LENGTH(N'dbo.bd_other_out', N'部门编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'部门编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'部门编码(金蝶 dept_number;转ERP 推 dept_number)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'部门编码';
IF COL_LENGTH(N'dbo.bd_other_out', N'经手人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'经手人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'经手人(金蝶 emp_name;其他出库实测 97% 有值)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'经手人';
IF COL_LENGTH(N'dbo.bd_other_out', N'经手人编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'经手人编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'经手人编码(金蝶 emp_number;转ERP 推 emp_number)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'经手人编码';
IF COL_LENGTH(N'dbo.bd_other_out', N'备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'备注', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注(金蝶 remark)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'备注';
IF COL_LENGTH(N'dbo.bd_other_out', N'创建人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'创建人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人(金蝶 creator_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'创建人';
IF COL_LENGTH(N'dbo.bd_other_out', N'创建时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'创建时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间(金蝶 create_time;按同族面板惯例存文本)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'创建时间';
IF COL_LENGTH(N'dbo.bd_other_out', N'修改人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'修改人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(金蝶 modifier_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'修改人';
IF COL_LENGTH(N'dbo.bd_other_out', N'修改时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'修改时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(金蝶 modify_time)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'修改时间';
IF COL_LENGTH(N'dbo.bd_other_out', N'审核人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'审核人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人(MES 审核留痕 / 金蝶 auditor_name)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'审核人';
IF COL_LENGTH(N'dbo.bd_other_out', N'审核时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'审核时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间(金蝶 audit_time)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'审核时间';
IF COL_LENGTH(N'dbo.bd_other_out', N'外部数据ID') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'外部数据ID', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部数据ID(金蝶单据内部 id;拉取同步幂等键,与 bd_so_order/bd_pu_order 同款)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'外部数据ID';
IF COL_LENGTH(N'dbo.bd_other_out', N'外部单据号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'外部单据号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部单据号(金蝶侧单号,如 QTRK-20261014-00092 / QTCK-20261014-01172)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'外部单据号';
IF COL_LENGTH(N'dbo.bd_other_out', N'外部指纹') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'外部指纹', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外部指纹(金蝶关键字段拼接,增量同步变更判据)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'外部指纹';
IF COL_LENGTH(N'dbo.bd_other_out', N'是否已转ERP') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'是否已转ERP', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'是否已转ERP(转ERP 成功置「是」;弃审由 ButtonService 清回「否」)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'是否已转ERP';
IF COL_LENGTH(N'dbo.bd_other_out', N'ERP单号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'ERP单号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'ERP单号(金蝶保存响应 data.id_number_map 回写)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'ERP单号';
IF COL_LENGTH(N'dbo.bd_other_out', N'转ERP操作人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'转ERP操作人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP操作人', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'转ERP操作人';
IF COL_LENGTH(N'dbo.bd_other_out', N'转ERP时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'转ERP时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'转ERP时间';
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶单据状态') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'金蝶单据状态', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶单据状态(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'金蝶单据状态';
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶审核人') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'金蝶审核人', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核人(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'金蝶审核人';
IF COL_LENGTH(N'dbo.bd_other_out', N'金蝶审核时间') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'金蝶审核时间', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核时间(拉取回填)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'金蝶审核时间';
IF COL_LENGTH(N'dbo.bl_other_out', N'序号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'序号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'序号(金蝶分录 seq)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'序号';
IF COL_LENGTH(N'dbo.bl_other_out', N'存货编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'存货编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'存货编码(金蝶 material_number;参照商品档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'存货编码';
IF COL_LENGTH(N'dbo.bl_other_out', N'存货名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'存货名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'存货名称(金蝶 material_name;参照商品档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'存货名称';
IF COL_LENGTH(N'dbo.bl_other_out', N'规格型号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'规格型号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'规格型号(金蝶 material_model)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'规格型号';
IF COL_LENGTH(N'dbo.bl_other_out', N'仓库') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'仓库', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库(金蝶 stock_name;参照仓库档案)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'仓库';
IF COL_LENGTH(N'dbo.bl_other_out', N'仓库编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'仓库编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'仓库编码(金蝶 stock_number;转ERP 按它解析 stock_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'仓库编码';
IF COL_LENGTH(N'dbo.bl_other_out', N'计量单位') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'计量单位', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位(金蝶 unit_name)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'计量单位';
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'基本单位名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位名称(金蝶 base_unit_name)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'基本单位名称';
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'基本单位编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位编码(金蝶 base_unit_number)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'基本单位编码';
IF COL_LENGTH(N'dbo.bl_other_out', N'基本单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'基本单位id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'基本单位id(金蝶 base_unit_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'基本单位id';
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位名称') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'辅助单位名称', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'辅助单位名称';
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位编码') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'辅助单位编码', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位编码(金蝶 aux_unit_number)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'辅助单位编码';
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助单位id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'辅助单位id', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助单位id(金蝶 aux_unit_id)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'辅助单位id';
IF COL_LENGTH(N'dbo.bl_other_out', N'换算率') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'换算率', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'换算率';
IF COL_LENGTH(N'dbo.bl_other_out', N'换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'换算系数', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'换算系数(金蝶 coefficient)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'换算系数';
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助换算系数') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'辅助换算系数', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助换算系数(金蝶 aux_coefficient)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'辅助换算系数';
IF COL_LENGTH(N'dbo.bl_other_out', N'数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'数量(金蝶 qty;主单位数量)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'数量';
IF COL_LENGTH(N'dbo.bl_other_out', N'辅助数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'辅助数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'辅助数量(金蝶 aux_qty;多单位商品才有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'辅助数量';
IF COL_LENGTH(N'dbo.bl_other_out', N'库存数量') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'库存数量', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'库存数量(金蝶 inv_qty;同族面板惯例存文本)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'库存数量';
IF COL_LENGTH(N'dbo.bl_other_out', N'单价') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'单价', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单价(业务单价)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'单价';
IF COL_LENGTH(N'dbo.bl_other_out', N'金额') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'金额', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金额', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'金额';
IF COL_LENGTH(N'dbo.bl_other_out', N'明细备注') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'明细备注', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'明细备注(金蝶 comment;列名 备注,标签 明细备注 —— 与表头「备注」区分)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'明细备注';
IF COL_LENGTH(N'dbo.bl_other_out', N'批号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'批号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号(金蝶 batch_no;其他出库实测 93% 行有值)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'批号';
GO
IF COL_LENGTH(N'dbo.bd_other_out', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bd_other_out', N'单据日期') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'单据日期', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据日期', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'单据日期';
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'asp_user1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'asp_time1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单时间(审计四件套;明细/统计视图的「创建时间/制单人」取此列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'asp_user2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'asp_time2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.bd_other_out', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bd_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_other_out'), N'asp_cancel', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'作废标记(Y=已作废)', N'SCHEMA', N'dbo', N'TABLE', N'bd_other_out', N'COLUMN', N'asp_cancel';
IF COL_LENGTH(N'dbo.bl_other_out', N'单据编号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'单据编号', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据编号(MES 单号)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'单据编号';
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'asp_user1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'asp_time1', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'制单时间(审计四件套;明细/统计视图的「创建时间/制单人」取此列)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'asp_user2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改人(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'asp_time2', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'修改时间(审计四件套)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.bl_other_out', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.bl_other_out') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_other_out'), N'asp_cancel', 'ColumnId') AND ep.name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'作废标记(Y=已作废)', N'SCHEMA', N'dbo', N'TABLE', N'bl_other_out', N'COLUMN', N'asp_cancel';
GO
-- ③ 视图 v_other_in_detail / _stats
GO
CREATE OR ALTER VIEW v_other_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 布局列 */, l.[仓库], h.[供应商编码], h.[供应商], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[辅助单位名称] AS [计量单位2], l.[辅助数量] AS [数量2], l.[库存数量],
  h.[业务类型编码]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='OTHER_IN' AND s.doc_no=h.[单据编号];
GO
CREATE OR ALTER VIEW v_other_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  NULL AS [仓库编码], l.[仓库], h.[供应商编码], h.[供应商], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], l.[辅助单位名称] AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[辅助数量],0)) AS [数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='OTHER_IN' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, l.[仓库], h.[供应商编码], h.[供应商], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位], l.[辅助单位名称];
GO
-- ③ 视图 v_other_out_detail / _stats
GO
CREATE OR ALTER VIEW v_other_out_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,
  h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 布局列 */, l.[仓库], h.[部门编码], h.[部门], h.[备注], h.[经手人], h.asp_user1 AS [制单人], s.shr AS [审核人], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[辅助单位名称] AS [计量单位2], l.[辅助数量] AS [数量2], l.[库存数量],
  h.[业务类型编码]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='OTHER_OUT' AND s.doc_no=h.[单据编号];
GO
CREATE OR ALTER VIEW v_other_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,
  NULL AS [仓库编码], l.[仓库], h.[部门编码], h.[部门], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], l.[辅助单位名称] AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[辅助数量],0)) AS [数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='OTHER_OUT' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, l.[仓库], h.[部门编码], h.[部门], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位], l.[辅助单位名称];
GO
-- ④ 面板登记(6 个:单据 + 明细表 + 统计表 × 2)
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_IN', N'其他入库单', N'库存核算', N'doc', N'bl_other_in', N'bd_other_in', N'单据编号', N'id', N'单据编号', N'OI', N'单据日期', 50, N'items', N'库存核算', N'Other inbound delivery notes');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN_DETAIL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_IN_DETAIL', N'其他入库单明细表', N'报表', N'flat', N'v_other_in_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存核算', N'');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN_STATS')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_IN_STATS', N'其他入库单统计表', N'报表', N'flat', N'v_other_in_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存核算', N'');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_OUT', N'其他出库单', N'库存核算', N'doc', N'bl_other_out', N'bd_other_out', N'单据编号', N'id', N'单据编号', N'OO', N'单据日期', 50, N'items', N'库存核算', N'Other delivery notes');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT_DETAIL')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_OUT_DETAIL', N'其他出库单明细表', N'报表', N'flat', N'v_other_out_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存核算', N'');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT_STATS')
    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
    VALUES ('OTHER_OUT_STATS', N'其他出库单统计表', N'报表', N'flat', N'v_other_out_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'库存核算', N'');
GO
-- ⑤ 字段登记(OTHER_IN 表头 + 明细)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'业务类型', N'业务类型', N'下拉框', N'SELECT v FROM (VALUES (N''其他入库'')) AS t(v)', NULL, NULL, NULL, N'query,header', 30, 120, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'业务类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'业务类型编码', N'业务类型编码', N'文本', NULL, NULL, NULL, NULL, N'header', 32, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'业务类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'业务类型id', N'业务类型id', N'文本', NULL, NULL, NULL, NULL, N'header', 34, 90, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'供应商编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'供应商编码', N'供应商编码', N'参照', NULL, N'GFDA', N'dm', N'mc', N'query,header', 50, 140, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'供应商')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'供应商', N'供应商', N'参照', NULL, N'GFDA', N'mc', N'mc', N'query,header', 52, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 54, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'部门编码', N'部门编码', N'参照', NULL, N'DEPT', N'部门编码', N'部门名称', N'header', 56, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'经手人', N'经手人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'header', 58, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 59, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 900, 200, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'header', 142, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 144, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'修改时间', N'修改时间', N'文本', NULL, NULL, NULL, NULL, N'header', 146, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL, NULL, N'header', 152, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'外部数据ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'外部数据ID', N'外部数据ID', N'文本', NULL, NULL, NULL, NULL, N'header', 162, 120, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'外部单据号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'外部单据号', N'外部单据号', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'外部指纹')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'外部指纹', N'外部指纹', N'文本', NULL, NULL, NULL, NULL, N'header', 164, 160, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'是否已转ERP')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 172, 80, 0, 0, 1, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'ERP单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'转ERP操作人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 174, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'转ERP时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL, NULL, N'header', 176, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'金蝶单据状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'金蝶单据状态', N'金蝶单据状态', N'文本', NULL, NULL, NULL, NULL, N'header', 178, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'金蝶审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'金蝶审核人', N'金蝶审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'金蝶审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'金蝶审核时间', N'金蝶审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 182, 130, 0, 0, 0, NULL, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'序号', N'序号', N'整数', NULL, NULL, NULL, NULL, N'detail', 5, 60, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 10, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'存货名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'存货名称', N'存货名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 20, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 40, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'仓库编码', N'仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'query,detail', 42, 100, 1, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'计量单位', N'计量单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'基本单位名称', N'基本单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 62, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 63, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'基本单位id', N'基本单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 64, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'辅助单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'辅助单位名称', N'辅助单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 65, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'辅助单位编码', N'辅助单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 66, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'辅助单位id', N'辅助单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 67, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'换算率', N'换算率', N'文本', NULL, NULL, NULL, NULL, N'detail', 68, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'换算系数', N'换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 69, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'辅助换算系数', N'辅助换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 71, 110, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'辅助数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'辅助数量', N'辅助数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 82, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 84, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 92, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'明细备注', N'明细备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 95, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 96, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'成本', N'成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'单位成本')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'单位成本', N'单位成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 102, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND label=N'存货图片')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN', N'存货图片', N'存货图片', N'文本', NULL, NULL, NULL, NULL, N'detail', 104, 200, 0, 0, 0, NULL, 1);
GO
-- ⑤b 既有字段口径对齐(OTHER_IN:文本 → 参照/下拉,口径照抄采购入库单/销售出库单)
UPDATE yj_field SET data_type = N'下拉框', dict_sql = N'SELECT v FROM (VALUES (N''其他入库'')) AS t(v)', ref_panel = NULL, ref_field = NULL, display_field = NULL, place = N'query,header', seq = 30, width = 120, editable = 0, required = 1, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'业务类型' AND (data_type <> N'下拉框' OR ISNULL(ref_panel,'') <> '' OR ISNULL(dict_sql,'') <> N'SELECT v FROM (VALUES (N''其他入库'')) AS t(v)');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'GFDA', ref_field = N'dm', display_field = N'mc', place = N'query,header', seq = 50, width = 140, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'供应商编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'GFDA' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'GFDA', ref_field = N'mc', display_field = N'mc', place = N'query,header', seq = 52, width = 160, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'供应商' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'GFDA' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门名称', display_field = N'部门名称', place = N'header', seq = 54, width = 130, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'部门' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'DEPT' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门编码', display_field = N'部门名称', place = N'header', seq = 56, width = 110, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'部门编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'DEPT' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'EMP', ref_field = N'员工名称', display_field = N'员工名称', place = N'header', seq = 58, width = 130, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'经手人' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'EMP' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'INV', ref_field = N'存货编码', display_field = N'存货名称', place = N'query,detail', seq = 10, width = 120, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'存货编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'INV' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'INV', ref_field = N'存货名称', display_field = N'存货名称', place = N'detail', seq = 20, width = 160, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'存货名称' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'INV' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'WH', ref_field = N'仓库名称', display_field = N'仓库名称', place = N'query,detail', seq = 40, width = 110, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'仓库' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'WH' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'WH', ref_field = N'仓库编码', display_field = N'仓库名称', place = N'query,detail', seq = 42, width = 100, editable = 1, required = 0, hidden = 1, visible = 0 WHERE panel_code = 'OTHER_IN' AND label = N'仓库编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'WH' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'下拉框', dict_sql = N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', ref_panel = NULL, ref_field = NULL, display_field = NULL, place = N'detail', seq = 60, width = 100, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_IN' AND label = N'计量单位' AND (data_type <> N'下拉框' OR ISNULL(ref_panel,'') <> '' OR ISNULL(dict_sql,'') <> N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)');
GO
-- ⑤ 字段登记(OTHER_IN_DETAIL 21 列)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'单据日期', N'单据日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'业务类型', N'业务类型', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'供应商编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'供应商编码', N'供应商编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'供应商')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'供应商', N'供应商', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'制单人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'制单人', N'制单人', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'数量', N'数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'单价', N'单价', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'金额', N'金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'计量单位2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'计量单位2', N'计量单位2', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'数量2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'数量2', N'数量2', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_DETAIL' AND label=N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_DETAIL', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 120, 0, 0, 0, NULL, 1);
GO
-- ⑤ 字段登记(OTHER_IN_STATS 14 列)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'供应商编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'供应商编码', N'供应商编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'供应商')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'供应商', N'供应商', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'主单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'主单位', N'主单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'辅单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'辅单位', N'辅单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'数量(主单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'数量(主单位)', N'数量(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'单价(主单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'单价(主单位)', N'单价(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'金额', N'金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'数量(辅单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'数量(辅单位)', N'数量(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN_STATS' AND label=N'单价(辅单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_IN_STATS', N'单价(辅单位)', N'单价(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1);
GO
-- ⑤ 字段登记(OTHER_OUT 表头 + 明细)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'业务类型', N'业务类型', N'下拉框', N'SELECT v FROM (VALUES (N''其他出库'')) AS t(v)', NULL, NULL, NULL, N'query,header', 30, 120, 0, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'业务类型编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'业务类型编码', N'业务类型编码', N'文本', NULL, NULL, NULL, NULL, N'header', 32, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'业务类型id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'业务类型id', N'业务类型id', N'文本', NULL, NULL, NULL, NULL, N'header', 34, 90, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'query,header', 50, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'部门编码', N'部门编码', N'参照', NULL, N'DEPT', N'部门编码', N'部门名称', N'header', 52, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'经手人', N'经手人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 54, 130, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 56, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 900, 200, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'header', 142, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 144, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'修改时间', N'修改时间', N'文本', NULL, NULL, NULL, NULL, N'header', 146, 130, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL, NULL, N'header', 152, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'外部数据ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'外部数据ID', N'外部数据ID', N'文本', NULL, NULL, NULL, NULL, N'header', 162, 120, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'外部单据号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'外部单据号', N'外部单据号', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'外部指纹')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'外部指纹', N'外部指纹', N'文本', NULL, NULL, NULL, NULL, N'header', 164, 160, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'是否已转ERP')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 172, 80, 0, 0, 1, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'ERP单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'转ERP操作人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 174, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'转ERP时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL, NULL, N'header', 176, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'金蝶单据状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'金蝶单据状态', N'金蝶单据状态', N'文本', NULL, NULL, NULL, NULL, N'header', 178, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'金蝶审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'金蝶审核人', N'金蝶审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 130, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'金蝶审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'金蝶审核时间', N'金蝶审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 182, 130, 0, 0, 0, NULL, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'序号', N'序号', N'整数', NULL, NULL, NULL, NULL, N'detail', 5, 60, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 10, 120, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'存货名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'存货名称', N'存货名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 20, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 140, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,detail', 40, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'仓库编码', N'仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'query,detail', 42, 100, 1, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'计量单位', N'计量单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 100, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'基本单位名称', N'基本单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 62, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 63, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'基本单位id', N'基本单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 64, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'辅助单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'辅助单位名称', N'辅助单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 65, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'辅助单位编码', N'辅助单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 66, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'辅助单位id', N'辅助单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 67, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'换算率', N'换算率', N'文本', NULL, NULL, NULL, NULL, N'detail', 68, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'换算系数', N'换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 69, 100, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'辅助换算系数', N'辅助换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 71, 110, 0, 0, 1, NULL, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 1, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'辅助数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'辅助数量', N'辅助数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 82, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 84, 100, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 92, 110, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'明细备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'明细备注', N'明细备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 95, 160, 1, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND label=N'批号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 100, 120, 1, 0, 0, NULL, 1);
GO
-- ⑤b 既有字段口径对齐(OTHER_OUT:文本 → 参照/下拉,口径照抄采购入库单/销售出库单)
UPDATE yj_field SET data_type = N'下拉框', dict_sql = N'SELECT v FROM (VALUES (N''其他出库'')) AS t(v)', ref_panel = NULL, ref_field = NULL, display_field = NULL, place = N'query,header', seq = 30, width = 120, editable = 0, required = 1, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'业务类型' AND (data_type <> N'下拉框' OR ISNULL(ref_panel,'') <> '' OR ISNULL(dict_sql,'') <> N'SELECT v FROM (VALUES (N''其他出库'')) AS t(v)');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门名称', display_field = N'部门名称', place = N'query,header', seq = 50, width = 130, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'部门' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'DEPT' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'DEPT', ref_field = N'部门编码', display_field = N'部门名称', place = N'header', seq = 52, width = 110, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'部门编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'DEPT' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'EMP', ref_field = N'员工名称', display_field = N'员工名称', place = N'query,header', seq = 54, width = 130, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'经手人' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'EMP' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'INV', ref_field = N'存货编码', display_field = N'存货名称', place = N'query,detail', seq = 10, width = 120, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'存货编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'INV' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'INV', ref_field = N'存货名称', display_field = N'存货名称', place = N'detail', seq = 20, width = 160, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'存货名称' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'INV' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'WH', ref_field = N'仓库名称', display_field = N'仓库名称', place = N'query,detail', seq = 40, width = 110, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'仓库' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'WH' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'参照', dict_sql = NULL, ref_panel = N'WH', ref_field = N'仓库编码', display_field = N'仓库名称', place = N'query,detail', seq = 42, width = 100, editable = 1, required = 0, hidden = 1, visible = 0 WHERE panel_code = 'OTHER_OUT' AND label = N'仓库编码' AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> N'WH' OR ISNULL(dict_sql,'') <> '');
UPDATE yj_field SET data_type = N'下拉框', dict_sql = N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', ref_panel = NULL, ref_field = NULL, display_field = NULL, place = N'detail', seq = 60, width = 100, editable = 1, required = 0, hidden = 0, visible = 1 WHERE panel_code = 'OTHER_OUT' AND label = N'计量单位' AND (data_type <> N'下拉框' OR ISNULL(ref_panel,'') <> '' OR ISNULL(dict_sql,'') <> N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)');
GO
-- ⑤ 字段登记(OTHER_OUT_DETAIL 22 列)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'单据日期')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'单据日期', N'单据日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'单据编号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'业务类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'业务类型', N'业务类型', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'部门编码', N'部门编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'部门', N'部门', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'备注')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'经手人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'经手人', N'经手人', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'制单人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'制单人', N'制单人', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'计量单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'数量', N'数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'单价')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'单价', N'单价', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'金额', N'金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'计量单位2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'计量单位2', N'计量单位2', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'数量2')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'数量2', N'数量2', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' AND label=N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_DETAIL', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 120, 0, 0, 0, NULL, 1);
GO
-- ⑤ 字段登记(OTHER_OUT_STATS 14 列)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'仓库编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'仓库')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'部门编码', N'部门编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'部门', N'部门', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'存货编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'存货')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'规格型号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'主单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'主单位', N'主单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'辅单位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'辅单位', N'辅单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'数量(主单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'数量(主单位)', N'数量(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'单价(主单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'单价(主单位)', N'单价(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'金额')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'金额', N'金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'数量(辅单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'数量(辅单位)', N'数量(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT_STATS' AND label=N'单价(辅单位)')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('OTHER_OUT_STATS', N'单价(辅单位)', N'单价(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1);
GO
-- ⑥ 译名(面板名 + 字段标签 en)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他入库单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他入库单', 'en', N'Other inbound delivery notes', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他入库单明细表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他入库单明细表', 'en', N'Other inbound delivery note Details', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他入库单统计表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他入库单统计表', 'en', N'Other inbound delivery note Summary', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他出库单' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他出库单', 'en', N'Other delivery notes', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他出库单明细表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他出库单明细表', 'en', N'Other delivery note Details', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他出库单统计表' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'其他出库单统计表', 'en', N'Other delivery note Summary', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据日期' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据日期', 'en', N'Document Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单据编号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单据编号', 'en', N'Document Number', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务类型', 'en', N'Business Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务类型编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务类型编码', 'en', N'Business Type Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务类型id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务类型id', 'en', N'Business Type ID', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'备注' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'备注', 'en', N'Remark', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建人', 'en', N'Creator', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'创建时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'创建时间', 'en', N'Created at', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改人', 'en', N'Modifier', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'修改时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'修改时间', 'en', N'Modified at', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核人', 'en', N'Auditor', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'审核时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'审核时间', 'en', N'Audit time', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部数据ID' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部数据ID', 'en', N'External ID', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部单据号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部单据号', 'en', N'External Bill No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'外部指纹' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'外部指纹', 'en', N'External Fingerprint', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否已转ERP' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否已转ERP', 'en', N'Pushed to ERP', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'ERP单号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'ERP单号', 'en', N'ERP Bill No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转ERP操作人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转ERP操作人', 'en', N'ERP Pushed By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转ERP时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转ERP时间', 'en', N'ERP Pushed At', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金蝶单据状态' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金蝶单据状态', 'en', N'Kingdee Bill Status', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金蝶审核人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金蝶审核人', 'en', N'Kingdee Auditor', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金蝶审核时间' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金蝶审核时间', 'en', N'Kingdee Audit Time', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'序号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'序号', 'en', N'Seq', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存货编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存货编码', 'en', N'Item Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存货名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存货名称', 'en', N'Item Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'规格型号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'规格型号', 'en', N'Model', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库', 'en', N'Warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库编码', 'en', N'Warehouse Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'计量单位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'计量单位', 'en', N'Unit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位名称', 'en', N'Base Unit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位编码', 'en', N'Base Unit Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'基本单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'基本单位id', 'en', N'Base Unit ID', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位名称', 'en', N'Aux Unit', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助单位id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助单位id', 'en', N'Aux Unit ID', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算率' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算率', 'en', N'Conversion Rate', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'换算系数', 'en', N'Coefficient', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助换算系数' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助换算系数', 'en', N'Aux Coefficient', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'数量', 'en', N'Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'辅助数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'辅助数量', 'en', N'Aux Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库存数量' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库存数量', 'en', N'Inventory Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单价' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单价', 'en', N'Price', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'金额' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'金额', 'en', N'Amount', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'成本', 'en', N'Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单位成本' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单位成本', 'en', N'Unit Cost', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存货图片' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存货图片', 'en', N'Item Picture', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批号' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批号', 'en', N'Batch No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商编码', 'en', N'Vendor code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商', 'en', N'Vendor', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门', 'en', N'Department', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'部门编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'部门编码', 'en', N'Department Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人', 'en', N'Person in charge', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人编码' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人编码', 'en', N'Handler code', 'manual');
GO
-- ⑦ 角色授权(沿用下架前登记:admin/user/rd_file_owner/rd_review 四角色 view,query,add,modify,modlog,del,export)
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_IN')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_IN', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_IN')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_IN', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_IN')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_IN', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_IN')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_IN', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_IN_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_IN_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_IN_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_IN_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_IN_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_IN_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_IN_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_IN_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_IN_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_IN_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_IN_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_IN_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_IN_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_IN_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_IN_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_IN_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_OUT')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_OUT', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_OUT')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_OUT', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_OUT')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_OUT', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_OUT')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_OUT', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_OUT_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_OUT_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_OUT_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_OUT_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_OUT_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_OUT_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_OUT_DETAIL')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_OUT_DETAIL', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=1 AND panel_code='OTHER_OUT_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, 'OTHER_OUT_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=2 AND panel_code='OTHER_OUT_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, 'OTHER_OUT_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=3 AND panel_code='OTHER_OUT_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (3, 'OTHER_OUT_STATS', 'N', 'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=4 AND panel_code='OTHER_OUT_STATS')
    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (4, 'OTHER_OUT_STATS', 'N', 'view,query,add,modify,modlog,del,export');
GO
-- ⑧ 自检:表/视图/面板/字段/译名/授权 齐备(缺一即失败)
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.bd_other_in', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bl_other_in', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_other_in_detail', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_other_in_stats', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN_DETAIL') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_IN_STATS') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='OTHER_IN') < 54 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他入库单' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code='OTHER_IN' AND role_id=1) SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_other_in', N'业务类型id') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bd_other_out', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.bl_other_out', N'U') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_other_out_detail', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_other_out_stats', N'V') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT_DETAIL') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='OTHER_OUT_STATS') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='OTHER_OUT') < 49 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'其他出库单' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code='OTHER_OUT' AND role_id=1) SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_other_out', N'业务类型id') IS NULL SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'其他入库/出库三件套自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'其他入库/出库三件套就绪(表 4 / 视图 4 / 面板 6 / 字段 / 译名 / 授权;幂等)';
GO
