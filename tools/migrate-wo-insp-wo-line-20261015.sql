/* ============================================================
   migrate-wo-insp-wo-line-20261015.sql — 2026-10-15
   三张工序检验单(成型/切炭/组装)**表头补「工单行号」** + 字段注册 + 译名 + 存量回填

   背景(用户口径 2026-10-15):
     「工单号+工单行号确定当前唯一工单,各个工单的进程,流程追溯都这样实现,都需要这两个进行确定。」
     检验单是工序链上的一环(报工审核 → 自动生成检验单草稿),原来单头只挂 工单号 + 报工单号 + 批次号:
       · 工单号 只能定位到**整单**(同单多行分不出是哪一行);
       · 报工单号 虽能经 scjl.gd_id → plang_pc.plang_id 反查到行,但那是**间接**的,
         检验单自身、检验单列表与检验单追溯都拿不到行键 ⇒ 同工单多行的检验单在界面上长得一样。

   处置(配套代码同批 ButtonService.woInspGenerate 写入):
     ① qc_mold_insp_head / qc_cut_insp_head / qc_asm_insp_head 各补 int 列 [工单行号] + 中文注明;
     ② yj_field 注册三面板「工单行号」(place='query,header' 列表+表单都可见,seq 35 紧随 工单号 seq 30、
        在 报工单号 seq 40 之前;只读 —— 值由系统按 scjl.[工单行号] 写入);
     ③ yj_translation en 译名(field/工单行号 = WO Line;若已有则跳过,该词条全局共享);
     ④ 存量回填:按 报工单号 → scjl.[工单行号](仅**能唯一确定**的回填:该报工单号下恰一个行号;
        取不到或一行多值一律留 NULL,不猜)。

   ⚠ 这三张表不在采购链四单基线(FourDocAudit)范围内,不受该基线闸约束。
   ⚠ 幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- ① 补物理列 + 中文注明(三张表同一处理) ---------- */
DECLARE @tbl sysname, @col sysname = N'工单行号', @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head');
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NULL
    BEGIN
        -- ⚠ 动态 SQL 必须先拼进变量再 EXEC:`EXEC(N'...' + QUOTENAME(@t) + N'...')` 实测报
        --   「Incorrect syntax near 'QUOTENAME'」(2026-10-15 踩到)
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' ADD [工单行号] int NULL';
        EXEC sp_executesql @sql;
        PRINT N'  + ' + @tbl + N'.工单行号 已补列';
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl)
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description',
             N'工单行号(该检验单对应的生产工单行,= plang.pl_xc;与工单号合起来唯一定位一张工单。报工审核自动生单时按 scjl.工单行号 写入)',
             N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- ② yj_field 注册(三面板,place='query,header',seq 35) ---------- */
DECLARE @panel varchar(50), @head sysname;
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES ('QC_MOLD_INSP', 'qc_mold_insp_head'),
                          ('QC_CUT_INSP',  'qc_cut_insp_head'),
                          ('QC_ASM_INSP',  'qc_asm_insp_head')) v(p, h);
OPEN c2;
FETCH NEXT FROM c2 INTO @panel, @head;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = @panel)
       AND COL_LENGTH(N'dbo.' + @head, N'工单行号') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = @panel AND label = N'工单行号')
    BEGIN
        INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                              display_field, place, seq, width, editable, required, hidden, alias, visible)
        VALUES (@panel, N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL,
                NULL, 'query,header', 35, 80, 0, 0, 0, NULL, 1);
        PRINT N'  + ' + @panel + N'.工单行号 字段已注册(query,header/seq35)';
    END
    FETCH NEXT FROM c2 INTO @panel, @head;
END
CLOSE c2; DEALLOCATE c2;
GO

/* ---------- ③ en 译名(该词条全局共享,已存在则跳过) ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'工单行号', 'en', N'WO Line', 'manual');
GO

/* ---------- ④ 存量回填:报工单号 → scjl.工单行号(仅能唯一确定的) ---------- */
DECLARE @t3 sysname, @sql3 nvarchar(max);
DECLARE c3 CURSOR LOCAL FAST_FORWARD FOR
    SELECT name FROM sys.tables
     WHERE name IN (N'qc_mold_insp_head', N'qc_cut_insp_head', N'qc_asm_insp_head');
OPEN c3;
FETCH NEXT FROM c3 INTO @t3;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @t3, N'工单行号') IS NOT NULL
    BEGIN
        SET @sql3 = N'
        ;WITH cand AS (
            SELECT h.[报工单号] AS rep, MAX(s.[工单行号]) AS xc
              FROM dbo.' + QUOTENAME(@t3) + N' h
              JOIN dbo.scjl s ON s.[报工单号] = h.[报工单号] AND ISNULL(s.asp_cancel,''N'') <> ''Y''
             WHERE ISNULL(h.[工单行号], 0) = 0 AND ISNULL(h.asp_cancel,''N'') <> ''Y''
               AND s.[工单行号] IS NOT NULL
             GROUP BY h.[报工单号]
            HAVING COUNT(DISTINCT s.[工单行号]) = 1
        )
        UPDATE h SET h.[工单行号] = c.xc, h.asp_user2 = N''migration'', h.asp_time2 = GETDATE()
          FROM dbo.' + QUOTENAME(@t3) + N' h JOIN cand c ON c.rep = h.[报工单号]
         WHERE ISNULL(h.[工单行号], 0) = 0 AND ISNULL(h.asp_cancel,''N'') <> ''Y'';';
        EXEC sp_executesql @sql3;
        PRINT N'  ~ ' + @t3 + N' 存量回填完成(仅唯一可定的)';
    END
    FETCH NEXT FROM c3 INTO @t3;
END
CLOSE c3; DEALLOCATE c3;
GO

/* ---------- 自检:三表列 + 三面板字段 + 译名 齐备 ---------- */
DECLARE @bad int = 0;
IF COL_LENGTH(N'dbo.qc_mold_insp_head', N'工单行号') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_cut_insp_head',  N'工单行号') IS NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_head',  N'工单行号') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_MOLD_INSP' AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_CUT_INSP'  AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'QC_ASM_INSP'  AND label = N'工单行号') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'工单行号' AND locale = 'en') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'三张工序检验单「工单行号」注册自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'三张工序检验单.工单行号 就绪(列 + 字段 query,header/seq35 + en 译名,幂等)';
GO
