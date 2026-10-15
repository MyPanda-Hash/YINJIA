/* ============================================================
   migrate-finish-in-erp-cols-20261014.sql — 2026-10-14
   产成品入库单(FINISH_IN)补金蝶字段 + 明细「检验方式」

   背景(用户口径 2026-10-14):
     ① 转ERP 补齐:产品入库单此前**没有**转ERP 通道(现有通道仅 采购入库/销售出库/材料出库),
        要能推金蝶「产品入库单」/jdy/v2/scm/inv_product;
     ② 金蝶回写族 + 拉取幂等族按参照面板同名落地(采购入库单/销售出库单有 ERP 族,
        销售订单/采购订单有 外部数据ID/外部单据号/外部指纹 族);
     ③ 检验字段:用户指定放**明细行**(每行一个「检验方式」= 全检/抽检,与检验方案 QC_PLAN.检验方式 同口径)。
        ⚠ 沙箱实测(2026-10-14):金蝶 inv_product 保存接口对 check_type/inspect_way/qc_type
          **静默忽略且不报错** ⇒ 该字段只存 MES 本地,不推送(证据 tools/archive/_dump-out/kingdee-save-inv-product-1014.md);
     ④ 对照字段取自金蝶有数据的键(30 张真实单据逐键非空率统计见
        tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md):表头 单据类型/部门(编码)/经手人编码/创建修改审核族;
        分录 序号/基本单位三件套/辅助单位三件套/换算率/换算系数/辅助换算系数/库存数量。
        恒空键(sp_ 族 / src_ 族 / price / cost / kf_ 族 / sn_ 族 / pro_ 族 / barcode / customer_ 族 等)按用户口径「不要无用数据」**不登记**。

   幂等(COL_LENGTH 守卫 + 注明 add/update 双向 + yj_field NOT EXISTS + 译名 NOT EXISTS);两账套均执行。
   ============================================================ */
SET NOCOUNT ON;
GO
-- ① 加列:bd_finish_in(表头)
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'单据类型') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [单据类型] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'部门') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [部门] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'部门编码') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [部门编码] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'经手人编码') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [经手人编码] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'创建人') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [创建人] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'创建时间') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [创建时间] datetime2 NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'修改人') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [修改人] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'修改时间') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [修改时间] datetime2 NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'审核人') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [审核人] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'审核时间') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [审核时间] datetime2 NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'外部数据ID') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [外部数据ID] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'外部单据号') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [外部单据号] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'外部指纹') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [外部指纹] nvarchar(200) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'是否已转ERP') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [是否已转ERP] nvarchar(10) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'ERP单号') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [ERP单号] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'转ERP操作人') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [转ERP操作人] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'转ERP时间') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [转ERP时间] datetime2 NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶单据状态') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [金蝶单据状态] nvarchar(20) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核人') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [金蝶审核人] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核时间') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [金蝶审核时间] datetime2 NULL;
GO
-- ① 加列:bl_finish_in(明细)
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'序号') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [序号] int NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位名称') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [基本单位名称] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位编码') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [基本单位编码] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位id') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [基本单位id] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位名称') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [辅助单位名称] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位编码') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [辅助单位编码] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位id') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [辅助单位id] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'换算率') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [换算率] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'换算系数') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [换算系数] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助换算系数') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [辅助换算系数] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'库存数量') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [库存数量] nvarchar(50) NULL;
GO
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.bl_finish_in', N'检验方式') IS NULL
    ALTER TABLE dbo.bl_finish_in ADD [检验方式] nvarchar(10) NULL;
GO
-- ② 列级中文注明(规范 §4.7:新增列必须注明)
IF COL_LENGTH(N'dbo.bd_finish_in', N'单据类型') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'单据类型', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'单据类型(金蝶 bill_type_name,如「产品入库单」)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'单据类型';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'单据类型(金蝶 bill_type_name,如「产品入库单」)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'单据类型';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'部门') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'部门', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'部门(金蝶 dept_name;参照部门档案)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'部门';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'部门(金蝶 dept_name;参照部门档案)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'部门';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'部门编码') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'部门编码', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'部门编码(金蝶 dept_number;转ERP 推 dept_number 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'部门编码';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'部门编码(金蝶 dept_number;转ERP 推 dept_number 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'部门编码';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'经手人编码') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'经手人编码', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'经手人编码(金蝶 emp_number;转ERP 推 emp_number 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'经手人编码';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'经手人编码(金蝶 emp_number;转ERP 推 emp_number 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'经手人编码';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'创建人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'创建人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'创建人(金蝶 creator_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'创建人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'创建人(金蝶 creator_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'创建人';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'创建时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'创建时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'创建时间(金蝶 create_time)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'创建时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'创建时间(金蝶 create_time)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'创建时间';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'修改人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'修改人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'修改人(金蝶 modifier_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'修改人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'修改人(金蝶 modifier_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'修改人';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'修改时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'修改时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'修改时间(金蝶 modify_time)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'修改时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'修改时间(金蝶 modify_time)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'修改时间';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'审核人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'审核人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'审核人(金蝶 auditor_name / MES 审核留痕)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'审核人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'审核人(金蝶 auditor_name / MES 审核留痕)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'审核人';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'审核时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'审核时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'审核时间(金蝶 audit_time / MES 审核留痕)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'审核时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'审核时间(金蝶 audit_time / MES 审核留痕)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'审核时间';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部数据ID') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部数据ID', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'外部数据ID(金蝶单据内部 id;拉取同步的幂等键,与 bd_so_order/bd_pu_order 同款)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部数据ID';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'外部数据ID(金蝶单据内部 id;拉取同步的幂等键,与 bd_so_order/bd_pu_order 同款)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部数据ID';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部单据号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部单据号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'外部单据号(金蝶侧单号,如 CPRK-20261014-00004)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部单据号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'外部单据号(金蝶侧单号,如 CPRK-20261014-00004)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部单据号';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部指纹') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部指纹', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'外部指纹(金蝶侧关键字段拼接,用于增量同步时判断是否变更)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部指纹';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'外部指纹(金蝶侧关键字段拼接,用于增量同步时判断是否变更)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'外部指纹';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'是否已转ERP') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'是否已转ERP', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'是否已转ERP(转ERP 成功后置「是」;弃审时由 ButtonService 清回「否」)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'是否已转ERP';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'是否已转ERP(转ERP 成功后置「是」;弃审时由 ButtonService 清回「否」)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'是否已转ERP';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'ERP单号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'ERP单号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'ERP单号(转ERP 成功后回写的金蝶单号,取自保存响应 data.id_number_map)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'ERP单号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'ERP单号(转ERP 成功后回写的金蝶单号,取自保存响应 data.id_number_map)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'ERP单号';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'转ERP操作人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'转ERP操作人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'转ERP操作人(执行转ERP 的 MES 用户)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'转ERP操作人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'转ERP操作人(执行转ERP 的 MES 用户)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'转ERP操作人';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'转ERP时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'转ERP时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'转ERP时间(转ERP 成功时刻)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'转ERP时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'转ERP时间(转ERP 成功时刻)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'转ERP时间';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶单据状态') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶单据状态', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'金蝶单据状态(拉取回填:c=已审核 等;转ERP 推送的金蝶侧状态另行查询)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶单据状态';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'金蝶单据状态(拉取回填:c=已审核 等;转ERP 推送的金蝶侧状态另行查询)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶单据状态';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核人') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶审核人', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'金蝶审核人(拉取回填)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶审核人';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核人(拉取回填)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶审核人';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核时间') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶审核时间', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'金蝶审核时间(拉取回填)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶审核时间';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'金蝶审核时间(拉取回填)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'金蝶审核时间';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'序号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'序号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'序号(金蝶分录 seq;打印/核对用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'序号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'序号(金蝶分录 seq;打印/核对用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'序号';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位名称') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位名称', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'基本单位名称(金蝶 base_unit_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位名称';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'基本单位名称(金蝶 base_unit_name)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位名称';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位编码') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位编码', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'基本单位编码(金蝶 base_unit_number;转ERP 推 base_unit_id 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位编码';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'基本单位编码(金蝶 base_unit_number;转ERP 推 base_unit_id 用)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位编码';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位id') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位id', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'基本单位id(金蝶 base_unit_id;转ERP 保存接口收 id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位id';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'基本单位id(金蝶 base_unit_id;转ERP 保存接口收 id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'基本单位id';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位名称') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位名称', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位名称';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位名称';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位编码') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位编码', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'辅助单位编码(金蝶 aux_unit_number)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位编码';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'辅助单位编码(金蝶 aux_unit_number)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位编码';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位id') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位id', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'辅助单位id(金蝶 aux_unit_id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位id';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'辅助单位id(金蝶 aux_unit_id)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助单位id';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'换算率') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'换算率', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」,故按文本存)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'换算率';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」,故按文本存)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'换算率';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'换算系数') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'换算系数', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'换算系数(金蝶 coefficient)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'换算系数';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'换算系数(金蝶 coefficient)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'换算系数';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助换算系数') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助换算系数', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'辅助换算系数(金蝶 aux_coefficient;多单位商品才有值)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助换算系数';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'辅助换算系数(金蝶 aux_coefficient;多单位商品才有值)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'辅助换算系数';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'库存数量') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'库存数量', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'库存数量(金蝶 inv_qty;与该仓库现存量口径一致,按同族面板惯例存文本)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'库存数量';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'库存数量(金蝶 inv_qty;与该仓库现存量口径一致,按同族面板惯例存文本)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'库存数量';
END
GO
IF COL_LENGTH(N'dbo.bl_finish_in', N'检验方式') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'检验方式', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'检验方式(全检/抽检;用户 2026-10-14 口径:成品入库后要检验,按明细行登记。⚠ 金蝶 inv_product 保存接口对检验类键静默忽略,故只存 MES 本地、不推送)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'检验方式';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'检验方式(全检/抽检;用户 2026-10-14 口径:成品入库后要检验,按明细行登记。⚠ 金蝶 inv_product 保存接口对检验类键静默忽略,故只存 MES 本地、不推送)',
             N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'检验方式';
END
GO
-- ③ 面板字段登记(表头 + 明细)
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'单据类型') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'单据类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'单据类型', N'单据类型', N'文本', NULL, NULL, NULL,
            NULL, 'header', 135, 120, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'部门') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'部门', N'部门', N'文本', NULL, NULL, NULL,
            NULL, 'header', 130, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'部门编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'部门编码', N'部门编码', N'文本', NULL, NULL, NULL,
            NULL, 'header', 131, 110, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'经手人编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'经手人编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL,
            NULL, 'header', 72, 110, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'创建人') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'创建人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'创建人', N'创建人', N'文本', NULL, NULL, NULL,
            NULL, 'header', 140, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'创建时间') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'创建时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'创建时间', N'创建时间', N'日期', NULL, NULL, NULL,
            NULL, 'header', 142, 130, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'修改人') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'修改人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'修改人', N'修改人', N'文本', NULL, NULL, NULL,
            NULL, 'header', 144, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'修改时间') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'修改时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'修改时间', N'修改时间', N'日期', NULL, NULL, NULL,
            NULL, 'header', 146, 130, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'审核人') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'审核人', N'审核人', N'文本', NULL, NULL, NULL,
            NULL, 'header', 150, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'审核时间') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'审核时间', N'审核时间', N'日期', NULL, NULL, NULL,
            NULL, 'header', 152, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'外部数据ID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部数据ID')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'外部数据ID', N'外部数据ID', N'文本', NULL, NULL, NULL,
            NULL, 'header', 162, 120, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'外部单据号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部单据号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'外部单据号', N'外部单据号', N'文本', NULL, NULL, NULL,
            NULL, 'header', 160, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'外部指纹') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部指纹')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'外部指纹', N'外部指纹', N'文本', NULL, NULL, NULL,
            NULL, 'header', 164, 160, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'是否已转ERP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'是否已转ERP')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL,
            NULL, 'header', 172, 80, 0, 0, 1, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'ERP单号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'ERP单号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL,
            NULL, 'header', 170, 120, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'转ERP操作人') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'转ERP操作人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL,
            NULL, 'header', 174, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'转ERP时间') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'转ERP时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL,
            NULL, 'header', 176, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶单据状态') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶单据状态')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'金蝶单据状态', N'金蝶单据状态', N'文本', NULL, NULL, NULL,
            NULL, 'header', 178, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核人') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶审核人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'金蝶审核人', N'金蝶审核人', N'文本', NULL, NULL, NULL,
            NULL, 'header', 180, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核时间') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶审核时间')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'金蝶审核时间', N'金蝶审核时间', N'日期', NULL, NULL, NULL,
            NULL, 'header', 182, 130, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'序号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'序号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'序号', N'序号', N'整数', NULL, NULL, NULL,
            NULL, 'detail', 5, 60, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位名称') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'基本单位名称', N'基本单位名称', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 62, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 63, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'基本单位id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'基本单位id', N'基本单位id', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 64, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位名称') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'辅助单位名称', N'辅助单位名称', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 65, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位编码') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位编码')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'辅助单位编码', N'辅助单位编码', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 66, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位id') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'辅助单位id', N'辅助单位id', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 67, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'换算率') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'换算率')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'换算率', N'换算率', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 68, 120, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'换算系数') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'换算系数', N'换算系数', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 69, 100, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'辅助换算系数') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助换算系数')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'辅助换算系数', N'辅助换算系数', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 71, 110, 0, 0, 1, NULL, 0);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'库存数量') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'库存数量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL,
            NULL, 'detail', 92, 100, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bl_finish_in', N'检验方式') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'检验方式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'检验方式', N'检验方式', N'下拉框', N'SELECT v FROM (VALUES (N''全检''),(N''抽检'')) AS t(v)', NULL, NULL,
            NULL, 'detail', 95, 100, 1, 0, 0, NULL, 1);
GO
-- ④ en 译名(标签全局共享;已有则不重复插,避免撞 uq_translation)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'单据类型' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'单据类型', 'en', N'Bill Type', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'部门' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'部门', 'en', N'Department', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'部门编码' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'部门编码', 'en', N'Department Code', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'经手人编码' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'经手人编码', 'en', N'Handler code', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'创建人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'创建人', 'en', N'Creator', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'创建时间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'创建时间', 'en', N'Created at', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'修改人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'修改人', 'en', N'Modifier', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'修改时间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'修改时间', 'en', N'Modified at', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'审核人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'审核人', 'en', N'Auditor', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'审核时间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'审核时间', 'en', N'Audit time', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'外部数据ID' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'外部数据ID', 'en', N'External ID', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'外部单据号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'外部单据号', 'en', N'External Bill No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'外部指纹' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'外部指纹', 'en', N'External Fingerprint', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'是否已转ERP' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'是否已转ERP', 'en', N'Pushed to ERP', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'ERP单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'ERP单号', 'en', N'ERP Bill No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'转ERP操作人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'转ERP操作人', 'en', N'ERP Pushed By', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'转ERP时间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'转ERP时间', 'en', N'ERP Pushed At', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'金蝶单据状态' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'金蝶单据状态', 'en', N'Kingdee Bill Status', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'金蝶审核人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'金蝶审核人', 'en', N'Kingdee Auditor', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'金蝶审核时间' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'金蝶审核时间', 'en', N'Kingdee Audit Time', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'序号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'序号', 'en', N'Seq', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'基本单位名称' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'基本单位名称', 'en', N'Base Unit', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'基本单位编码' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'基本单位编码', 'en', N'Base Unit Code', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'基本单位id' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'基本单位id', 'en', N'Base Unit ID', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'辅助单位名称' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'辅助单位名称', 'en', N'Aux Unit', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'辅助单位编码' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'辅助单位编码', 'en', N'Aux Unit Code', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'辅助单位id' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'辅助单位id', 'en', N'Aux Unit ID', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'换算率' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'换算率', 'en', N'Conversion Rate', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'换算系数' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'换算系数', 'en', N'Coefficient', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'辅助换算系数' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'辅助换算系数', 'en', N'Aux Coefficient', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'库存数量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'库存数量', 'en', N'Inventory Qty', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'检验方式' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'检验方式', 'en', N'Inspection Mode', 'manual');
GO
-- ⑤ 自检:列 + 注明 + 字段登记 + 译名 齐备(缺一即失败)
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bd_finish_in', N'单据类型') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'单据类型', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'单据类型') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'部门') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'部门', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'部门编码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'部门编码', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'部门编码') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'经手人编码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'经手人编码', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'经手人编码') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'创建人') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'创建人', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'创建人') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'创建时间') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'创建时间', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'创建时间') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'修改人') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'修改人', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'修改人') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'修改时间') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'修改时间', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'修改时间') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'审核人') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'审核人', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'审核人') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'审核时间') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'审核时间', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'审核时间') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部数据ID') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部数据ID', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部数据ID') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部单据号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部单据号', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部单据号') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'外部指纹') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'外部指纹', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'外部指纹') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'是否已转ERP') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'是否已转ERP', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'是否已转ERP') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'ERP单号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'ERP单号', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'ERP单号') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'转ERP操作人') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'转ERP操作人', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'转ERP操作人') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'转ERP时间') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'转ERP时间', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'转ERP时间') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶单据状态') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶单据状态', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶单据状态') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核人') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶审核人', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶审核人') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'金蝶审核时间') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'金蝶审核时间', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'金蝶审核时间') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'序号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'序号', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'序号') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位名称') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位名称', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位名称') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位编码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位编码', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位编码') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'基本单位id') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'基本单位id', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'基本单位id') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位名称') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位名称', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位名称') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位编码') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位编码', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位编码') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助单位id') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助单位id', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助单位id') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'换算率') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'换算率', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'换算率') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'换算系数') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'换算系数', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'换算系数') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'辅助换算系数') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'辅助换算系数', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'辅助换算系数') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'库存数量') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'库存数量', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'库存数量') SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bl_finish_in', N'检验方式') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bl_finish_in') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'检验方式', 'ColumnId') AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'检验方式') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'检验方式' AND locale = 'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'FINISH_IN 金蝶字段自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'FINISH_IN 金蝶字段就绪(列 + 注明 + 字段登记 + en 译名;幂等)';
GO
