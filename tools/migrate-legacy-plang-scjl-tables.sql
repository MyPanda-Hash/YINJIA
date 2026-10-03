/* =============================================================================
   migrate-legacy-plang-scjl-tables.sql — 补建本机缺失的三张在册遗留表
   (plang 工单 / plang_pc 工单排产 / scjl 生产记录)

   为什么需要(2026-10-03 实测):
     拉取远端 167 提交后跑 DbSync,链在 migrate-plang-workorder.sql 报
       「找不到对象 "dbo.plang",因为它不存在或者你没有所需的权限。」
     根因**不是脚本错**:plang/plang_pc/scjl 是参考库(原始系统)的遗留表,
     远端库有(随参考库恢复带入),本机两账套从未存在过 —— 全库扫描确认本机
     HSDZ_MES / HSDZ_MES_TEST / HSDZ_MES_CHAIN / HSDZ_MES_RESTORE 五库**都没有**这三张表。
     而它们在 tools/db-inuse-tables.txt 里是**在册**表(第 9 组 legacy),
     且下列在链脚本直接依赖:
       · migrate-plang-workorder / migrate-plang-batch / migrate-plang-schedule
       · migrate-plangpc-board / migrate-pc-plang-id
       · migrate-scjl-report / migrate-scjl-single-table
       · migrate-spare-columns-biz(在册业务表 备用1..20 列池,含这三张)
     不补建则这些脚本一律中止,而**库存三表重构等排在它们之后**,整条链跑不到。

   结构来源:tools/archive/_ref-dump/01-table-structure.txt(参考库表结构 dump)。
   生成器:tools/archive/_gen-legacy-tables.mjs(本文件由其生成,勿手改;要改结构改 dump/生成器后重跑)。

   ⚠ 口径声明:
     ① 这是**结构补建**(空表),不含参考库的业务数据 —— 本机无参考库数据备份(43MB 的
        HSDZ_MES_backup_2026_08_28 需 sysadmin 才能 RESTORE,本机 yinjia 账号无该权限)。
        故本机这三张表建成后为空,「生产工单/报工」页在本机取自表的业务数据自然为空。
     ② dump 是「生产管理相关列」子集(plang 56 / plang_pc 56 / scjl 77 列),
        与表清单登记的总列数(78 / 76 / 99)不等 —— 差额列由链上后续迁移补(ALTER ADD),
        或按运行时实测报错逐个补齐;本脚本只保证**结构与已 dump 部分**一致。
     ③ 幂等:OBJECT_ID 守卫建表,列注明逐条先判后加;两账套都要执行。

   依赖:无(纯建表)。被依赖:migrate-plang-*.sql / migrate-scjl-*.sql / migrate-spare-columns-biz.sql
   ⚠ 本脚本**刻意不写** 裸 USE 语句(DbSync 明令拦截:裸 USE 会让「连测试库跑」静默切到正式库),
     一律用当前连接所在的库 —— 两账套各自生效。
   ============================================================================= */
SET NOCOUNT ON;
GO

-- ══════════════════ plang(55 列,源自参考库 dump) ══════════════════
IF OBJECT_ID(N'dbo.plang') IS NULL
BEGIN
    CREATE TABLE dbo.plang (
        [comm] nvarchar(40) NOT NULL,
        [id] int IDENTITY(1,1) NOT NULL,
        [pl_no] nvarchar(28) NOT NULL,
        [pl_xc] int NULL CONSTRAINT [DF_plang_pl_xc] DEFAULT ((0)),
        [scx] nvarchar(36) NULL,
        [pl_man] nvarchar(40) NULL,
        [pl_date] datetime NULL,
        [khdm] nvarchar(16) NULL,
        [dm] nvarchar(100) NULL,
        [mc] nvarchar(500) NULL,
        [gg] nvarchar(500) NULL,
        [gg2] nvarchar(500) NULL,
        [jldw] nvarchar(16) NULL,
        [pl_sl] float NULL CONSTRAINT [DF_plang_pl_sl] DEFAULT ((0)),
        [pl_sl2] float NULL CONSTRAINT [DF_plang_pl_sl2] DEFAULT ((0)),
        [xq_sl] float NULL CONSTRAINT [DF_plang_xq_sl] DEFAULT ((0)),
        [rk_sl] float NULL CONSTRAINT [DF_plang_rk_sl] DEFAULT ((0)),
        [yl] float NULL CONSTRAINT [DF_plang_yl] DEFAULT ((0)),
        [dj] float NULL CONSTRAINT [DF_plang_dj] DEFAULT ((0)),
        [jine] float NULL CONSTRAINT [DF_plang_jine] DEFAULT ((0)),
        [cp_date] datetime NULL,
        [st_date] datetime NULL,
        [cp_date2] datetime NULL,
        [rk_no] nvarchar(60) NULL,
        [bz] ntext NULL,
        [ja] nvarchar(2) NULL,
        [od_no] nvarchar(48) NULL,
        [od_xc] float NULL CONSTRAINT [DF_plang_od_xc] DEFAULT ((0)),
        [lot_no] nvarchar(60) NULL,
        [color] nvarchar(60) NULL,
        [siz] nvarchar(60) NULL,
        [ll_no] nvarchar(60) NULL,
        [wb_no] nvarchar(60) NULL,
        [lb] nvarchar(4) NULL,
        [mjlx] nvarchar(40) NULL,
        [BomId] int NULL CONSTRAINT [DF_plang_BomId] DEFAULT ((0)),
        [ypl_sl] float NULL CONSTRAINT [DF_plang_ypl_sl] DEFAULT ((0)),
        [ll_no2] nvarchar(60) NULL,
        [remark] nvarchar(500) NULL,
        [MoDId] int NULL,
        [llxz] nvarchar(60) NULL,
        [cgrkdh] nvarchar(60) NULL,
        [lldh] nvarchar(60) NULL,
        [djlx] nvarchar(60) NULL,
        [zl] float NULL CONSTRAINT [DF_plang_zl] DEFAULT ((0)),
        [asp_user1] nvarchar(40) NULL CONSTRAINT [DF_plang_asp_user1] DEFAULT (''),
        [asp_time1] datetime NULL CONSTRAINT [DF_plang_asp_time1] DEFAULT (getdate()),
        [asp_user2] nvarchar(40) NULL CONSTRAINT [DF_plang_asp_user2] DEFAULT (''),
        [asp_time2] datetime NULL,
        [asp_user3] nvarchar(40) NULL CONSTRAINT [DF_plang_asp_user3] DEFAULT (''),
        [asp_time3] datetime NULL,
        [asp_cancel] varchar(1) NULL,
        [asp_user4] nvarchar(40) NULL CONSTRAINT [DF_plang_asp_user4] DEFAULT (''),
        [asp_time4] datetime NULL,
        [asp_print] int NULL CONSTRAINT [DF_plang_asp_print] DEFAULT ((0)),
        CONSTRAINT [PK_plang] PRIMARY KEY CLUSTERED ([id])
    );
    PRINT N'已建表 plang';
END
GO
-- 表级中文注明
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单(参考库遗留表:外部系统直接写单,键=公司+工单号 pl_no+工单行号 pl_xc)', N'SCHEMA', N'dbo', N'TABLE', N'plang';
GO
-- 列级中文注明(有 dump 中文名的列逐列注明;无名的列不臆造)
IF COL_LENGTH(N'dbo.plang', N'comm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'comm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'comm';
IF COL_LENGTH(N'dbo.plang', N'pl_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_no';
IF COL_LENGTH(N'dbo.plang', N'pl_xc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_xc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'项次', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_xc';
IF COL_LENGTH(N'dbo.plang', N'scx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'scx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产线', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'scx';
IF COL_LENGTH(N'dbo.plang', N'pl_man') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_man', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'操作员', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_man';
IF COL_LENGTH(N'dbo.plang', N'pl_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单日期', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_date';
IF COL_LENGTH(N'dbo.plang', N'khdm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'khdm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户代码', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'khdm';
IF COL_LENGTH(N'dbo.plang', N'dm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'dm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品代码', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'dm';
IF COL_LENGTH(N'dbo.plang', N'mc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'mc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品名称', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'mc';
IF COL_LENGTH(N'dbo.plang', N'gg') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'gg', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品规格', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'gg';
IF COL_LENGTH(N'dbo.plang', N'gg2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'gg2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品规格2', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'gg2';
IF COL_LENGTH(N'dbo.plang', N'jldw') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'jldw', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'jldw';
IF COL_LENGTH(N'dbo.plang', N'pl_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'排产数量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_sl';
IF COL_LENGTH(N'dbo.plang', N'pl_sl2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'pl_sl2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'排产数量2', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'pl_sl2';
IF COL_LENGTH(N'dbo.plang', N'xq_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'xq_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'需求数量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'xq_sl';
IF COL_LENGTH(N'dbo.plang', N'rk_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'rk_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'入库数量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'rk_sl';
IF COL_LENGTH(N'dbo.plang', N'yl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'yl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'余量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'yl';
IF COL_LENGTH(N'dbo.plang', N'dj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'dj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单价', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'dj';
IF COL_LENGTH(N'dbo.plang', N'jine') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'jine', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金额', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'jine';
IF COL_LENGTH(N'dbo.plang', N'cp_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'cp_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计划完工日期', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'cp_date';
IF COL_LENGTH(N'dbo.plang', N'st_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'st_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'开始日期', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'st_date';
IF COL_LENGTH(N'dbo.plang', N'cp_date2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'cp_date2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'实际完工日期', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'cp_date2';
IF COL_LENGTH(N'dbo.plang', N'rk_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'rk_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'入库单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'rk_no';
IF COL_LENGTH(N'dbo.plang', N'bz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'bz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'bz';
IF COL_LENGTH(N'dbo.plang', N'ja') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'ja', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'结案', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'ja';
IF COL_LENGTH(N'dbo.plang', N'od_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'od_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'od_no';
IF COL_LENGTH(N'dbo.plang', N'od_xc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'od_xc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单项次', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'od_xc';
IF COL_LENGTH(N'dbo.plang', N'lot_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'lot_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'lot_no';
IF COL_LENGTH(N'dbo.plang', N'color') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'color', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'颜色', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'color';
IF COL_LENGTH(N'dbo.plang', N'siz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'siz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'尺码', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'siz';
IF COL_LENGTH(N'dbo.plang', N'll_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'll_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'领料单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'll_no';
IF COL_LENGTH(N'dbo.plang', N'wb_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'wb_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外包单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'wb_no';
IF COL_LENGTH(N'dbo.plang', N'lb') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'lb', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'类别', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'lb';
IF COL_LENGTH(N'dbo.plang', N'mjlx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'mjlx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'模具类型', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'mjlx';
IF COL_LENGTH(N'dbo.plang', N'BomId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'BomId', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'完工标记', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'BomId';
IF COL_LENGTH(N'dbo.plang', N'ypl_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'ypl_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'已排产数量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'ypl_sl';
IF COL_LENGTH(N'dbo.plang', N'll_no2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'll_no2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'领料单号2', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'll_no2';
IF COL_LENGTH(N'dbo.plang', N'remark') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'remark', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注2', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'remark';
IF COL_LENGTH(N'dbo.plang', N'MoDId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'MoDId', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产工单明细ID', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'MoDId';
IF COL_LENGTH(N'dbo.plang', N'llxz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'llxz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料性质', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'llxz';
IF COL_LENGTH(N'dbo.plang', N'cgrkdh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'cgrkdh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购入库单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'cgrkdh';
IF COL_LENGTH(N'dbo.plang', N'lldh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'lldh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'lldh';
IF COL_LENGTH(N'dbo.plang', N'djlx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'djlx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据类型', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'djlx';
IF COL_LENGTH(N'dbo.plang', N'zl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'zl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'重量', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'zl';
IF COL_LENGTH(N'dbo.plang', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_user1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.plang', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_time1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.plang', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_user2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.plang', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_time2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.plang', N'asp_user3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_user3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_user3';
IF COL_LENGTH(N'dbo.plang', N'asp_time3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_time3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_time3';
IF COL_LENGTH(N'dbo.plang', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_cancel', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_cancel';
IF COL_LENGTH(N'dbo.plang', N'asp_user4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_user4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_user4';
IF COL_LENGTH(N'dbo.plang', N'asp_time4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_time4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_time4';
IF COL_LENGTH(N'dbo.plang', N'asp_print') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'asp_print', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'asp_print';
GO

-- ══════════════════ plang_pc(55 列,源自参考库 dump) ══════════════════
IF OBJECT_ID(N'dbo.plang_pc') IS NULL
BEGIN
    CREATE TABLE dbo.plang_pc (
        [comm] nvarchar(40) NOT NULL,
        [id] int IDENTITY(1,1) NOT NULL,
        [pl_no] nvarchar(28) NOT NULL,
        [pl_xc] int NULL CONSTRAINT [DF_plang_pc_pl_xc] DEFAULT ((0)),
        [scx] nvarchar(36) NULL,
        [pl_man] nvarchar(40) NULL,
        [pl_date] datetime NULL,
        [khdm] nvarchar(16) NULL,
        [dm] nvarchar(100) NULL,
        [mc] nvarchar(500) NULL,
        [gg] nvarchar(500) NULL,
        [gg2] nvarchar(500) NULL,
        [jldw] nvarchar(16) NULL,
        [pl_sl] float NULL CONSTRAINT [DF_plang_pc_pl_sl] DEFAULT ((0)),
        [pl_sl2] float NULL CONSTRAINT [DF_plang_pc_pl_sl2] DEFAULT ((0)),
        [xq_sl] float NULL CONSTRAINT [DF_plang_pc_xq_sl] DEFAULT ((0)),
        [rk_sl] float NULL CONSTRAINT [DF_plang_pc_rk_sl] DEFAULT ((0)),
        [yl] float NULL CONSTRAINT [DF_plang_pc_yl] DEFAULT ((0)),
        [dj] float NULL CONSTRAINT [DF_plang_pc_dj] DEFAULT ((0)),
        [jine] float NULL CONSTRAINT [DF_plang_pc_jine] DEFAULT ((0)),
        [cp_date] datetime NULL,
        [st_date] datetime NULL,
        [cp_date2] datetime NULL,
        [rk_no] nvarchar(60) NULL,
        [bz] ntext NULL,
        [ja] nvarchar(2) NULL,
        [od_no] nvarchar(48) NULL,
        [od_xc] float NULL CONSTRAINT [DF_plang_pc_od_xc] DEFAULT ((0)),
        [lot_no] nvarchar(60) NULL,
        [color] nvarchar(60) NULL,
        [siz] nvarchar(60) NULL,
        [ll_no] nvarchar(60) NULL,
        [wb_no] nvarchar(60) NULL,
        [lb] nvarchar(4) NULL,
        [mjlx] nvarchar(40) NULL,
        [BomId] int NULL CONSTRAINT [DF_plang_pc_BomId] DEFAULT ((0)),
        [jh_date] datetime NULL,
        [ll_no2] nvarchar(60) NULL,
        [remark] nvarchar(500) NULL,
        [MoDId] int NULL,
        [llxz] nvarchar(60) NULL,
        [cgrkdh] nvarchar(60) NULL,
        [lldh] nvarchar(60) NULL,
        [djlx] nvarchar(60) NULL,
        [zl] float NULL CONSTRAINT [DF_plang_pc_zl] DEFAULT ((0)),
        [asp_user1] nvarchar(40) NULL CONSTRAINT [DF_plang_pc_asp_user1] DEFAULT (''),
        [asp_time1] datetime NULL CONSTRAINT [DF_plang_pc_asp_time1] DEFAULT (getdate()),
        [asp_user2] nvarchar(40) NULL CONSTRAINT [DF_plang_pc_asp_user2] DEFAULT (''),
        [asp_time2] datetime NULL,
        [asp_user3] nvarchar(40) NULL CONSTRAINT [DF_plang_pc_asp_user3] DEFAULT (''),
        [asp_time3] datetime NULL,
        [asp_cancel] varchar(1) NULL,
        [asp_user4] nvarchar(40) NULL CONSTRAINT [DF_plang_pc_asp_user4] DEFAULT (''),
        [asp_time4] datetime NULL,
        [asp_print] int NULL CONSTRAINT [DF_plang_pc_asp_print] DEFAULT ((0)),
        CONSTRAINT [PK_plang_pc] PRIMARY KEY CLUSTERED ([id])
    );
    PRINT N'已建表 plang_pc';
END
GO
-- 表级中文注明
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单排产(参考库遗留表:plang 的排产行,plang_id 锚回 plang.id)', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc';
GO
-- 列级中文注明(有 dump 中文名的列逐列注明;无名的列不臆造)
IF COL_LENGTH(N'dbo.plang_pc', N'comm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'comm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'comm';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_no';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_xc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_xc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'项次', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_xc';
IF COL_LENGTH(N'dbo.plang_pc', N'scx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'scx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产线', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'scx';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_man') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_man', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'操作员', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_man';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单日期', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_date';
IF COL_LENGTH(N'dbo.plang_pc', N'khdm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'khdm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户代码', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'khdm';
IF COL_LENGTH(N'dbo.plang_pc', N'dm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'dm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品代码', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'dm';
IF COL_LENGTH(N'dbo.plang_pc', N'mc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'mc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品名称', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'mc';
IF COL_LENGTH(N'dbo.plang_pc', N'gg') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'gg', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品规格', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'gg';
IF COL_LENGTH(N'dbo.plang_pc', N'gg2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'gg2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品规格2', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'gg2';
IF COL_LENGTH(N'dbo.plang_pc', N'jldw') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'jldw', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'jldw';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'排产数量', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_sl';
IF COL_LENGTH(N'dbo.plang_pc', N'pl_sl2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'pl_sl2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'排产数量2', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'pl_sl2';
IF COL_LENGTH(N'dbo.plang_pc', N'xq_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'xq_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'需求数量', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'xq_sl';
IF COL_LENGTH(N'dbo.plang_pc', N'rk_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'rk_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'入库数量', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'rk_sl';
IF COL_LENGTH(N'dbo.plang_pc', N'yl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'yl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'余量', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'yl';
IF COL_LENGTH(N'dbo.plang_pc', N'dj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'dj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单价', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'dj';
IF COL_LENGTH(N'dbo.plang_pc', N'jine') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'jine', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'金额', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'jine';
IF COL_LENGTH(N'dbo.plang_pc', N'cp_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'cp_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计划完工日期', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'cp_date';
IF COL_LENGTH(N'dbo.plang_pc', N'st_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'st_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'开始日期', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'st_date';
IF COL_LENGTH(N'dbo.plang_pc', N'cp_date2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'cp_date2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'实际完工日期', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'cp_date2';
IF COL_LENGTH(N'dbo.plang_pc', N'rk_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'rk_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'入库单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'rk_no';
IF COL_LENGTH(N'dbo.plang_pc', N'bz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'bz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'bz';
IF COL_LENGTH(N'dbo.plang_pc', N'ja') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'ja', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'结案', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'ja';
IF COL_LENGTH(N'dbo.plang_pc', N'od_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'od_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'od_no';
IF COL_LENGTH(N'dbo.plang_pc', N'od_xc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'od_xc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单表身ID', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'od_xc';
IF COL_LENGTH(N'dbo.plang_pc', N'lot_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'lot_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'lot_no';
IF COL_LENGTH(N'dbo.plang_pc', N'color') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'color', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'颜色', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'color';
IF COL_LENGTH(N'dbo.plang_pc', N'siz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'siz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'尺码', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'siz';
IF COL_LENGTH(N'dbo.plang_pc', N'll_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'll_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户PO', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'll_no';
IF COL_LENGTH(N'dbo.plang_pc', N'wb_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'wb_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'外包单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'wb_no';
IF COL_LENGTH(N'dbo.plang_pc', N'lb') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'lb', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'类别', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'lb';
IF COL_LENGTH(N'dbo.plang_pc', N'mjlx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'mjlx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'模具类型', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'mjlx';
IF COL_LENGTH(N'dbo.plang_pc', N'BomId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'BomId', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'完工标记', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'BomId';
IF COL_LENGTH(N'dbo.plang_pc', N'jh_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'jh_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单交期', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'jh_date';
IF COL_LENGTH(N'dbo.plang_pc', N'll_no2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'll_no2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'领料单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'll_no2';
IF COL_LENGTH(N'dbo.plang_pc', N'remark') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'remark', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注2', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'remark';
IF COL_LENGTH(N'dbo.plang_pc', N'MoDId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'MoDId', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产工单明细ID', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'MoDId';
IF COL_LENGTH(N'dbo.plang_pc', N'llxz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'llxz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料性质', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'llxz';
IF COL_LENGTH(N'dbo.plang_pc', N'cgrkdh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'cgrkdh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购入库单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'cgrkdh';
IF COL_LENGTH(N'dbo.plang_pc', N'lldh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'lldh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料单号', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'lldh';
IF COL_LENGTH(N'dbo.plang_pc', N'djlx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'djlx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据类型', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'djlx';
IF COL_LENGTH(N'dbo.plang_pc', N'zl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'zl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'重量', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'zl';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_user1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_time1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_user2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_time2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_user3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_user3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_user3';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_time3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_time3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_time3';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_cancel', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_cancel';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_user4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_user4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_user4';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_time4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_time4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_time4';
IF COL_LENGTH(N'dbo.plang_pc', N'asp_print') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang_pc') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'asp_print', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'asp_print';
GO

-- ══════════════════ scjl(76 列,源自参考库 dump) ══════════════════
IF OBJECT_ID(N'dbo.scjl') IS NULL
BEGIN
    CREATE TABLE dbo.scjl (
        [comm] nvarchar(40) NOT NULL,
        [id] int IDENTITY(1,1) NOT NULL,
        [sc_no] nvarchar(28) NOT NULL,
        [wzdm] nvarchar(100) NULL,
        [mc] nvarchar(500) NULL,
        [gg] nvarchar(500) NULL,
        [jldw] nvarchar(16) NULL,
        [sc_date] datetime NULL,
        [ywman] nvarchar(40) NULL,
        [gldh] nvarchar(40) NULL,
        [gd_id] int NULL CONSTRAINT [DF_scjl_gd_id] DEFAULT ((0)),
        [gxdm] nvarchar(16) NULL,
        [sl] float NULL CONSTRAINT [DF_scjl_sl] DEFAULT ((0)),
        [loss] float NULL CONSTRAINT [DF_scjl_loss] DEFAULT ((0)),
        [loss_ra] float NULL CONSTRAINT [DF_scjl_loss_ra] DEFAULT ((0)),
        [bf_qty] float NULL CONSTRAINT [DF_scjl_bf_qty] DEFAULT ((0)),
        [bl_qty] float NULL CONSTRAINT [DF_scjl_bl_qty] DEFAULT ((0)),
        [lot_no] nvarchar(60) NULL,
        [color] nvarchar(60) NULL,
        [siz] nvarchar(60) NULL,
        [gs] float NULL CONSTRAINT [DF_scjl_gs] DEFAULT ((0)),
        [gz] float NULL CONSTRAINT [DF_scjl_gz] DEFAULT ((0)),
        [dwzt] nvarchar(4) NULL,
        [dwsj] datetime NULL,
        [kszt] nvarchar(4) NULL,
        [kssj] datetime NULL,
        [wgzt] nvarchar(4) NULL,
        [wgsj] datetime NULL,
        [bz] nvarchar(200) NULL CONSTRAINT [DF_scjl_bz] DEFAULT ((0)),
        [scx] nvarchar(36) NULL,
        [scxmc] nvarchar(40) NULL,
        [tm] nvarchar(60) NULL,
        [delmark] int NULL CONSTRAINT [DF_scjl_delmark] DEFAULT ((0)),
        [post_no] nvarchar(40) NULL,
        [kk] float NULL CONSTRAINT [DF_scjl_kk] DEFAULT ((0)),
        [zfjl] float NULL CONSTRAINT [DF_scjl_zfjl] DEFAULT ((0)),
        [other] float NULL CONSTRAINT [DF_scjl_other] DEFAULT ((0)),
        [jc_no] nvarchar(60) NULL,
        [cp_no] nvarchar(60) NULL,
        [gd_ph] nvarchar(60) NULL,
        [lx] nvarchar(200) NULL,
        [wj] nvarchar(60) NULL,
        [htys] nvarchar(500) NULL,
        [cpcz] nvarchar(500) NULL,
        [sx] nvarchar(500) NULL,
        [jm] nvarchar(60) NULL,
        [sjd] nvarchar(500) NULL,
        [jbbh] text NULL,
        [zsdd] nvarchar(500) NULL,
        [cplsh] nvarchar(260) NULL,
        [pl_sl] float NULL CONSTRAINT [DF_scjl_pl_sl] DEFAULT ((0)),
        [pp] nvarchar(60) NULL,
        [khdm] nvarchar(16) NULL,
        [ddwsl] float NULL CONSTRAINT [DF_scjl_ddwsl] DEFAULT ((0)),
        [jh_date] datetime NULL,
        [od_no] nvarchar(48) NULL,
        [od_xc] float NULL CONSTRAINT [DF_scjl_od_xc] DEFAULT ((0)),
        [ywymc] nvarchar(40) NULL,
        [gsje] float NULL CONSTRAINT [DF_scjl_gsje] DEFAULT ((0)),
        [llxz] nvarchar(60) NULL,
        [cgrkdh] nvarchar(60) NULL,
        [lldh] nvarchar(60) NULL,
        [djlx] nvarchar(60) NULL,
        [zl] float NULL CONSTRAINT [DF_scjl_zl] DEFAULT ((0)),
        [sl2] float NULL CONSTRAINT [DF_scjl_sl2] DEFAULT ((0)),
        [sl3] float NULL CONSTRAINT [DF_scjl_sl3] DEFAULT ((0)),
        [asp_user1] nvarchar(40) NULL CONSTRAINT [DF_scjl_asp_user1] DEFAULT (''),
        [asp_time1] datetime NULL CONSTRAINT [DF_scjl_asp_time1] DEFAULT (getdate()),
        [asp_user2] nvarchar(40) NULL CONSTRAINT [DF_scjl_asp_user2] DEFAULT (''),
        [asp_time2] datetime NULL,
        [asp_user3] nvarchar(40) NULL CONSTRAINT [DF_scjl_asp_user3] DEFAULT (''),
        [asp_time3] datetime NULL,
        [asp_cancel] varchar(1) NULL CONSTRAINT [DF_scjl_asp_cancel] DEFAULT ('N'),
        [asp_user4] nvarchar(40) NULL CONSTRAINT [DF_scjl_asp_user4] DEFAULT (''),
        [asp_time4] datetime NULL,
        [asp_print] int NULL CONSTRAINT [DF_scjl_asp_print] DEFAULT ((0)),
        CONSTRAINT [PK_scjl] PRIMARY KEY CLUSTERED ([id])
    );
    PRINT N'已建表 scjl';
END
GO
-- 表级中文注明
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产记录(参考库遗留表:工序报工/生产记录,gd_id 锚 plang_pc.id)', N'SCHEMA', N'dbo', N'TABLE', N'scjl';
GO
-- 列级中文注明(有 dump 中文名的列逐列注明;无名的列不臆造)
IF COL_LENGTH(N'dbo.scjl', N'comm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'comm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'comm';
IF COL_LENGTH(N'dbo.scjl', N'sc_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sc_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产单号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sc_no';
IF COL_LENGTH(N'dbo.scjl', N'wzdm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'wzdm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'物料编码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'wzdm';
IF COL_LENGTH(N'dbo.scjl', N'mc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'mc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品名称', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'mc';
IF COL_LENGTH(N'dbo.scjl', N'gg') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gg', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品规格', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gg';
IF COL_LENGTH(N'dbo.scjl', N'jldw') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jldw', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计量单位', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jldw';
IF COL_LENGTH(N'dbo.scjl', N'sc_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sc_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产日期', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sc_date';
IF COL_LENGTH(N'dbo.scjl', N'ywman') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'ywman', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务员', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'ywman';
IF COL_LENGTH(N'dbo.scjl', N'gldh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gldh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单号码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gldh';
IF COL_LENGTH(N'dbo.scjl', N'gd_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gd_id', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单ID', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gd_id';
IF COL_LENGTH(N'dbo.scjl', N'gxdm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gxdm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工序代码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gxdm';
IF COL_LENGTH(N'dbo.scjl', N'sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sl';
IF COL_LENGTH(N'dbo.scjl', N'loss') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'loss', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'损耗', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'loss';
IF COL_LENGTH(N'dbo.scjl', N'loss_ra') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'loss_ra', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'损耗率', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'loss_ra';
IF COL_LENGTH(N'dbo.scjl', N'bf_qty') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'bf_qty', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'报废数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'bf_qty';
IF COL_LENGTH(N'dbo.scjl', N'bl_qty') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'bl_qty', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'不良数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'bl_qty';
IF COL_LENGTH(N'dbo.scjl', N'lot_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'lot_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'批号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'lot_no';
IF COL_LENGTH(N'dbo.scjl', N'color') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'color', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'颜色', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'color';
IF COL_LENGTH(N'dbo.scjl', N'siz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'siz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'尺码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'siz';
IF COL_LENGTH(N'dbo.scjl', N'gs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gs', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工时', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gs';
IF COL_LENGTH(N'dbo.scjl', N'gz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工资', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gz';
IF COL_LENGTH(N'dbo.scjl', N'dwzt') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'dwzt', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'到位状态', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'dwzt';
IF COL_LENGTH(N'dbo.scjl', N'dwsj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'dwsj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'到位时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'dwsj';
IF COL_LENGTH(N'dbo.scjl', N'kszt') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'kszt', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'开始状态', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'kszt';
IF COL_LENGTH(N'dbo.scjl', N'kssj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'kssj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'开始时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'kssj';
IF COL_LENGTH(N'dbo.scjl', N'wgzt') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'wgzt', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'完工状态', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'wgzt';
IF COL_LENGTH(N'dbo.scjl', N'wgsj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'wgsj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'完工时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'wgsj';
IF COL_LENGTH(N'dbo.scjl', N'bz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'bz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'bz';
IF COL_LENGTH(N'dbo.scjl', N'scx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'scx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产线', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'scx';
IF COL_LENGTH(N'dbo.scjl', N'scxmc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'scxmc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产线名称', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'scxmc';
IF COL_LENGTH(N'dbo.scjl', N'tm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'tm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'条码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'tm';
IF COL_LENGTH(N'dbo.scjl', N'delmark') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'delmark', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'delmark';
IF COL_LENGTH(N'dbo.scjl', N'post_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'post_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'POS机号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'post_no';
IF COL_LENGTH(N'dbo.scjl', N'kk') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'kk', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'扣款', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'kk';
IF COL_LENGTH(N'dbo.scjl', N'zfjl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'zfjl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'需求数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'zfjl';
IF COL_LENGTH(N'dbo.scjl', N'other') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'other', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'其他', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'other';
IF COL_LENGTH(N'dbo.scjl', N'jc_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jc_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'进厂编号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jc_no';
IF COL_LENGTH(N'dbo.scjl', N'cp_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'cp_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品编号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'cp_no';
IF COL_LENGTH(N'dbo.scjl', N'gd_ph') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gd_ph', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单盘号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gd_ph';
IF COL_LENGTH(N'dbo.scjl', N'lx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'lx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'挂具名称', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'lx';
IF COL_LENGTH(N'dbo.scjl', N'wj') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'wj', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'每挂数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'wj';
IF COL_LENGTH(N'dbo.scjl', N'htys') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'htys', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'不良原因', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'htys';
IF COL_LENGTH(N'dbo.scjl', N'cpcz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'cpcz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产品材质', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'cpcz';
IF COL_LENGTH(N'dbo.scjl', N'sx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'纱型', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sx';
IF COL_LENGTH(N'dbo.scjl', N'jm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'计米', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jm';
IF COL_LENGTH(N'dbo.scjl', N'sjd') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sjd', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'松紧度', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sjd';
IF COL_LENGTH(N'dbo.scjl', N'jbbh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jbbh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'班别', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jbbh';
IF COL_LENGTH(N'dbo.scjl', N'zsdd') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'zsdd', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'报废原因', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'zsdd';
IF COL_LENGTH(N'dbo.scjl', N'cplsh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'cplsh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'产成品流水号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'cplsh';
IF COL_LENGTH(N'dbo.scjl', N'pl_sl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'pl_sl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'排产数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'pl_sl';
IF COL_LENGTH(N'dbo.scjl', N'pp') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'pp', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户PO', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'pp';
IF COL_LENGTH(N'dbo.scjl', N'khdm') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'khdm', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'客户代码', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'khdm';
IF COL_LENGTH(N'dbo.scjl', N'ddwsl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'ddwsl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'多单位数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'ddwsl';
IF COL_LENGTH(N'dbo.scjl', N'jh_date') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'jh_date', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单交期', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'jh_date';
IF COL_LENGTH(N'dbo.scjl', N'od_no') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'od_no', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'od_no';
IF COL_LENGTH(N'dbo.scjl', N'od_xc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'od_xc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'订单表身ID', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'od_xc';
IF COL_LENGTH(N'dbo.scjl', N'ywymc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'ywymc', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'业务员名称', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'ywymc';
IF COL_LENGTH(N'dbo.scjl', N'gsje') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'gsje', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工时金额', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'gsje';
IF COL_LENGTH(N'dbo.scjl', N'llxz') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'llxz', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料性质', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'llxz';
IF COL_LENGTH(N'dbo.scjl', N'cgrkdh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'cgrkdh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购入库单号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'cgrkdh';
IF COL_LENGTH(N'dbo.scjl', N'lldh') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'lldh', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'来料单号', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'lldh';
IF COL_LENGTH(N'dbo.scjl', N'djlx') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'djlx', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据类型', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'djlx';
IF COL_LENGTH(N'dbo.scjl', N'zl') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'zl', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'重量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'zl';
IF COL_LENGTH(N'dbo.scjl', N'sl2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sl2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'盘数', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sl2';
IF COL_LENGTH(N'dbo.scjl', N'sl3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'sl3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'每盘数量', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'sl3';
IF COL_LENGTH(N'dbo.scjl', N'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_user1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_user1';
IF COL_LENGTH(N'dbo.scjl', N'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_time1', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_time1';
IF COL_LENGTH(N'dbo.scjl', N'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_user2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_user2';
IF COL_LENGTH(N'dbo.scjl', N'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_time2', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_time2';
IF COL_LENGTH(N'dbo.scjl', N'asp_user3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_user3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_user3';
IF COL_LENGTH(N'dbo.scjl', N'asp_time3') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_time3', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_time3';
IF COL_LENGTH(N'dbo.scjl', N'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_cancel', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_cancel';
IF COL_LENGTH(N'dbo.scjl', N'asp_user4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_user4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_user4';
IF COL_LENGTH(N'dbo.scjl', N'asp_time4') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_time4', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_time4';
IF COL_LENGTH(N'dbo.scjl', N'asp_print') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.scjl') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.scjl'), N'asp_print', 'ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'scjl', N'COLUMN', N'asp_print';
GO

-- ══════════════════ 自检:三张表就位 ══════════════════
SELECT N'遗留表就位' AS 检查, COUNT(*) AS 应等于3
FROM sys.tables WHERE name IN (N'plang', N'plang_pc', N'scjl');
GO
PRINT N'migrate-legacy-plang-scjl-tables 完成';
GO
