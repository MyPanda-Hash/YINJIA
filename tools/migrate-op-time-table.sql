-- migrate-op-time-table.sql — 工序工时 gxgs 建表(2026-09-24)
-- ═════════════════════════════════════════════════════════════════════════════
-- 背景:OP_TIME「工序工时」面板 line_table = gxgs,但本机两账套**没有这张表** ——
--   旧脚本 migrate-op-time-and-scx.sql 的前提是「参考库 gxgs 已存在,只补面板与字段」,
--   于是面板建了、表却没建,点开即报「对象名 'gxgs' 无效」(2026-09-24 下拉生产域时实测)。
-- 本脚本按参考库实测结构逐列重建(来源:tools/archive/_ref-dump/01-table-structure.txt
--   「==== TABLE gxgs ====」段,71 列;列名/类型/可空/默认值/中文注明全部对齐,由
--   tools/archive/_gen-gxgs-migration.mjs 生成,避免手抄 71 列出错)。
-- 幂等:表已存在则整段跳过;注明用 extended_properties 幂等补充(有则不动)。
-- 依赖:无。登记位置在 db-migrations.txt 中 **migrate-op-time-and-scx.sql 之前**
--   (面板注册先于建表也能工作,但按语义先有表更清晰)。
-- 说明:不含业务数据 —— 参考库该表仅 1 行样本(见 _ref-dump/03-counts-samples.txt),
--   需要演示数据时另起 seed,不混在建表迁移里。
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.gxgs') IS NULL
CREATE TABLE dbo.gxgs (
    [comm] nvarchar(40) NOT NULL,
    [id] int IDENTITY(1,1) NOT NULL,
    [dm] nvarchar(40) NULL,
    [mc] nvarchar(40) NULL,
    [khdm] nvarchar(40) NULL,
    [xc] int NULL CONSTRAINT DF_gxgs_xc DEFAULT ((0)),
    [rq] datetime2 NULL,
    [gxdm] nvarchar(16) NULL,
    [gxmc] nvarchar(60) NULL,
    [gxsm] nvarchar(100) NULL,
    [hxsj] float NULL CONSTRAINT DF_gxgs_hxsj DEFAULT ((0)),
    [bzsj] float NULL CONSTRAINT DF_gxgs_bzsj DEFAULT ((0)),
    [zksj] float NULL CONSTRAINT DF_gxgs_zksj DEFAULT ((0)),
    [zmsj] float NULL CONSTRAINT DF_gxgs_zmsj DEFAULT ((0)),
    [pjsj] float NULL CONSTRAINT DF_gxgs_pjsj DEFAULT ((0)),
    [jgdj] float NULL CONSTRAINT DF_gxgs_jgdj DEFAULT ((0)),
    [jgdj2] float NULL CONSTRAINT DF_gxgs_jgdj2 DEFAULT ((0)),
    [sfbx] nvarchar(16) NULL,
    [mjdm] nvarchar(40) NULL,
    [gxtj] nvarchar(100) NULL,
    [scx] nvarchar(10) NULL,
    [sfdf] nvarchar(2) NULL,
    [jjdm] nvarchar(40) NULL,
    [ysjt] nvarchar(10) NULL,
    [zylc] nvarchar(200) NULL,
    [zysx] nvarchar(100) NULL,
    [jcfs] nvarchar(100) NULL,
    [sh] nvarchar(4) NULL,
    [tsgn] nvarchar(40) NULL,
    [bz] nvarchar(100) NULL,
    [bw2] nvarchar(16) NULL,
    [gxmc2] nvarchar(60) NULL,
    [gxsm2] nvarchar(100) NULL,
    [bxdj2] float NULL CONSTRAINT DF_gxgs_bxdj2 DEFAULT ((0)),
    [zd2] nvarchar(40) NULL,
    [bw3] nvarchar(16) NULL,
    [gxmc3] nvarchar(60) NULL,
    [gxsm3] nvarchar(100) NULL,
    [bxdj3] float NULL CONSTRAINT DF_gxgs_bxdj3 DEFAULT ((0)),
    [zd3] nvarchar(40) NULL,
    [bw4] nvarchar(16) NULL,
    [gxmc4] nvarchar(60) NULL,
    [gxsm4] nvarchar(100) NULL,
    [bxdj4] float NULL CONSTRAINT DF_gxgs_bxdj4 DEFAULT ((0)),
    [zd4] nvarchar(40) NULL,
    [bw5] nvarchar(16) NULL,
    [gxmc5] nvarchar(60) NULL,
    [gxsm5] nvarchar(100) NULL,
    [bxdj5] float NULL CONSTRAINT DF_gxgs_bxdj5 DEFAULT ((0)),
    [zd5] nvarchar(40) NULL,
    [bw6] nvarchar(16) NULL,
    [gxmc6] nvarchar(60) NULL,
    [gxsm6] nvarchar(100) NULL,
    [bxdj6] float NULL CONSTRAINT DF_gxgs_bxdj6 DEFAULT ((0)),
    [zd6] nvarchar(40) NULL,
    [bw7] nvarchar(16) NULL,
    [gxmc7] nvarchar(60) NULL,
    [gxsm7] nvarchar(100) NULL,
    [bxdj7] float NULL CONSTRAINT DF_gxgs_bxdj7 DEFAULT ((0)),
    [zd7] nvarchar(40) NULL,
    [sfsm] nvarchar(2) NULL CONSTRAINT DF_gxgs_sfsm DEFAULT (N'Y'),
    [asp_user1] nvarchar(40) NULL,
    [asp_time1] datetime2 NULL CONSTRAINT DF_gxgs_asp_time1 DEFAULT (getdate()),
    [asp_user2] nvarchar(40) NULL,
    [asp_time2] datetime2 NULL,
    [asp_user3] nvarchar(40) NULL,
    [asp_time3] datetime2 NULL,
    [asp_cancel] nvarchar(2) NULL CONSTRAINT DF_gxgs_asp_cancel DEFAULT (N'N'),
    [asp_user4] nvarchar(40) NULL,
    [asp_time4] datetime2 NULL,
    [asp_print] int NULL CONSTRAINT DF_gxgs_asp_print DEFAULT ((0)),
    CONSTRAINT PK_gxgs PRIMARY KEY CLUSTERED ([id])
);
GO
-- 中文注明(表 + 非空注释列,幂等)
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.gxgs') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序工时(按 客户×物料×工序 维护 换线/标准·最快·最慢·平均时间与加工单价;排产产能与计件依据;参考库同名表结构重建)', N'SCHEMA', N'dbo', N'TABLE', N'gxgs';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'comm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'comm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'dm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'代码', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'dm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'mc', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'款号名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'mc';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'khdm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'客户代码', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'khdm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'xc', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'项次', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'xc';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'rq', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'rq';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxdm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序代码', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxdm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'hxsj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'换线时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'hxsj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bzsj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'标准时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bzsj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zksj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'最快时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zksj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zmsj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'最慢时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zmsj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'pjsj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'平均时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'pjsj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'jgdj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'jgdj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'jgdj2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'加工单价2', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'jgdj2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'sfbx', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否并序', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'sfbx';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'mjdm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'模具代码', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'mjdm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxtj', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'加工条件', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxtj';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'scx', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'生产线', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'scx';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'sfdf', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否打非', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'sfdf';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'jjdm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'使用检具', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'jjdm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'ysjt', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'预设机台', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'ysjt';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zylc', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'作业流程', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zylc';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zysx', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'注意事项', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zysx';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'jcfs', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'检查方式', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'jcfs';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'sh', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'审核', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'sh';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'tsgn', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'特殊功能', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'tsgn';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bz', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bz';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw5', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc5', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm5', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj5', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd5', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd5';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw6', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw6';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc6', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc6';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm6', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm6';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj6', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj6';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd6', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd6';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bw7', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序部位', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bw7';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxmc7', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序名称', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxmc7';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'gxsm7', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'工序说明', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'gxsm7';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'bxdj7', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'并序加工单价', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'bxdj7';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'zd7', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'完工后转到', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'zd7';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'sfsm', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'是否扫码', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'sfsm';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_user1', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_user1';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_time1', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_time1';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_user2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_user2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_time2', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_time2';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_user3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_user3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_time3', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_time3';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_cancel', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_cancel';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_user4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_user4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_time4', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_time4';
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo.gxgs') AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.gxgs'), N'asp_print', 'ColumnId') AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'gxgs', N'COLUMN', N'asp_print';
GO
-- 自检(⚠ PRINT 里不能直接放子查询:Msg 1046「只能使用常量表达式」,必须先赋变量)
IF OBJECT_ID('dbo.gxgs') IS NULL RAISERROR(N'[op-time-table] 自检失败:gxgs 不存在', 16, 1);
ELSE BEGIN
  DECLARE @col_count int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.gxgs'));
  PRINT N'[op-time-table] gxgs 就绪,列数 = ' + CAST(@col_count AS nvarchar(10));
END
GO
