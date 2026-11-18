/* ============================================================================
 * migrate-finish-in-failqty-20261118.sql
 *   产成品入库单(FINISH_IN)明细行新增「不合格数量」+ 与「是否过程检验」配套的门禁豁免
 *
 * 【用户口径(2026-11-18)】
 *   ① 「产成品入库单必须关联「出货检验功能单号」和「出货检验表观单号」后才能提交审批/审核……
 *      这个得修改这个,当前物料如果没有选择是否过程检验就不强制这个实现了。」
 *       ⇒ 门禁本身改成"按商品档案 是否过程检验 判":没勾 = 是 的入库单不再强制两张检验单。
 *          **本脚本不动门禁代码**(代码在 ButtonService.assertFinishInInspLink /
 *          finishInNeedsInsp),只保证判据列 `bs_inv.是否过程检验` 在两账套都在(该列由
 *          migrate-inv-process-inspection-20261114.sql 建;本脚本 §0 只做存在性自检,不重复建)。
 *   ② 「当前的产成品入库要能填不合格数量在这里」(截图红框 = 产成品入库单明细表格)
 *       ⇒ bl_finish_in 加列 `不合格数量` decimal(18,4) NULL + 明细字段登记 + 译名。
 *          口径(追问确认):**只记录/展示**,库存与转ERP 仍按「实收数量」,不自动扣减;
 *          本列不参与库存流水(StockLedgerService/FINISH_IN 段只取 实收数量)与工单回写。
 *
 * 【本脚本(纯增量、幂等、两账套可重复执行)】
 *   §0 前置自检:bs_inv.是否过程检验 必须在(缺了只提示,不中止 —— 老库补链时会先跑 1114 那条);
 *   §1 bl_finish_in +[不合格数量] decimal(18,4) NULL(列级 MS_Description);
 *   §2 yj_field 登记 FINISH_IN/detail/[不合格数量]:小数、seq 91(紧跟 实收数量 90、在 库存数量 92 之前)、
 *      可编辑、非必填、可见;
 *   §3 yj_translation(scope='field')补 ja/ko/zh-TW/es/de/fr/ru/vi/th 九个语种(en 已存在,跳过);
 *   §4 自检:列在 / 注明在 / 字段恰好 1 行且属性正确 / 译名 ≥ 10 语种。
 *
 * ⚠ 不改任何既有单据数据、不改 yj_panel、不动库存与转ERP 取数。
 * ============================================================================ */

/* ---------- §0 前置:门禁判据列(只提示,不建) ---------- */
IF COL_LENGTH(N'dbo.bs_inv', N'是否过程检验') IS NULL
    PRINT N'  [WARN] bs_inv.是否过程检验 不存在 —— 门禁豁免会退回原行为(仍强制两张检验单)。请先执行 migrate-inv-process-inspection-20261114.sql';
ELSE PRINT N'  [OK] bs_inv.是否过程检验 已存在(门禁豁免判据就绪)';
GO

/* ---------- §1 加列 ---------- */
IF COL_LENGTH(N'dbo.bl_finish_in', N'不合格数量') IS NULL
BEGIN
    ALTER TABLE dbo.bl_finish_in ADD [不合格数量] decimal(18,4) NULL;
    PRINT N'  [ADD] bl_finish_in.不合格数量 decimal(18,4) NULL';
END
ELSE PRINT N'  [SKIP] bl_finish_in.不合格数量 已存在';
GO

/* ---------- §1b 列注明 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'不合格数量', 'ColumnId')
                  AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'不合格数量(本行实收数量中的不合格数量;2026-11-18 用户口径:仓库在此登记不合格数,**只记录/展示,不扣减库存** —— 库存流水与转ERP 仍按「实收数量」;可空)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'不合格数量';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
        N'不合格数量(本行实收数量中的不合格数量;2026-11-18 用户口径:仓库在此登记不合格数,**只记录/展示,不扣减库存** —— 库存流水与转ERP 仍按「实收数量」;可空)',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_finish_in', N'COLUMN', N'不合格数量';
PRINT N'  [OK] 列注明已写';
GO

/* ---------- §2 yj_field 登记(detail;seq 91 紧跟 实收数量 90) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'不合格数量')
BEGIN
    INSERT INTO dbo.yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                              display_field, place, seq, width, editable, required, hidden, visible)
    VALUES (N'FINISH_IN', N'不合格数量', N'不合格数量', N'小数', NULL, NULL, NULL,
            NULL, N'detail', 91, 110, 1, 0, 0, 1);
    PRINT N'  [INSERT] yj_field FINISH_IN/不合格数量(detail/seq 91/可编辑)';
END
ELSE
BEGIN
    UPDATE dbo.yj_field
       SET col_name = N'不合格数量', data_type = N'小数', place = N'detail', seq = 91, width = 110,
           editable = 1, required = 0, hidden = 0, visible = 1
     WHERE panel_code = N'FINISH_IN' AND label = N'不合格数量';
    PRINT N'  [SKIP] yj_field FINISH_IN/不合格数量 已存在(属性已校准)';
END
GO

/* ---------- §3 译名(9 语种;en 由 2026-10-15 那条检验明细迁移已落 'Fail Qty') ---------- */
DECLARE @loc nvarchar(20), @txt nvarchar(100);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT * FROM (VALUES ('ja', N'不合格数量'), ('ko', N'불량 수량'), ('zh-TW', N'不合格數量'),
                          ('es', N'Cantidad no conforme'), ('de', N'Fehlmenge'), ('fr', N'Qté non conforme'),
                          ('ru', N'Кол-во брака'), ('vi', N'SL không đạt'), ('th', N'จำนวนไม่ผ่าน')) v(l, t);
OPEN cur;
FETCH NEXT FROM cur INTO @loc, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = N'field' AND ref_key = N'不合格数量' AND locale = @loc)
        INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
        VALUES (N'field', N'不合格数量', @loc, @txt, N'manual');
    FETCH NEXT FROM cur INTO @loc, @txt;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'  [OK] 译名已补(9 语种;en 已存在)';
GO

/* ---------- §4 自检 ---------- */
IF COL_LENGTH(N'dbo.bl_finish_in', N'不合格数量') IS NULL
    RAISERROR(N'[FAIL] bl_finish_in.不合格数量 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.bl_finish_in')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_finish_in'), N'不合格数量', 'ColumnId')
                  AND name = N'MS_Description')
    RAISERROR(N'[FAIL] bl_finish_in.不合格数量 缺列级 MS_Description', 16, 1);
IF (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'不合格数量') <> 1
    RAISERROR(N'[FAIL] yj_field FINISH_IN/不合格数量 不是 1 行', 16, 1);
IF EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'FINISH_IN' AND label = N'不合格数量'
            AND (col_name <> N'不合格数量' OR data_type <> N'小数' OR place <> N'detail'
                 OR seq <> 91 OR editable <> 1 OR required <> 0 OR hidden <> 0 OR visible <> 1))
    RAISERROR(N'[FAIL] yj_field FINISH_IN/不合格数量 属性不符(小数/detail/seq91/可编辑非必填可见)', 16, 1);
IF (SELECT COUNT(DISTINCT locale) FROM dbo.yj_translation
     WHERE scope = N'field' AND ref_key = N'不合格数量'
       AND locale IN (N'en',N'ja',N'ko',N'zh-TW',N'es',N'de',N'fr',N'ru',N'vi',N'th')) < 10
    RAISERROR(N'[FAIL] 不合格数量 译名不足 10 语种', 16, 1);
PRINT N'[PASS] 自检通过:bl_finish_in.不合格数量(decimal(18,4) NULL)+ 列注明 + yj_field(FINISH_IN/detail/seq91/可编辑非必填)+ 10 语种译名';
GO
