/*
 * migrate-insp-plan-revision-page-20261111.sql
 *
 * 目的：给出货检验计划表（RD_INSP_PLAN）加「修订记录」页签所需的物理分块列。
 *
 * 用户口径（2026-11-11）：
 *   「这个面板（出货检验计划表）也加一个修订记录 tap 页，所有的修订记录 tap 页都要预先设置
 *     符合 A4 打印的行数，而不是要自己一个一个去加，这个是固定下来，没有数据填写就表格空着」。
 *
 * 为什么需要这个迁移
 * ------------------
 * 一张行表要承载两张逻辑表（检验项目 / 修订记录）时，项目里的唯一约定是
 *   `filterKey: '表区'` + `filterVal` 分块（见 CONTEXT「表区是物理列而非内存标记」，由
 *   recordSheetConfigs.filtervals.test.js 强制：filterKey 只能是 '表区'，且必须是该面板的
 *   yj_field label —— 否则行写不回库、掉进"没有表认领"的桶）。
 * 而 rd_insp_plan_detail **没有 [表区] 物理列**（这也是本面板历史上"绝不能加页签"的原因）。
 *
 * ⇒ 本次给它补 [表区] 列 + 登记 yj_field，让两个逻辑表各占一个值：
 *      '检验项目'  = 原有 12 行检验项目（存量数据全部回填这个值）
 *      '修订记录'  = 新增的修订记录页
 *   ⚠ 存量行必须回填 '检验项目'，否则补列后它们两个筛选都不匹配 ⇒ 界面上整张检验项目表消失。
 *
 * 幂等：先判 COL_LENGTH 再 ADD；UPDATE 只动 [表区] IS NULL 的行。
 * 规范：新增列写 MS_Description 中文注明（AGENTS.md 硬要求）。
 *
 * 执行：两个账套都要跑（HSDZ_MES / HSDZ_MES_TEST）。
 */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ── ① 补物理列 ───────────────────────────────────────────────── */
IF COL_LENGTH('rd_insp_plan_detail', '表区') IS NULL
BEGIN
    ALTER TABLE rd_insp_plan_detail ADD [表区] nvarchar(60) NULL;
    PRINT '[insp-plan] rd_insp_plan_detail.表区 added';
END
ELSE PRINT '[insp-plan] rd_insp_plan_detail.表区 exists, skip';

/* ── ② 存量行回填 '检验项目'（不回填 = 补列后整张检验项目表从界面消失）──
   ⚠ 必须走 EXEC 动态 SQL：同批次里刚 ALTER TABLE ADD 的列，直接写 UPDATE 会在**编译期**报
     「Invalid column name '表区'」—— SQL Server 按批次整体编译，新列对同批次后续语句尚不可见。
     用 EXEC 让这条 UPDATE 在运行时才编译（实测直写必失败，已踩）。 */
DECLARE @sql NVARCHAR(MAX) = N'UPDATE rd_insp_plan_detail SET [表区] = @v WHERE [表区] IS NULL OR LTRIM(RTRIM([表区])) = N'''' AND ISNULL(asp_cancel,''N'') <> ''Y'';';
EXEC sp_executesql @sql, N'@v NVARCHAR(60)', @v = N'检验项目';
PRINT '[insp-plan] backfilled rows = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ── ③ MS_Description 中文注明 ─────────────────────────────────── */
IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE major_id = OBJECT_ID('rd_insp_plan_detail')
             AND minor_id = COLUMNPROPERTY(OBJECT_ID('rd_insp_plan_detail'), '表区', 'ColumnId')
             AND name = N'MS_Description')
    EXEC sp_dropextendedproperty N'MS_Description', N'SCHEMA', N'dbo', N'TABLE', N'rd_insp_plan_detail', N'COLUMN', N'表区';
EXEC sp_addextendedproperty N'MS_Description',
     N'表区：同一张行表承载多张逻辑表时的物理分块键（检验项目 / 修订记录）。见 CONTEXT「表区是物理列而非内存标记」。',
     N'SCHEMA', N'dbo', N'TABLE', N'rd_insp_plan_detail', N'COLUMN', N'表区';
PRINT '[insp-plan] MS_Description set';

/* ── ④ yj_field 登记（不登记就写不回库，filtervals 测试也会红）──────
   place='detail' + hidden=1：**列不上纸**，只作分块键（与 QC_FIRST_INSP / RD_X_SINTER 同款）。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = N'表区')
    INSERT INTO yj_field (panel_code, col_name, label, place, seq, required, editable, visible, hidden)
    VALUES (N'RD_INSP_PLAN', N'表区', N'表区', N'detail', 5, 0, 0, 1, 1);
ELSE
    UPDATE yj_field SET hidden = 1, visible = 1, place = N'detail'
    WHERE panel_code = N'RD_INSP_PLAN' AND label = N'表区';

/* ── ④b 修订记录页的 4 个字段登记 ─────────────────────────────────
   修订记录要落 4 个新数据键（更改内容/更改原因/更改时间/责任人），但 rd_insp_plan_detail 的
   业务列已排满 —— 借**备用列池**的 备用3..备用6（实测这几个 FREE：备用1/2 已被
   「是否受控/受控日期」占用）。口径与 RD_CHANGE 用 备用1 存「变更类型」同一做法。
   ⚠ 序号 / 备注 两个键本面板已有同名列，不重复建。 */
DECLARE @fld TABLE (label nvarchar(60), col nvarchar(60), seq int);
INSERT INTO @fld VALUES
    (N'更改内容', N'备用3', 150),
    (N'更改原因', N'备用4', 155),
    (N'更改时间', N'备用5', 160),
    (N'责任人',   N'备用6', 165);

INSERT INTO yj_field (panel_code, col_name, label, place, seq, required, editable, visible, hidden)
SELECT N'RD_INSP_PLAN', f.col, f.label, N'detail', f.seq, 0, 1, 1, 1
FROM @fld f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = N'RD_INSP_PLAN' AND x.label = f.label);

/* 译名（这些是新 UI 词，必须给英文） */
DECLARE @tr TABLE (k nvarchar(60), en nvarchar(60));
INSERT INTO @tr VALUES
    (N'更改内容', N'Change content'), (N'更改原因', N'Change reason'),
    (N'更改时间', N'Change date'),    (N'责任人',   N'Responsible');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.k, N'en', t.en, N'manual' FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation y WHERE y.scope = N'field' AND y.ref_key = t.k AND y.locale = N'en');

PRINT '[insp-plan] revision fields registered';

/* 译名（多语言强制规范） */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'表区' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'表区', N'en', N'Sheet area', N'manual');

/* ── ⑤ 自检 ───────────────────────────────────────────────────── */
DECLARE @noCol INT = CASE WHEN COL_LENGTH('rd_insp_plan_detail', '表区') IS NULL THEN 1 ELSE 0 END;
DECLARE @noField INT = CASE WHEN EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = N'表区') THEN 0 ELSE 1 END;
DECLARE @orphan INT = 0;
DECLARE @sql2 NVARCHAR(MAX) = N'SELECT @n = COUNT(*) FROM rd_insp_plan_detail WHERE ISNULL(asp_cancel,''N'') <> ''Y'' AND ([表区] IS NULL OR LTRIM(RTRIM([表区])) = N'''');';
EXEC sp_executesql @sql2, N'@n INT OUTPUT', @n = @orphan OUTPUT;
IF @noCol + @noField > 0
BEGIN
    RAISERROR(N'[insp-plan] 自检失败：列缺失=%d 字段缺失=%d', 16, 1, @noCol, @noField);
    RETURN;
END
IF @orphan > 0
BEGIN
    RAISERROR(N'[insp-plan] 自检失败：仍有 %d 行 表区 为空（会从界面上消失）', 16, 1, @orphan);
    RETURN;
END
DECLARE @noRevField INT = (SELECT COUNT(*) FROM (VALUES (N'更改内容'),(N'更改原因'),(N'更改时间'),(N'责任人')) AS v(l)
                           WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_INSP_PLAN' AND label = v.l));
IF @noRevField > 0
BEGIN
    RAISERROR(N'[insp-plan] 自检失败：修订记录有 %d 个字段未登记 yj_field（值会写不进库）', 16, 1, @noRevField);
    RETURN;
END
PRINT '[insp-plan] 自检通过：表区列/字段齐备、修订记录 4 字段已登记、无孤儿行。';
