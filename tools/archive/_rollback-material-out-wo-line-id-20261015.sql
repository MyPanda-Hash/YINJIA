/* ============================================================
   _rollback-material-out-wo-line-id-20261015.sql — 撤回 2026-10-15 误加的「工单行id」

   背景:我曾按"pl_xc 可能不唯一 ⇒ 需要更精确的行键"的思路给 bd_material_out 加了
   [工单行id](= plang.id)列 + yj_field 登记 + 译名。**用户口径澄清后作废**:
   「工单号加工单行号作为标识,每个独立进行」—— 行标识就是 **工单号 + 工单行号**,不比 plang.id。
   故把那次加列/登记整体撤回(该迁移脚本已从仓库删除,清单条目也已移除)。

   撤回内容(逐项幂等):
     ① 删 yj_field:MATERIAL_OUT / 工单行id
     ② 删 yj_translation:field / 工单行id
     ③ 删物理列 bd_material_out.[工单行id](该列从未被任何代码写入,全部为 NULL,删除无数据损失)

   ⚠ 本脚本**不进迁移链**(一次性撤回工具,同 migrate-wo-process-line-drop.sql 先例)——
     登记进链的话 DbSync 会在每次内容变化时重跑它。
   用法(tools/ 下,两账套各跑一次):
     java -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbcUrl>" yinjia env archive\_rollback-material-out-wo-line-id-20261015.sql
   ============================================================ */
SET NOCOUNT ON;
GO
-- ① 字段登记
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行id')
BEGIN
    DELETE FROM yj_field WHERE panel_code = 'MATERIAL_OUT' AND label = N'工单行id';
    PRINT N'已删 yj_field: MATERIAL_OUT/工单行id';
END
GO
-- ② 译名
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行id')
BEGIN
    DELETE FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行id';
    PRINT N'已删 yj_translation: field/工单行id';
END
GO
-- ③ 物理列(先自检:确认全为 NULL 才删 —— 防误删有数据的列)
IF COL_LENGTH(N'dbo.bd_material_out', N'工单行id') IS NOT NULL
BEGIN
    DECLARE @n int;
    EXEC sp_executesql N'SELECT @c = COUNT(*) FROM dbo.bd_material_out WHERE [工单行id] IS NOT NULL',
         N'@c int OUTPUT', @c = @n OUTPUT;
    IF @n = 0
    BEGIN
        DECLARE @df sysname;
        SELECT @df = dc.name FROM sys.default_constraints dc
          JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
         WHERE dc.parent_object_id = OBJECT_ID(N'dbo.bd_material_out') AND c.name = N'工单行id';
        IF @df IS NOT NULL EXEC(N'ALTER TABLE dbo.bd_material_out DROP CONSTRAINT [' + @df + N']');
        ALTER TABLE dbo.bd_material_out DROP COLUMN [工单行id];
        PRINT N'已删列 bd_material_out.工单行id(原值全 NULL)';
    END
    ELSE
        PRINT N'[跳过] bd_material_out.工单行id 有 ' + CAST(@n AS nvarchar(10)) + N' 行非空,未删列(需人工确认)';
END
GO
-- 自检
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bd_material_out', N'工单行id') IS NOT NULL SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND label=N'工单行id') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'工单行id') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'撤回未彻底(%d 项残留)', 16, 1, @bad);
ELSE PRINT N'「工单行id」撤回完成(列 + 字段登记 + 译名 均已清除)';
GO
