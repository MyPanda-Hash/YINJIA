/*
 * migrate-sample-progress-desc-20261111.sql
 *
 * 目的：给两张开发样品申请单加「进度描述」列。
 *
 * 用户口径（2026-11-11）：
 *   · 外部单：「需要添加一项样品状态描述（负责人进行文字描述进度）…列标题加一项进度描述，
 *     样品负责人可修改实时状态描述」；
 *   · 内部单第 5 条：「那个只是像图片的一样加一个进度描述的字段列，由提交人实时去更新状态，
 *     **这个字段不受归档约束**，但是也是**只能谁提交的谁来修改**」；
 *   · 追问「归档后连 edit_others 也不能改？」→ 答「**只锁申请人**」。
 *
 * 落点：
 *   · 外部单 → 头表 rd_sample_ext_head（一张外部单 = 一个样品，与它"一单一样品"的模型一致）；
 *   · 内部单 → 明细 rd_sample_int_detail（内部单"一单多行、行各归其主"，进度是**行**的属性）。
 *
 * ⚠ 语义要点（代码侧配合，见 ButtonService.updateSampleProgress）：
 *   「不受归档约束」= 归档锁的是业务字段；进度描述是过程跟踪信息，归档后申请人仍可更新。
 *   故它走一条**独立于 saveDoc 的窄接口**，只校验「是不是这行/这张单的申请人」。
 *
 * 幂等：先判 sys.columns 再 ADD；重复执行不报错。
 * 规范：新增列必须写 MS_Description 中文注明（AGENTS.md 硬要求）。
 *
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 外部单头表 ─────────────────────────────────────────────── */
IF COL_LENGTH('rd_sample_ext_head', '进度描述') IS NULL
BEGIN
    ALTER TABLE rd_sample_ext_head ADD [进度描述] nvarchar(500) NULL;
    PRINT '[progress] rd_sample_ext_head.进度描述 added';
END
ELSE PRINT '[progress] rd_sample_ext_head.进度描述 exists, skip';

/* ── ② 内部单明细表 ───────────────────────────────────────────── */
IF COL_LENGTH('rd_sample_int_detail', '进度描述') IS NULL
BEGIN
    ALTER TABLE rd_sample_int_detail ADD [进度描述] nvarchar(500) NULL;
    PRINT '[progress] rd_sample_int_detail.进度描述 added';
END
ELSE PRINT '[progress] rd_sample_int_detail.进度描述 exists, skip';

/* ── ③ 中文注明（项目硬规范：新增列必须带 MS_Description）──────────
   写法参照 tools/migrate-table-comments.sql：先删同名扩展属性再补，保证可重复执行。 */
DECLARE @tbl SYSNAME, @col SYSNAME, @desc NVARCHAR(200), @sql NVARCHAR(MAX);

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES
        ('rd_sample_ext_head',   N'进度描述', N'样品制作进度的实时文字描述（外部开发样品申请单）。由申请人/样品负责人维护；不受归档约束，归档后仍可更新。'),
        ('rd_sample_int_detail', N'进度描述', N'样品制作进度的实时文字描述（内部开发样品申请单，行级）。由该行申请人维护；不受归档约束，归档后仍可更新。')
    ) AS v(tbl, col, descr);

OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(@tbl) AND minor_id = COLUMNPROPERTY(OBJECT_ID(@tbl), @col, 'ColumnId')
                 AND name = N'MS_Description')
    BEGIN
        EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
    END
    SET @sql = N'EXEC sp_addextendedproperty N''MS_Description'', @value = N''' + REPLACE(@desc, '''', '''''')
             + N''', @level0type = N''SCHEMA'', @level0name = N''dbo'', @level1type = N''TABLE'', @level1name = N'''
             + @tbl + N''', @level2type = N''COLUMN'', @level2name = N''' + @col + N'''';
    EXEC sp_executesql @sql;
    PRINT '[progress] MS_Description set: ' + @tbl + '.' + @col;
    FETCH NEXT FROM cur INTO @tbl, @col, @desc;
END
CLOSE cur; DEALLOCATE cur;

/* ── ④ 自检：两列都必须存在 ───────────────────────────────────── */
DECLARE @missing INT = 0;
IF COL_LENGTH('rd_sample_ext_head', '进度描述') IS NULL SET @missing = @missing + 1;
IF COL_LENGTH('rd_sample_int_detail', '进度描述') IS NULL SET @missing = @missing + 1;
IF @missing > 0
BEGIN
    RAISERROR(N'[progress] 自检失败：仍有 %d 张表缺 进度描述 列', 16, 1, @missing);
    RETURN;
END
PRINT '[progress] 自检通过：两张样品表的 进度描述 列齐备。';

/* ── ⑤ 字段元数据：进了 yj_field 才会在纸面上出现 ─────────────────
   外部单：header 区，位置排在「备注」之前（seq 160，备注是 170）。
   内部单：detail 区，排最后（seq 140，样品状态是 130）。
   editable=1 让它可填；真正的"谁能改"由后端窄接口判定，不靠这个开关。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_EXT' AND label = N'进度描述')
    INSERT INTO yj_field (panel_code, col_name, label, place, seq, required, editable, visible, hidden)
    VALUES (N'RD_SAMPLE_EXT', N'进度描述', N'进度描述', N'header', 160, 0, 1, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_SAMPLE_INT' AND label = N'进度描述')
    INSERT INTO yj_field (panel_code, col_name, label, place, seq, required, editable, visible, hidden)
    VALUES (N'RD_SAMPLE_INT', N'进度描述', N'进度描述', N'detail', 140, 0, 1, 1, 0);

/* 多语言：新增字段必须同时给译名（AGENTS.md 多语言强制规范） */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'进度描述' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'进度描述', N'en', N'Progress note', N'manual');

PRINT '[progress] yj_field / yj_translation 就位。';
