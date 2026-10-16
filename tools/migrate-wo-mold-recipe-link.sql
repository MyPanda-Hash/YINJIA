/*
   migrate-wo-mold-recipe-link.sql — 生产工单绑定成型配方并生成混料用量快照

   业务口径:
   1. 生产工单唯一键仍是 plang.id(外部键)+工单号+工单行号,不改 plang 的来源语义。
   2. 只从 RD_MOLD_PROC 已审核/已归档的当前成型工艺清单读取「配方表」;
      研发草稿、审批中、作废单不得直接用于生产。
   3. 绑定时把配方头/行快照落 wo_mixing_head + wo_mixing_detail,以后研发新版本不会改写
      已绑定工单的混料口径。每次重新获取同一工单行时幂等更新当前有效快照。
   4. 混料数量由现场输入(单位:支),配料比/单支物料含量来自配方表,计划用量由后端计算并落快照。

   幂等:补列/建表/扩展属性/索引均有守卫。不要手工改库,正式/测试库都要通过 DbSync 执行。
*/
SET NOCOUNT ON;
GO

/* ── 1. plang 绑定指针(参考库遗留工单表,不复制配方明细) ─────────────── */
IF COL_LENGTH(N'dbo.plang', N'成型配方单号') IS NULL
    ALTER TABLE dbo.plang ADD [成型配方单号] nvarchar(60) NULL;
IF COL_LENGTH(N'dbo.plang', N'成型配方版本') IS NULL
    ALTER TABLE dbo.plang ADD [成型配方版本] nvarchar(30) NULL;
IF COL_LENGTH(N'dbo.plang', N'配方关联时间') IS NULL
    ALTER TABLE dbo.plang ADD [配方关联时间] datetime2 NULL;
IF COL_LENGTH(N'dbo.plang', N'配方关联人') IS NULL
    ALTER TABLE dbo.plang ADD [配方关联人] nvarchar(50) NULL;
GO

/* ── 2. 混料快照头/行(生产执行域,不挂普通面板) ─────────────────────── */
IF OBJECT_ID(N'dbo.wo_mixing_head', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_mixing_head (
        [id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_wo_mixing_head] PRIMARY KEY,
        [工单号] nvarchar(60) NOT NULL,
        [工单行id] bigint NOT NULL,
        [工单行号] int NULL,
        [混料报工单号] nvarchar(60) NULL,
        [配方单号] nvarchar(60) NOT NULL,
        [配方版本] nvarchar(30) NULL,
        [产品编号] nvarchar(100) NULL,
        [产品名称] nvarchar(200) NULL,
        [混料数量] decimal(18,4) NOT NULL,
        [单位] nvarchar(20) NULL CONSTRAINT [DF_wo_mixing_head_单位] DEFAULT (N'支'),
        [状态] nvarchar(10) NOT NULL CONSTRAINT [DF_wo_mixing_head_状态] DEFAULT (N'有效'),
        [asp_user1] nvarchar(40) NULL,
        [asp_time1] datetime2 NULL CONSTRAINT [DF_wo_mixing_head_asp_time1] DEFAULT (SYSDATETIME()),
        [asp_user2] nvarchar(40) NULL,
        [asp_time2] datetime2 NULL,
        [asp_cancel] char(1) NULL CONSTRAINT [DF_wo_mixing_head_asp_cancel] DEFAULT ('N')
    );
END;
IF OBJECT_ID(N'dbo.wo_mixing_detail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_mixing_detail (
        [id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_wo_mixing_detail] PRIMARY KEY,
        [混料头id] bigint NOT NULL,
        [工单号] nvarchar(60) NOT NULL,
        [工单行id] bigint NOT NULL,
        [工单行号] int NULL,
        [配方单号] nvarchar(60) NOT NULL,
        [配方版本] nvarchar(30) NULL,
        [序号] nvarchar(20) NULL,
        [物料种类] nvarchar(50) NULL,
        [物料编号] nvarchar(60) NULL,
        [物料名称] nvarchar(100) NULL,
        [配料比] decimal(18,8) NULL,
        [单支物料含量] decimal(18,8) NULL,
        [设计添加量] nvarchar(50) NULL,
        [计划用量] decimal(18,8) NULL,
        [实际用量] decimal(18,8) NULL,
        [asp_user1] nvarchar(40) NULL,
        [asp_time1] datetime2 NULL CONSTRAINT [DF_wo_mixing_detail_asp_time1] DEFAULT (SYSDATETIME()),
        [asp_user2] nvarchar(40) NULL,
        [asp_time2] datetime2 NULL,
        [asp_cancel] char(1) NULL CONSTRAINT [DF_wo_mixing_detail_asp_cancel] DEFAULT ('N')
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.wo_mixing_head') AND name=N'IX_wo_mixing_head_workorder')
    CREATE INDEX [IX_wo_mixing_head_workorder] ON dbo.wo_mixing_head([工单号],[工单行id],[asp_cancel]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.wo_mixing_detail') AND name=N'IX_wo_mixing_detail_head')
    CREATE INDEX [IX_wo_mixing_detail_head] ON dbo.wo_mixing_detail([混料头id],[asp_cancel]);
GO

/* ── 3. 中文扩展属性(建表与关键列同脚本注明) ───────────────────────── */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.wo_mixing_head') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产工单混料配方快照头表(一行=一个工单行的一次有效混料获取)', N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_head';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.wo_mixing_detail') AND minor_id=0 AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产工单混料配方快照行表(配方物料、配料比、计划用量)', N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_detail';
GO

DECLARE @table sysname, @column sysname, @desc nvarchar(200);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
SELECT * FROM (VALUES
 (N'wo_mixing_head',N'工单号',N'生产工单号'),
 (N'wo_mixing_head',N'工单行id',N'生产工单物理行主键plang.id'),
 (N'wo_mixing_head',N'配方单号',N'绑定的已审核/已归档成型工艺清单单号'),
 (N'wo_mixing_head',N'配方版本',N'绑定时的成型配方版本'),
 (N'wo_mixing_head',N'混料数量',N'本次混料数量,单位由单位列注明'),
 (N'wo_mixing_detail',N'混料头id',N'所属混料快照头id'),
 (N'wo_mixing_detail',N'物料编号',N'配方物料编号'),
 (N'wo_mixing_detail',N'配料比',N'归一化配料比,百分比输入已换算为小数'),
 (N'wo_mixing_detail',N'单支物料含量',N'每支产品的物料含量'),
 (N'wo_mixing_detail',N'计划用量',N'按混料数量与配方口径计算的计划投料量'),
 (N'wo_mixing_detail',N'实际用量',N'现场实际投料量')
) v(t,c,d);
OPEN c; FETCH NEXT FROM c INTO @table,@column,@desc;
WHILE @@FETCH_STATUS=0
BEGIN
    IF COL_LENGTH(N'dbo.' + @table, @column) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.'+@table) AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.'+@table),@column,'ColumnId') AND name=N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc, N'SCHEMA', N'dbo', N'TABLE', @table, N'COLUMN', @column;
    FETCH NEXT FROM c INTO @table,@column,@desc;
END
CLOSE c; DEALLOCATE c;
GO

/* plang 关键列注明 */
IF COL_LENGTH(N'dbo.plang',N'成型配方单号') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'),N'成型配方单号','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'当前生产工单行绑定的成型配方单号', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'成型配方单号';
IF COL_LENGTH(N'dbo.plang',N'成型配方版本') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.plang') AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'),N'成型配方版本','ColumnId') AND name=N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'当前生产工单行绑定的成型配方版本', N'SCHEMA', N'dbo', N'TABLE', N'plang', N'COLUMN', N'成型配方版本';
GO

SELECT N'wo_mixing_head' AS 检查项, CASE WHEN OBJECT_ID(N'dbo.wo_mixing_head',N'U') IS NULL THEN N'MISSING' ELSE N'OK' END AS 结果
UNION ALL SELECT N'wo_mixing_detail', CASE WHEN OBJECT_ID(N'dbo.wo_mixing_detail',N'U') IS NULL THEN N'MISSING' ELSE N'OK' END
UNION ALL SELECT N'plang.成型配方单号', CASE WHEN COL_LENGTH(N'dbo.plang',N'成型配方单号') IS NULL THEN N'MISSING' ELSE N'OK' END;
GO
PRINT N'migrate-wo-mold-recipe-link 完成';
GO
