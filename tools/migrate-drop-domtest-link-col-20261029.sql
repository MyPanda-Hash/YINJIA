/* ============================================================================
   migrate-drop-domtest-link-col-20261029.sql
   删除 8 张数据记录表上**没人用**的「测试申请单编号」列(2026-10-29)

   【为什么删】
     上一版(migrate-rd-domtest-link-20261029.sql)为了让记录表关联测试申请单,新加了这一列,
     并把它登记成 place=query 的字段。但 query 位置的字段**纸面上不渲染、界面上填不到** ——
     用户实际填的是右上角「文档编号」那格(他的原话:「数据记录表也是引用的申请单的右上角的单据编号」)。
     于是这一列永远是 NULL,汇总表因此一直显示「无关联」(实测:FE-2026-10-0009 → 文档编号
     = DT-2026-10-0012,而 测试申请单编号 = NULL)。
     关联判据已改为读「文档编号」(PanelConfigService.linkedRecordSheets),这一列彻底冗余。

   【删之前已核实(两个账套都查过)】
     8 张表的 [测试申请单编号] 非空行数 = **全 0** ⇒ 删列不丢任何业务数据。

   【本脚本做三件事】
     1. 删 yj_field 里的 8 条登记(place=query)
     2. 删物理列(8 张表 × 1 列)
     3. 自检:列与登记都必须归零

   ⚠ 幂等:列/登记已不存在则跳过。
   ⚠ 这是**不可逆**操作(DROP COLUMN)。执行前请确认第 0 步的守卫通过 ——
     脚本内置守卫:只要任一表该列有非空数据,就 RAISERROR 中止,不删任何东西。
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @tables TABLE (tbl sysname);
INSERT INTO @tables (tbl) VALUES
  ('rd_alkaline_head'), ('rd_mineral_head'), ('rd_antibact_head'), ('rd_scale_head'),
  ('rd_ro_protect_head'), ('rd_soak_head'), ('rd_drop_prec_head'), ('rd_filter_eff_head');

/* ── 0. 守卫:任一表该列有非空值 ⇒ 立即中止 ── */
DECLARE @t sysname, @sql nvarchar(max), @n int, @dirty int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @tables;
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t) IS NOT NULL
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = N'测试申请单编号')
    BEGIN
        SET @sql = N'SELECT @c = COUNT(*) FROM dbo.' + QUOTENAME(@t)
                 + N' WHERE LTRIM(RTRIM(ISNULL([测试申请单编号],'''') )) <> ''''';
        EXEC sp_executesql @sql, N'@c int OUTPUT', @c = @n OUTPUT;
        IF @n > 0
        BEGIN
            PRINT '[GUARD] ' + @t + N' 有 ' + CAST(@n AS nvarchar(10)) + N' 行非空';
            SET @dirty = @dirty + @n;
        END
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;

IF @dirty > 0
BEGIN
    RAISERROR('中止:测试申请单编号列仍有 %d 行数据,拒绝删除(请先人工确认并迁移这批数据)', 16, 1, @dirty);
    RETURN;
END
PRINT '[GUARD] 8 张表该列均为空,可以安全删除';

/* ── 1. 删 yj_field 登记 ── */
DELETE FROM yj_field WHERE label = N'测试申请单编号';
PRINT '[DEL] yj_field 测试申请单编号 登记 = ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';

/* ── 2. 删物理列 ── */
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @tables;
OPEN cur2;
FETCH NEXT FROM cur2 INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t) IS NOT NULL
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = N'测试申请单编号')
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' DROP COLUMN [测试申请单编号]';
        EXEC sp_executesql @sql;
        PRINT '[DROP] ' + @t + N'.测试申请单编号';
    END
    ELSE
        PRINT '[SKIP] ' + @t + N'(表或列不存在)';
    FETCH NEXT FROM cur2 INTO @t;
END
CLOSE cur2; DEALLOCATE cur2;

/* ── 3. 自检:列与登记都必须归零 ── */
DECLARE @leftCols int, @leftFields int;
SELECT @leftCols = COUNT(*) FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE c.name = N'测试申请单编号' AND t.name LIKE 'rd_%_head';
SELECT @leftFields = COUNT(*) FROM yj_field WHERE label = N'测试申请单编号';

IF @leftCols > 0 OR @leftFields > 0
BEGIN
    RAISERROR('自检失败:残留 列=%d / 字段登记=%d', 16, 1, @leftCols, @leftFields);
    RETURN;
END

PRINT '[OK] 测试申请单编号 列与登记已全部清除(8 表 × 1 列 + 8 条 yj_field)';
