/* ============================================================================
 * migrate-finish-in-produced-qty-20261124.sql
 *   产成品入库单(FINISH_IN)明细新增「生产数量」——「实收数量」= 生产数量 − 不合格数量
 *
 * 【用户口径(2026-11-24)】
 *   「当前得修改一下当前只存在实收数量作为接受报工数量的存在,这个不应该是实收数量,应该存在一个
 *    生产数量作为接受报工数量的存在,然后实收数量是根据生产数量减去不合格数量自动算出的。」
 *   ⇒ 明细多一列 `生产数量`(接受报工的数量);`实收数量` 由后端在保存/生成时按
 *     max(0, 生产数量 − 不合格数量) 重算(代码在 ButtonService.saveDoc / ensureFinishInDrafts,
 *     本脚本只落列 + 字段 + 译名,并把历史行补齐)。
 *
 * 【本脚本(纯增量、幂等、两账套可重复执行)】
 *   §0 前置自检:面板 FINISH_IN 与表 bl_finish_in 必须在;
 *   §1 bl_finish_in +[生产数量] decimal(18,4) NULL(列级 MS_Description);
 *   §2 历史行回填:生产数量 = 实收数量 + ISNULL(不合格数量,0)(只在 生产数量 为空时填,可重复执行);
 *   §3 yj_field 登记 FINISH_IN/detail/[生产数量]:小数、seq 89(紧跟 单价 80、在 实收数量 90 之前)、
 *      可编辑、非必填、可见;
 *   §4 yj_translation(scope='field')补 10 语种;
 *   §5 自检:列在 / 注明在 / 字段恰好 1 行且属性正确 / 译名 ≥ 10 语种。
 *
 * ⚠ 不改 yj_panel;不动实收数量既有值(除 §2 的历史回填不涉及实收);库存与转ERP 仍按「实收数量」。
 * ============================================================================ */

/* ---------- §0 前置 ---------- */
IF OBJECT_ID(N'dbo.bl_finish_in', N'U') IS NULL
    RAISERROR(N'[FAIL] 缺 dbo.bl_finish_in,本脚本无法继续', 16, 1);
IF (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = N'FINISH_IN') <> 1
    RAISERROR(N'[FAIL] yj_panel 缺 FINISH_IN 或重复', 16, 1);
GO

/* ---------- §1 加列 ---------- */
IF COL_LENGTH(N'dbo.bl_finish_in', N'生产数量') IS NULL
BEGIN
    ALTER TABLE dbo.bl_finish_in ADD [生产数量] decimal(18,4) NULL;
    PRINT N'  [ADD] bl_finish_in.生产数量 decimal(18,4) NULL';
END
ELSE PRINT N'  [SKIP] bl_finish_in.生产数量 已存在';
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'生产数量', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'生产数量(接受报工的数量;2026-11-24 用户口径。实收数量 = 生产数量 − 不合格数量,由后端保存/生成时自动重算;金蝶同步/历史行可空)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'生产数量';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'生产数量(接受报工的数量;2026-11-24 用户口径。实收数量 = 生产数量 − 不合格数量,由后端保存/生成时自动重算;金蝶同步/历史行可空)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'生产数量';
PRINT N'  [OK] 列注明已写';
GO

/* ---------- §2 历史回填(只填空值) ---------- */
DECLARE @filled int = 0;
UPDATE dbo.bl_finish_in
   SET [生产数量] = ISNULL([实收数量],0) + ISNULL([不合格数量],0)
 WHERE [生产数量] IS NULL;
SET @filled = @@ROWCOUNT;
PRINT N'  [BACKFILL] 生产数量 = 实收数量 + 不合格数量,回填 ' + CAST(@filled AS nvarchar(10)) + N' 行';
GO

/* ---------- §3 yj_field 登记(detail;seq 89 在 实收数量 90 之前) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'生产数量')
BEGIN
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                              display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (N'FINISH_IN', N'生产数量', N'生产数量', N'小数', NULL, NULL, NULL,
            NULL, N'detail', 89, 110, 1, 0, 0, 1);
    PRINT N'  [INSERT] yj_field FINISH_IN/生产数量(detail/seq 89/可编辑)';
END
ELSE
BEGIN
    UPDATE dbo.yj_field
       SET col_name = N'生产数量', data_type = N'小数', place = N'detail', seq = 89, width = 110,
           editable = 1, required = 0, hidden = 0, visible = 1
     WHERE panel_code = N'FINISH_IN' AND label = N'生产数量';
    PRINT N'  [SKIP] yj_field FINISH_IN/生产数量 已存在(属性已校准)';
END
GO

/* ---------- §4 译名(10 语种) ---------- */
DECLARE @loc nvarchar(20), @txt nvarchar(100);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES ('en', N'Produced Qty'), ('zh-TW', N'生產數量'), ('ja', N'生産数量'),
                          ('ko', N'생산 수량'), ('es', N'Cantidad producida'), ('de', N'Produktionsmenge'),
                          ('fr', N'Qté produite'), ('ru', N'Кол-во производства'), ('vi', N'SL sản xuất'),
                          ('th', N'จำนวนผลิต')) v(l, t);
OPEN cur;
FETCH NEXT FROM cur INTO @loc, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = N'生产数量' AND locale = @loc)
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
        VALUES (N'field', N'生产数量', @loc, @txt, N'manual');
    FETCH NEXT FROM cur INTO @loc, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'  [OK] 译名已补(10 语种)';
GO

/* ---------- §5 自检 ---------- */
IF COL_LENGTH(N'dbo.bl_finish_in', N'生产数量') IS NULL
    RAISERROR(N'[FAIL] bl_finish_in.生产数量 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'生产数量', 'ColumnId')
                  AND name = N'MS_Description')
    RAISERROR(N'[FAIL] bl_finish_in.生产数量 缺列级 MS_Description', 16, 1);
IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'生产数量') <> 1
    RAISERROR(N'[FAIL] yj_field FINISH_IN/生产数量 不是 1 行', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'生产数量'
            AND (col_name <> N'生产数量' OR data_type <> N'小数' OR place <> N'detail'
                 OR seq <> 89 OR editable <> 1 OR required <> 0 OR hidden <> 0 OR visible <> 1))
    RAISERROR(N'[FAIL] yj_field FINISH_IN/生产数量 属性不符(小数/detail/seq89/可编辑非必填可见)', 16, 1);
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key = N'生产数量'
       AND locale IN (N'en',N'zh-TW',N'ja',N'ko',N'es',N'de',N'fr',N'ru',N'vi',N'th')) < 10
    RAISERROR(N'[FAIL] 生产数量 译名不足 10 语种', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.bl_finish_in WHERE [生产数量] IS NULL)
    PRINT N'  [WARN] 仍有 生产数量 为空的历史行(保存/生成时会重算,展示可空)';
PRINT N'[PASS] 自检通过:bl_finish_in.生产数量 + 列注明 + yj_field(FINISH_IN/detail/seq89)+ 10 语种译名';
GO
