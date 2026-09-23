/* ============================================================================
 * 采购入库单明细加「特采」标记(判定来料检验单过来的数据是否特采)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-09-23):
 *   「采购入库单的明细表缺少一个特采字段,来判定来料检验单过来的数据是否是特采的。」
 *
 * 现状(实测 2026-09-23):
 *   · 来料检验单明细有「特采」开关(qc_insp_detail.特采 bit,2026-09-22 特采闸门);
 *   · 勾了特采的检验行**不直接**生成采购入库单 —— 先逐行生成特采单(QC_TC_IN),
 *     特采单「审核=审批通过」时由 ButtonService.tcInApprovedGenerate 生成整行(合格+不合格)
 *     的采购入库单;
 *   · 采购入库单明细 bl_purchase_in 只有「是否来料检验」(是/否),**没有特采标记** ——
 *     仓库看到一张入库单,无法判断它是不是特采单审批后落下来的(只能反查链路台账)。
 *
 * 本脚本(幂等):
 *   ① bl_purchase_in 加 [特采] nvarchar(10) NULL + MS_Description 中文注明;
 *   ② 存量回填:该入库单在链路台账 form_flow_link 里有 QC_TC_IN→PURCHASE_IN 占用的 → 是;
 *      其余 → 否(仅填空值,不覆盖已有值;用「任意 link_status」= 只要**曾**由特采单生成过就算,
 *      与该单作废/弃审后仍保留来源痕迹的口径一致);
 *   ③ yj_field 登记:PURCHASE_IN 明细「特采」(下拉 是/否,seq 165,紧跟 是否来料检验(160)
 *      之后、来源行号(170) 之前;**editable=0 只读** —— 值由生单路径写入,不允许人工改,
 *      与同表的「是否来料检验」同口径);
 *   ④ 译名:field「特采」×10 语言(与 QC_INSP 同标签共享译名,已有则不重复插);
 *   ⑤ 自检。
 *
 * 配套代码(同提交)—— 与「是否来料检验」同源:值一律**取来源检验行的「特采」开关**带下,不硬写:
 *   · ButtonService.tcInApprovedGenerate    —— 特采单审核 → 采购入库单,行写 特采(=来源检验行特采,恒是);
 *   · ButtonService.inspAutoPurchaseIn      —— 检验单审核(非特采行)→ 采购入库单,行写 特采(=来源行,恒否);
 *   · PushGenerateHandler.applySourceFlags  —— 选单/推式/分批路径按来源行判定(特采行已被特采闸门排除 → 恒否)。
 * 注:采购入库单**不做**特采头字段(用户口径只要明细表);转 ERP 时特采单的处理口径另议(D2)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 明细列:特采 ---------- */
IF COL_LENGTH('dbo.bl_purchase_in', N'特采') IS NULL
    ALTER TABLE dbo.bl_purchase_in ADD [特采] nvarchar(10) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'特采', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'特采:是=本行由特采单(QC_TC_IN)审批通过后生成 —— 即来料检验判定为特采(让步接收)的物料,全部数量入库;否=普通来料检验合格入库或免检直达。来源:检验单明细「特采」开关经 特采单 闸门带下,生单时写入,只读',
        N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'特采';
GO

/* ---------- ② 存量回填(按链路台账来源) ---------- */
UPDATE p
   SET p.[特采] = CASE WHEN EXISTS (
         SELECT 1 FROM form_flow_link l
          WHERE l.source_panel_code = 'QC_TC_IN' AND l.target_panel_code = 'PURCHASE_IN'
            AND l.target_form_no = p.[单据编号]) THEN N'是' ELSE N'否' END
  FROM bl_purchase_in p
 WHERE ISNULL(p.[特采], N'') = N'';
PRINT N'采购入库行「特采」回填: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ---------- ③ yj_field 登记(明细,只读,下拉 是/否) ---------- */
/* data_type 必须是「下拉框」(不是「下拉」):前端只认 '下拉框'/'参照' 渲染 el-select,
   写「下拉」会退化成普通文本框 —— 与同表 是否来料检验 对齐。 */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'特采')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, width, editable, required, hidden, visible)
    VALUES ('PURCHASE_IN', N'特采', N'特采', N'下拉框', N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)',
            N'detail', 165, 90, 0, 0, 0, 1);
-- 已登记但参数不全(重跑/人工改过)时归位,保证「只读 + 有选项」与 是否来料检验 同口径
UPDATE yj_field
   SET data_type = N'下拉框',
       dict_sql  = N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)',
       place = N'detail', seq = 165, width = 90, editable = 0, required = 0, hidden = 0, visible = 1
 WHERE panel_code = 'PURCHASE_IN' AND col_name = N'特采';
GO

/* ---------- ④ 译名:特采 ×10(与 QC_INSP 同标签;已有则跳过) ---------- */
DECLARE @tr TABLE (loc NVARCHAR(5), txt NVARCHAR(200));
INSERT INTO @tr VALUES
 (N'en',    N'Special acceptance'),
 (N'ja',    N'特別採用'),
 (N'ko',    N'특채'),
 (N'zh-TW', N'特採'),
 (N'es',    N'Aceptación especial'),
 (N'fr',    N'Acceptation particulière'),
 (N'de',    N'Sonderabnahme'),
 (N'ru',    N'Особый приём'),
 (N'vi',    N'Chấp nhận đặc biệt'),
 (N'th',    N'การรับพิเศษ');
MERGE yj_translation AS t
USING (SELECT N'特采' AS k, loc, txt FROM @tr) AS s(k, loc, txt)
ON t.scope = 'field' AND t.ref_key = s.k AND t.locale = s.loc
WHEN NOT MATCHED THEN INSERT (scope, ref_key, locale, text, source) VALUES ('field', s.k, s.loc, s.txt, 'manual');
GO

/* ---------- ⑤ 自检 ---------- */
IF COL_LENGTH('dbo.bl_purchase_in', N'特采') IS NULL RAISERROR(N'bl_purchase_in.特采 未建', 16, 1);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'特采', 'ColumnId')
                 AND name = 'MS_Description')
    RAISERROR(N'bl_purchase_in.特采 缺中文注明', 16, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name = N'特采'
               AND data_type = N'下拉框' AND dict_sql LIKE N'%是%否%' AND editable = 0 AND hidden = 0 AND visible = 1)
    RAISERROR(N'PURCHASE_IN 明细「特采」未按只读下拉框登记', 16, 1);
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'特采') < 10
    RAISERROR(N'「特采」译名不足 10 语言', 16, 1);

DECLARE @left INT = (SELECT COUNT(*) FROM bl_purchase_in WHERE ISNULL([特采], N'') = N'');
DECLARE @yes  INT = (SELECT COUNT(*) FROM bl_purchase_in WHERE [特采] = N'是');
DECLARE @no   INT = (SELECT COUNT(*) FROM bl_purchase_in WHERE [特采] = N'否');
DECLARE @tcLink INT = (SELECT COUNT(DISTINCT target_form_no) FROM form_flow_link
                        WHERE source_panel_code = 'QC_TC_IN' AND target_panel_code = 'PURCHASE_IN');
PRINT N'采购入库行:特采=是 ' + CAST(@yes AS nvarchar(10)) + N' 行 / 否 ' + CAST(@no AS nvarchar(10))
      + N' 行 / 仍空 ' + CAST(@left AS nvarchar(10)) + N' 行(特采链路单据 ' + CAST(@tcLink AS nvarchar(10)) + N' 张)';
IF @left > 0 RAISERROR(N'采购入库行仍有「特采」空值', 16, 1);
IF @yes < @tcLink RAISERROR(N'特采链路单据未全部标「是」', 16, 1);
PRINT N'✅ 采购入库明细「特采」标记迁移完成:列 + 注明 + 存量回填 + 字段登记(只读) + 译名';
GO
