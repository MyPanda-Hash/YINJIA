/* ============================================================
   migrate-material-out-multi-pick-20261018.sql — 2026-10-18
   一张生产工单对应多张领料单 —— plang.ll_no2 加宽(60 → 400)+ 检索索引 + 中文注明

   背景(用户口径 2026-10-18):
   「修改当前的这个领料和排产的流程,先要完成排产才进入到领料,同时需要让当前的一个
     生产工单可以对应多个领料单据」。
   - 「先排产后领料」是代码闸门(WorkOrderPickingService:该工单行 scx 非空且 pl_sl>0
     才允许转领料单;流程看板同步改成 快速排产 → 工单排产 → 产线负荷 → 材料出库单);
   - 「一单多张」改的是回写:同一工单行可同时存在多张领料草稿,审核后
     ManuWritebackService.refreshPickList 把该行**全部**已审核领料单号写进 plang.ll_no2
     (不再截「最近 3 张」)。

   ⚠ 原 ll_no2 = nvarchar(60)—— 只装得下约 3 张 CL-2026-10-00xx;多张会被写爆/截断,
     故本脚本加宽到 nvarchar(400)。**两张表都要加**:
     · `plang.ll_no2`(回写真源)
     · `plang_pc.ll_no2`(**nvarchar(30)**,`WorkOrderScheduleRecord.sync` 会把 plang 整行镜像过来)
       —— 2026-10-18 实测:只加宽 plang 时,第二张领料单审核在镜像同步处报
       「String or binary data would be truncated」(2 张单号 31 字符 > 30)。

   处置:
   ① `plang.ll_no2` / `plang_pc.ll_no2` 加宽到 nvarchar(400)(幂等:已 ≥ 400 直接跳过);
   ② 补 `plang.ll_no2` 的 MS_Description 中文注明(多张按单号倒序以英文逗号分隔);
   ③ bd_material_out(加工单号, 工单行号) 非唯一索引 —— 转领料守卫、ll_no2 回写、
      工单追溯都按这两列过滤;两列都不是新列,只加索引,不改数据。

   ⚠ 只加宽列 + 加索引,不动任何行数据;可重跑。
   两账套均执行(先正式、后测试):DbSync 按内容哈希登记,改动本文件字节会让它重跑(幂等)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ① 加宽 ll_no2:plang(60 → 400)+ plang_pc(30 → 400,镜像表) */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.plang') AND name = N'll_no2' AND max_length < 800)
BEGIN
    ALTER TABLE dbo.plang ALTER COLUMN ll_no2 nvarchar(400) NULL;
    PRINT N'plang.ll_no2 已加宽:nvarchar(60) → nvarchar(400)';
END
ELSE
    PRINT N'plang.ll_no2 已是 nvarchar(400) 或更宽(或列不存在),无需加宽';
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'dbo.plang_pc') AND name = N'll_no2' AND max_length < 800)
BEGIN
    ALTER TABLE dbo.plang_pc ALTER COLUMN ll_no2 nvarchar(400) NULL;
    PRINT N'plang_pc.ll_no2 已加宽:nvarchar(30) → nvarchar(400)';
END
ELSE
    PRINT N'plang_pc.ll_no2 已是 nvarchar(400) 或更宽(或列不存在),无需加宽';
GO

/* ② 中文注明:一张工单行可有多张领料单,单号以英文逗号分隔 */
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID(N'dbo.plang')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang'), N'll_no2', 'ColumnId')
             AND name = N'MS_Description')
BEGIN
    EXEC sys.sp_updateextendedproperty
         @name = N'MS_Description',
         @value = N'领料单号(审核后回写):该工单行全部已审核领料单号,多张按单号倒序以英文逗号分隔;一张工单可对应多张领料单',
         @level0type = N'SCHEMA', @level0name = N'dbo',
         @level1type = N'TABLE',  @level1name = N'plang',
         @level2type = N'COLUMN', @level2name = N'll_no2';
    PRINT N'plang.ll_no2 中文注明已更新';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
         @name = N'MS_Description',
         @value = N'领料单号(审核后回写):该工单行全部已审核领料单号,多张按单号倒序以英文逗号分隔;一张工单可对应多张领料单',
         @level0type = N'SCHEMA', @level0name = N'dbo',
         @level1type = N'TABLE',  @level1name = N'plang',
         @level2type = N'COLUMN', @level2name = N'll_no2';
    PRINT N'plang.ll_no2 中文注明已补';
END
GO

/* ③ 领料单按工单检索索引(加工单号, 工单行号) */
IF OBJECT_ID(N'dbo.bd_material_out') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE object_id = OBJECT_ID(N'dbo.bd_material_out')
                     AND name = N'ix_bd_material_out_wo')
BEGIN
    CREATE NONCLUSTERED INDEX ix_bd_material_out_wo
        ON dbo.bd_material_out ([加工单号], [工单行号])
        INCLUDE ([单据编号]);
    PRINT N'bd_material_out 索引 ix_bd_material_out_wo 已建';
END
ELSE
    PRINT N'bd_material_out 索引已存在(或表不存在),跳过';
GO

/* 自检:列宽(两张表)+ 索引都就绪 */
DECLARE @w int = (SELECT max_length FROM sys.columns
                  WHERE object_id = OBJECT_ID(N'dbo.plang') AND name = N'll_no2');
IF ISNULL(@w, 0) < 800
    RAISERROR(N'plang.ll_no2 加宽自检失败(当前 max_length=%d,期望 800)', 16, 1, @w);
ELSE
    PRINT N'plang.ll_no2 列宽自检通过(nvarchar(400),max_length=800)';

DECLARE @w2 int = (SELECT max_length FROM sys.columns
                   WHERE object_id = OBJECT_ID(N'dbo.plang_pc') AND name = N'll_no2');
IF ISNULL(@w2, 0) < 800
    RAISERROR(N'plang_pc.ll_no2 加宽自检失败(当前 max_length=%d,期望 800)', 16, 1, @w2);
ELSE
    PRINT N'plang_pc.ll_no2 列宽自检通过(nvarchar(400),max_length=800)';

IF OBJECT_ID(N'dbo.bd_material_out') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE object_id = OBJECT_ID(N'dbo.bd_material_out')
                     AND name = N'ix_bd_material_out_wo')
    RAISERROR(N'bd_material_out 索引 ix_bd_material_out_wo 缺失', 16, 1);
ELSE
    PRINT N'bd_material_out 索引自检通过';
GO
