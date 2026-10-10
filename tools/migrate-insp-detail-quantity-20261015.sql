/* ============================================================
   migrate-insp-detail-quantity-20261015.sql — 2026-10-15
   三张工序检验单**明细**补「合格数量」「不合格数量」+ 字段注册 + 译名

   用户口径(2026-10-15):
     · 「检验单自动生成**不需要**实现明细行的自动填入」「**表头带入,明细行不填入**」
       ⇒ 生单只建空明细的单头(代码 ButtonService.woInspGenerate 同步改);
     · 「为当前明细列增加**合格数量**『不合格数量**」;
     · 「汇总保持当前表格列的**填入合格数量的多少**」⇒ 汇总一律按明细列的 合格数量/不合格数量 求和,
       不再依赖原来预铺的「判定 + 数量」两行。

   处置:
     ① qc_mold_insp_detail / qc_cut_insp_detail / qc_asm_insp_detail 各补
        decimal(18,4) 列 [合格数量] 与 [不合格数量](默认 0,允许 NULL 由前端留空)+ 中文注明;
     ② yj_field 为三个明细面板注册这两个字段(place='detail' 明细列,可编辑 —— 品质手填);
     ③ yj_translation en 译名(field/合格数量 = Pass Qty,field/不合格数量 = Fail Qty;已有则跳过);
     ④ 存量回填:把原来「判定=合格 → 数量」「判定=不合格 → 数量」的旧写法搬进新列,便于老单继续汇总。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
DECLARE @tbl sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail');
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tbl, N'合格数量') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' ADD [合格数量] decimal(18,4) NULL';
        EXEC sp_executesql @sql;
        PRINT N'  + ' + @tbl + N'.合格数量 已补列';
    END
    IF COL_LENGTH(N'dbo.' + @tbl, N'不合格数量') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' ADD [不合格数量] decimal(18,4) NULL';
        EXEC sp_executesql @sql;
        PRINT N'  + ' + @tbl + N'.不合格数量 已补列';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), N'合格数量', 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
             N'合格数量(本检验项目在该批次/该工单行上的合格数量;品质手填,明细不预填。汇总=本列求和)',
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', N'合格数量';
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), N'不合格数量', 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
             N'不合格数量(本检验项目在该批次/该工单行上的不合格数量;品质手填。汇总=本列求和;组装成品检验的不合格数转不良品处理单)',
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', N'不合格数量';
    FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ② yj_field 注册(三面板,place='detail') ---------- */
DECLARE @panel varchar(50), @head sysname;
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES ('QC_MOLD_INSP', 'qc_mold_insp_detail'),
                          ('QC_CUT_INSP',  'qc_cut_insp_detail'),
                          ('QC_ASM_INSP',  'qc_asm_insp_detail')) v(p, t);
OPEN c2;
FETCH NEXT FROM c2 INTO @panel, @head;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @panel)
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'合格数量')
        BEGIN
            INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                                  display_field, place, seq, width, editable, required, hidden, alias, visible)
            VALUES (@panel, N'合格数量', N'合格数量', N'小数', NULL, NULL, NULL,
                    NULL, 'detail', 300, 90, 1, 0, 0, NULL, 1);
            PRINT N'  + ' + @panel + N'.合格数量 字段已注册(detail)';
        END
        IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'不合格数量')
        BEGIN
            INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                                  display_field, place, seq, width, editable, required, hidden, alias, visible)
            VALUES (@panel, N'不合格数量', N'不合格数量', N'小数', NULL, NULL, NULL,
                    NULL, 'detail', 310, 90, 1, 0, 0, NULL, 1);
            PRINT N'  + ' + @panel + N'.不合格数量 字段已注册(detail)';
        END
    END
    FETCH NEXT FROM c2 INTO @panel, @head;
END
CLOSE c2; DEALLOCATE c2;
GO

/* ---------- ③ en 译名 ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'合格数量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'合格数量', 'en', N'Pass Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'不合格数量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不合格数量', 'en', N'Fail Qty', 'manual');
GO

/* ---------- ④ 存量回填:旧写法「判定 + 数量」→ 新列(仅能确定的) ---------- */
DECLARE @t4 sysname, @sql4 nvarchar(max);
DECLARE c4 CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail');
OPEN c4;
FETCH NEXT FROM c4 INTO @t4;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t4, N'合格数量') IS NOT NULL
       AND COL_LENGTH(N'dbo.' + @t4, N'判定') IS NOT NULL
       AND COL_LENGTH(N'dbo.' + @t4, N'数量') IS NOT NULL
    BEGIN
        SET @sql4 = N'UPDATE dbo.' + QUOTENAME(@t4) + N' SET 合格数量 = ISNULL(数量,0)'
                  + N' WHERE 合格数量 IS NULL AND RTRIM(ISNULL(判定,N'''')) = N''合格'' AND ISNULL(asp_cancel,''N'') <> ''Y'';'
                  + N'UPDATE dbo.' + QUOTENAME(@t4) + N' SET 不合格数量 = ISNULL(数量,0)'
                  + N' WHERE 不合格数量 IS NULL AND RTRIM(ISNULL(判定,N'''')) = N''不合格'' AND ISNULL(asp_cancel,''N'') <> ''Y'';';
        EXEC sp_executesql @sql4;
        PRINT N'  ~ ' + @t4 + N' 存量「判定+数量」已搬进新列';
    END
    FETCH NEXT FROM c4 INTO @t4;
END
CLOSE c4; DEALLOCATE c4;
GO

/* ---------- 自检:三表两列 + 三面板两字段 + 两译名 ---------- */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_mold_insp_detail', N'合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_mold_insp_detail', N'不合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_cut_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_cut_insp_detail',  N'不合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail',  N'合格数量') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_detail',  N'不合格数量') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_MOLD_INSP' AND label=N'合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CUT_INSP'  AND label=N'合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_ASM_INSP'  AND label=N'合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_MOLD_INSP' AND label=N'不合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CUT_INSP'  AND label=N'不合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_ASM_INSP'  AND label=N'不合格数量') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'合格数量' AND locale='en') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不合格数量' AND locale='en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'三张工序检验单明细「合格数量/不合格数量」注册自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'三张工序检验单明细 合格数量/不合格数量 就绪(列 + 字段 detail + en 译名,幂等)';
GO
