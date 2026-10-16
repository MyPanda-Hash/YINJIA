/* migrate-asm-insp-passqty-in-20261017.sql(2026-10-17)
 * 组装成品检验单(QC_ASM_INSP)表头新增「合格数量（入库）」:**必填**,审核(或审批通过)后按它生成产成品入库单
 *
 * 【用户口径(2026-10-17)】
 *   「为当前的表头增加合格数量(入库)的字段,设定为必填。让当前审核完成后才对这些数量产生到产成品入库单内。」
 *
 * 【为什么要单独一列(而不是继续派生)】
 *   旧口径的合格数是**派生值** = 表头检验数量 − Σ明细不合格数量(见 v3.24 之前的 asmInspToStock);
 *   用户现在要的是「品质在单头明确报出这一单有多少合格品要进成品库」,并以它作为产成品入库单数量的
 *   **唯一来源** —— 派生值在"检验数量没填 / 只检了一部分"时算不出人要的那个数,也没法在单上复核。
 *
 * 【落点】
 *   ① 物理列 `qc_asm_insp_head.[合格数量（入库）]` decimal(18,4) NULL(与 报工数量/检验数量/抽检总量 同型);
 *   ② `yj_field` 登记:place=header / data_type=小数 / **seq 135**(两账套该号都空:130 检验数量、140 检验员)
 *      / **required=1(必填)** / visible=1、hidden=0、editable=1;
 *   ③ 列级中文注明 + **10 语言译名**(新标签,按多语言强制规范必须自带译名);
 *   ④ 取值与入库时机见后端 `ButtonService.asmInspToStock` + `AsmInspStockQty`:
 *      **审核(或审批通过)时**才读本列 —— >0 生成**产成品入库单草稿**(FINISH_IN,留草稿由仓库审核),
 *      =0 不生成;本列为空 ⇒ 直接拒绝审核(必填在"真正消费它的那一刻"再兜一道);
 *      弃审时把这张自动生成的入库单草稿作废并释放占用(已审核则挡弃审,先弃审入库单)。
 *
 * 【数据安全】只加列,不动任何既有行的值;末尾比对本表行数守恒。
 * 【幂等】加列/注明/字段登记/译名全部带存在性守卫;两账套(先正式后测试)均执行。
 */

SET NOCOUNT ON;

/* ══════════════════ A. 基线(数据守恒比对) ══════════════════ */
IF OBJECT_ID('tempdb..#asmpass') IS NOT NULL DROP TABLE #asmpass;
CREATE TABLE #asmpass (rows_before int);
INSERT INTO #asmpass (rows_before) SELECT COUNT(*) FROM dbo.qc_asm_insp_head;
GO

/* ══════════════════ B. 物理列 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NULL
BEGIN
  ALTER TABLE dbo.qc_asm_insp_head ADD [合格数量（入库）] decimal(18,4) NULL;
  PRINT N'[OK] qc_asm_insp_head +1 列:合格数量（入库） decimal(18,4)';
END
ELSE PRINT N'[SKIP] 合格数量（入库） 列已存在';
GO

/* ══════════════════ C. 列级中文注明 ══════════════════
   ⚠ sp_addextendedproperty/sp_updateextendedproperty 的参数必须是字面量或变量(不能写表达式),
     故先把长注释拼进变量再 EXEC。 */
DECLARE @cmt nvarchar(400) = N'合格数量（入库）(本单最终要进成品库的合格品数量:组装成品检验单**审核/审批通过**时'
  + N'按它生成产成品入库单草稿的实收数量 —— 0 不生成、空则拒绝审核;由品质在单头填写,必填。'
  + N'2026-10-17 新增:此前合格数由 检验数量−Σ不合格数量 派生)';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'合格数量（入库）', 'ColumnId')
                  AND name = N'MS_Description' AND class = 1)
  EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量（入库）';
ELSE
  EXEC sp_updateextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量（入库）';
PRINT N'[OK] 列级注明已写入';
GO

/* ══════════════════ D. yj_field 登记(表头 / 必填) ══════════════════ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'合格数量（入库）', N'合格数量（入库）', N'小数', N'header', 135, 110, 1, 1, 0, 1);
ELSE
  UPDATE yj_field SET label = N'合格数量（入库）', data_type = N'小数', place = N'header',
         seq = 135, editable = 1, required = 1, hidden = 0, visible = 1
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）';
PRINT N'[OK] yj_field 就绪(表头/小数/seq135/必填/可见可填)';
GO

/* ══════════════════ E. 译名(新标签 ⇒ 10 语言;按标签全局共享,插前判重) ══════════════════ */
DECLARE @tr TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @tr VALUES
 ('en', N'Passed Qty (Inbound)'),
 ('ja', N'合格数量（入庫）'),
 ('ko', N'합격 수량(입고)'),
 ('de', N'Gutmenge (Einlagerung)'),
 ('fr', N'Quantité conforme (entrée)'),
 ('es', N'Cantidad conforme (entrada)'),
 ('ru', N'Годное количество (приход)'),
 ('th', N'จำนวนที่ผ่าน (รับเข้า)'),
 ('vi', N'Số lượng đạt (nhập kho)'),
 ('zh-TW', N'合格數量（入庫）');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'合格数量（入库）', t.locale, t.text, N'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                   WHERE x.scope = N'field' AND x.ref_key = N'合格数量（入库）' AND x.locale = t.locale);
PRINT N'[OK] 译名补齐行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ F. 自检 ══════════════════ */
DECLARE @bad int = 0, @r int;
/* F1. 物理列在,且是 decimal(18,4) */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND c.name = N'合格数量（入库）'
                  AND t.name = N'decimal' AND c.precision = 18 AND c.scale = 4) SET @bad = @bad + 1;
/* F2. yj_field:恰一行(表头/小数/seq135/必填/可见可填) */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）'
      AND label = N'合格数量（入库）' AND data_type = N'小数' AND place = N'header' AND seq = 135
      AND required = 1 AND visible = 1 AND hidden = 0 AND editable = 1) <> 1 SET @bad = @bad + 1;
/* F3. 只写本面板(别的面板不得出现同名字段) */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code <> N'QC_ASM_INSP' AND col_name = N'合格数量（入库）') SET @bad = @bad + 1;
/* F4. 译名 10 语言齐全 */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'合格数量（入库）') < 10 SET @bad = @bad + 1;
/* F5. 列级注明 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'合格数量（入库）', 'ColumnId')
       AND ep.name = N'MS_Description') = 0 SET @bad = @bad + 1;
/* F6. 数据守恒:本表行数不变(只加列) */
SELECT @r = rows_before FROM #asmpass;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_head) <> @r SET @bad = @bad + 1;

IF @bad > 0 RAISERROR(N'组装成品检验单「合格数量（入库）」加列自检失败(物理列/字段/译名/注明/数据守恒)', 16, 1);
ELSE PRINT N'组装成品检验单表头就绪:「合格数量（入库）」decimal(18,4) + yj_field(表头/seq135/必填) + 10 语言译名;'
         + N'入库时机 = 审核/审批通过(asmInspToStock),弃审作废该草稿';
GO
