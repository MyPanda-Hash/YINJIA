/* ============================================================
   migrate-finish-in-wo-line-20261015.sql — 2026-10-15
   产成品入库单(bd_finish_in)补「批次号 + 工单行号」两列 —— 工单追溯「入库段」按行收敛的唯一结构变更

   背景(用户口径 2026-10-10):
     「能按行的都按行;同工单号的不同行除同源销售订单外无任何关联。」
   工单追溯的入库段此前只按 bd_finish_in.[加工单号] = 整单取数,同工单号多行/多批次的入库单
   会全混在一起(与已修好的报工段/检验段同一种病)。根因是该表**没有任何生产行键**:
   实测列清单(2026-10-15,只读探针 tools/archive/_probe-wo-row-scope.sql)无 批次号 / 工单行号。

   本脚本(唯一结构变更;对齐 bd_material_out.工单行号 的先例 migrate-material-out-wo-line-field.sql):
     ① 防御性加列 bd_finish_in.[批次号] nvarchar(12) / [工单行号] int(与 plang.[批次号] /
        plang.pl_xc 同型同义;列名即中文标签,符合 §1.2「列名 = 中文标签」);
     ② 两列写 MS_Description 中文注明(规范 §4.7「新增列必须注明」);
     ③ yj_field 注册 FINISH_IN 表头两字段(紧随 加工单号 seq 60;只读 —— 值由系统写入,
        供仓库/追溯核对是哪一批哪一行);
     ④ yj_translation en 译名(批次号/工单行号 两个标签全局共享,已有则不重复插)。

   ⚠ **存量回填:不猜、不回填**(用户口径)。实测存量仅 1 行:
     FI-2026-09-0009 / 加工单号=MO-2026-09-0062 / 2026-09-23 / 匹配来源单号为空
     ⇒ 无法回溯它是哪一批哪一行,两列保持 NULL,界面按「历史未标注」显示。

   影响面:该表被 45 个文件按**列名**读(金蝶推送/库存台账/成本/ERP 对齐视图),加列不影响既有 SELECT;
   新列 NULL 对既有聚合(SUM/COUNT)无影响。已随任务跑 DbNormAudit(两账套)+ 四单基线回归 + 库存报表抽查。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
-- ① 加列(防御性:新库重建/服务器侧缺列场景都能补上)
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.bd_finish_in', N'批次号') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [批次号] nvarchar(12) NULL;
GO
IF OBJECT_ID(N'dbo.bd_finish_in', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.bd_finish_in', N'工单行号') IS NULL
    ALTER TABLE dbo.bd_finish_in ADD [工单行号] int NULL;
GO
-- ② 列级中文注明(查「是否已有」必须带 ep.class = 1,否则索引级扩展属性会撞 minor_id 误判)
IF COL_LENGTH(N'dbo.bd_finish_in', N'批次号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'批次号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'批次号(生产批次,与 plang.[批次号] 同义;按工单行入库时写入,工单追溯「入库段」按它+工单行号收敛)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'批次号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'批次号(生产批次,与 plang.[批次号] 同义;按工单行入库时写入,工单追溯「入库段」按它+工单行号收敛)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'批次号';
END
GO
IF COL_LENGTH(N'dbo.bd_finish_in', N'工单行号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'工单行号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description',
             N'工单行号(生产工单行,与 plang.pl_xc 同义;加工单号+工单行号 = 入库单的来源行键,工单追溯「入库段」按它收敛)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'工单行号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description',
             N'工单行号(生产工单行,与 plang.pl_xc 同义;加工单号+工单行号 = 入库单的来源行键,工单追溯「入库段」按它收敛)',
             N'SCHEMA', N'dbo', N'TABLE', N'bd_finish_in', N'COLUMN', N'工单行号';
END
GO
-- ③ 面板字段注册(FINISH_IN 表头;只读:值由系统按 plang 行写入,供仓库/追溯核对)
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'批次号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'批次号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'批次号', N'批次号', N'文本', NULL, NULL, NULL,
            NULL, 'query,header', 62, 110, 0, 0, 0, NULL, 1);
GO
IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FINISH_IN')
   AND COL_LENGTH(N'dbo.bd_finish_in', N'工单行号') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'工单行号')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible)
    VALUES ('FINISH_IN', N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL,
            NULL, 'query,header', 64, 90, 0, 0, 0, NULL, 1);
GO
-- ④ en 译名(标签全局共享;已有同标签译名则不重复插,避免撞 uq_translation)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'批次号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'批次号', 'en', N'Batch No.', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单行号', 'en', N'WO Line', 'manual');
GO
-- 自检:列 + 注明 + 字段登记 + 译名 齐备
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.bd_finish_in', N'批次号') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.bd_finish_in', N'工单行号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1
               AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
               AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'批次号', 'ColumnId')
               AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class = 1
               AND ep.major_id = OBJECT_ID(N'dbo.bd_finish_in')
               AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_finish_in'), N'工单行号', 'ColumnId')
               AND ep.name = N'MS_Description') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'批次号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'FINISH_IN' AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'批次号' AND locale = 'en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'产成品入库单「批次号/工单行号」自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'bd_finish_in.批次号/工单行号 就绪(列 + 注明 + 字段登记 + en 译名,幂等;存量不回填)';
GO
