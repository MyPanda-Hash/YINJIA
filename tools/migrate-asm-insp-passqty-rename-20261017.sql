/* migrate-asm-insp-passqty-rename-20261017.sql(2026-10-17)
 * 组装成品检验单(QC_ASM_INSP)表头字段「合格数量（入库）」**正名为「合格数量」**
 *
 * 【用户口径(2026-10-17,接 migrate-asm-insp-passqty-in-20261017.sql 的下一句)】
 *   「将当前组装成品检验的合格数量（入库）修改为合格数量,并且让当前审核完成的单据能够自动生成
 *     产成品入库单其中根据合格数量填入到产成品入库单中。」
 *   ⇒ 字段名去掉「（入库）」的限定(它本来就在"组装**成品**检验 → **产成品**入库"这条链上,单头再挂
 *     "入库"是冗余);入库时机/取值口径**一个字都不改** —— 仍是「审核(或审批通过)时才按表头这个数
 *     生成产成品入库单草稿」(见 ButtonService.asmInspToStock + AsmInspStockQty)。
 *
 * 【改哪三处(数据键永远中文,不随语言变化 —— ADR-0001,这是业务改名不是翻译)】
 *   ① 物理列  qc_asm_insp_head.[合格数量（入库）] → [合格数量](sp_rename;decimal(18,4) 与列级注明不变);
 *   ② 元数据  yj_field.col_name + label(QC_ASM_INSP,表头/小数/seq135/必填/可见可填 —— 其余属性不动);
 *   ③ 译名    yj_translation.scope='field' ref_key「合格数量（入库）」→「合格数量」:
 *             「合格数量」是与 QC_INSP / DAY_REPORT 同名的**共享标签**(按标签全局共享译名),
 *             故 en 沿用既有的「Pass Qty」,其余 9 语言按原译名去掉「(入库)」限定后补齐,再删旧 key。
 *
 * 【影响面取证(两账套实测,改名前)】无视图/存储过程/函数引用该列(sys.sql_modules 命中 0);
 *   yj_field 无任何 ref_field='合格数量（入库）' 的参照源、无 ref_panel='QC_ASM_INSP' 的跨面板参照;
 *   yj_report_template / yj_panel.config 命中 0;故本次改名是"列名 + 登记名 + 译名"三处一致改,无第四处。
 *
 * 【幂等】改名带存在性守卫;若历史脚本被重放又把旧列建回来(旧新并存)⇒ 先并值(仅补空)再删旧列,不丢数据;
 *   末尾自检:旧列/旧登记/旧译名必须全部消失,新列/新登记/10 语言译名/注明齐全 + 行数与已填行数守恒。
 *   两账套(先正式后测试)均执行。
 */

SET NOCOUNT ON;

/* ══════════════════ A. 基线(行数 + 已填行数;旧列已不存在时只能用行数) ══════════════════ */
IF OBJECT_ID('tempdb..#asmren') IS NOT NULL DROP TABLE #asmren;
CREATE TABLE #asmren (rows_before int, filled_before int NULL);
INSERT INTO #asmren (rows_before, filled_before) SELECT COUNT(*), NULL FROM dbo.qc_asm_insp_head;
/* ⚠ 引用旧列的语句必须走动态 SQL:批是**整体编译**的,列若已不存在,静态语句连编译都过不了 */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NOT NULL
  EXEC(N'UPDATE #asmren SET filled_before = (SELECT SUM(CASE WHEN [合格数量（入库）] IS NOT NULL THEN 1 ELSE 0 END)'
     + N' FROM dbo.qc_asm_insp_head);');
GO

/* ══════════════════ B. 物理列改名 ══════════════════ */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量') IS NULL
BEGIN
  EXEC sp_rename N'dbo.qc_asm_insp_head.合格数量（入库）', N'合格数量', N'COLUMN';
  PRINT N'[OK] 物理列改名:合格数量（入库）→ 合格数量';
END
ELSE IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量') IS NOT NULL
        AND COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NULL
  PRINT N'[SKIP] 物理列已是 合格数量';
ELSE IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量') IS NULL
        AND COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NULL
  PRINT N'[WARN] 两列都不存在(加列脚本没跑过?)—— 自检会拦下';
ELSE
BEGIN
  /* 新旧并存(历史脚本重放把旧列又建回来):并值只补空,再删旧列 —— 不丢数据、不报错中断整条链 */
  EXEC(N'UPDATE dbo.qc_asm_insp_head SET [合格数量] = [合格数量（入库）]'
     + N' WHERE [合格数量] IS NULL AND [合格数量（入库）] IS NOT NULL;');
  EXEC(N'ALTER TABLE dbo.qc_asm_insp_head DROP COLUMN [合格数量（入库）];');
  PRINT N'[WARN] 旧列被历史脚本重放建回:已并值(仅补空)并删除旧列';
END
GO

/* ══════════════════ C. 列级中文注明(随列改名重写文字) ══════════════════
   ⚠ sp_*extendedproperty 的参数必须是字面量/变量(不能写表达式),故先拼进变量再 EXEC。 */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量') IS NOT NULL
BEGIN
  DECLARE @cmt nvarchar(400) = N'合格数量(本单最终要进成品库的合格品数量:组装成品检验单**审核/审批通过**时'
    + N'按它生成产成品入库单草稿的实收数量 —— 0 不生成、空则拒绝审核;由品质在单头填写,必填。'
    + N'2026-10-17 新增(原字段名「合格数量（入库）」,同日按用户要求正名为「合格数量」);'
    + N'此前合格数由 检验数量−Σ不合格数量 派生)';
  IF EXISTS (SELECT 1 FROM sys.extended_properties
              WHERE major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
                AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'合格数量', 'ColumnId')
                AND name = N'MS_Description' AND class = 1)
    EXEC sp_updateextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', @cmt, N'SCHEMA', N'dbo', N'TABLE', N'qc_asm_insp_head', N'COLUMN', N'合格数量';
  PRINT N'[OK] 列级注明已重写为「合格数量」口径';
END
ELSE PRINT N'[SKIP] 新列不存在,注明跳过(自检会拦)';
GO

/* ══════════════════ D. yj_field 登记改名 ══════════════════ */
/* D1. 已有新名登记(理论不可能)⇒ 删旧名行,保留新名行;否则把旧名行改名 */
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量')
  DELETE FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）';
ELSE IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）')
  UPDATE yj_field SET col_name = N'合格数量', label = N'合格数量'
   WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量（入库）';
PRINT N'[OK] yj_field 旧名行已处理(改名/清理)';
GO
/* D2. 兜底建行(与 migrate-asm-insp-passqty-in-20261017.sql 同款) */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
  VALUES (N'QC_ASM_INSP', N'合格数量', N'合格数量', N'小数', N'header', 135, 110, 1, 1, 0, 1);
GO
/* D3. 统一再断言属性(改名不该动其它属性;width 保留原值) */
UPDATE yj_field SET label = N'合格数量', data_type = N'小数', place = N'header',
       seq = 135, editable = 1, required = 1, hidden = 0, visible = 1
 WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量';
PRINT N'[OK] yj_field 就绪:合格数量(表头/小数/seq135/必填/可见可填)';
GO

/* ══════════════════ E. 译名:旧 key → 共享标签「合格数量」 ══════════════════
   「合格数量」已存在(en=Pass Qty,QC_INSP/DAY_REPORT 在用)⇒ NOT EXISTS 只补缺,不覆盖既有译名。 */
DECLARE @tr TABLE (locale varchar(10), text nvarchar(200));
INSERT INTO @tr VALUES
 ('en', N'Pass Qty'),
 ('ja', N'合格数量'),
 ('ko', N'합격 수량'),
 ('de', N'Gutmenge'),
 ('fr', N'Quantité conforme'),
 ('es', N'Cantidad conforme'),
 ('ru', N'Годное количество'),
 ('th', N'จำนวนที่ผ่าน'),
 ('vi', N'Số lượng đạt'),
 ('zh-TW', N'合格數量');
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', N'合格数量', t.locale, t.text, N'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                   WHERE x.scope = N'field' AND x.ref_key = N'合格数量' AND x.locale = t.locale);
PRINT N'[OK] 译名补齐行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
/* 旧 key 全 scope 清掉(改名后没有任何对象再用它) */
DELETE FROM yj_translation WHERE ref_key = N'合格数量（入库）';
PRINT N'[OK] 旧译名 key 已清理行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));
GO

/* ══════════════════ F. 自检 ══════════════════ */
DECLARE @bad int = 0, @r int, @fb int, @fa int;
/* F1. 旧列必须消失、新列必须在且类型不变(decimal(18,4)) */
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量（入库）') IS NOT NULL SET @bad = @bad + 1;
IF COL_LENGTH(N'dbo.qc_asm_insp_head', N'合格数量') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND c.name = N'合格数量'
                  AND t.name = N'decimal' AND c.precision = 18 AND c.scale = 4) SET @bad = @bad + 1;
/* F2. yj_field:恰一行(表头/小数/seq135/必填/可见可填),且全库再无旧名登记 */
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND col_name = N'合格数量'
      AND label = N'合格数量' AND data_type = N'小数' AND place = N'header' AND seq = 135
      AND required = 1 AND visible = 1 AND hidden = 0 AND editable = 1) <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field WHERE col_name = N'合格数量（入库）' OR label = N'合格数量（入库）') SET @bad = @bad + 1;
/* F3. 译名:新 key ≥10 语言;旧 key 绝迹 */
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = N'field' AND ref_key = N'合格数量') < 10 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE ref_key = N'合格数量（入库）') SET @bad = @bad + 1;
/* F4. 列级注明挂在**新列**上 */
IF (SELECT COUNT(*) FROM sys.extended_properties ep
     WHERE ep.major_id = OBJECT_ID(N'dbo.qc_asm_insp_head')
       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'), N'合格数量', 'ColumnId')
       AND ep.name = N'MS_Description') = 0 SET @bad = @bad + 1;
/* F5. 守恒:行数不变;改名前后"已填行数"也不变(旧列存在时才有基线) */
SELECT @r = rows_before, @fb = filled_before FROM #asmren;
IF (SELECT COUNT(*) FROM dbo.qc_asm_insp_head) <> @r SET @bad = @bad + 1;
IF @fb IS NOT NULL
BEGIN
  SELECT @fa = SUM(CASE WHEN [合格数量] IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_head;
  IF ISNULL(@fa, 0) <> @fb SET @bad = @bad + 1;
END

IF @bad > 0 RAISERROR(N'组装成品检验单表头「合格数量」改名自检失败(物理列/字段登记/译名/注明/守恒)', 16, 1);
ELSE PRINT N'组装成品检验单表头就绪:「合格数量」(原「合格数量（入库）」)decimal(18,4) + yj_field(表头/seq135/必填)'
         + N' + 10 语言译名;入库时机不变 = 审核/审批通过(asmInspToStock),弃审作废该草稿';
GO
