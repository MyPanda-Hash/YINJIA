/* ============================================================================
 * migrate-qc-ng-disposal-20261128.sql
 * 来料不合格分支改道:特采单 → 不合格品处理单(来料)+ 检验单特采回填
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-28):
 *   ①「先将特采单改为不合格品处理单(来料)，放在品质的来料检验里面。」
 *   ②「现在流程不需要经过退料单了，取消暂收单的特采字段。」
 *   ③「检验数据记录里面的检验结论选择不合格，审批通过后自动生成和进入不合格处理单，
 *      并且检验结论处可以链接进入不合格处理单。」
 *   ④「进入不合格处理单(来料)都不变。审批通过后，在来料检验单会回填一个特采字段，
 *      通过这个特采字段，可以判断不合格数量是采购入库还是暂收退料。」
 *   ⑤ 追问确认:「只要不合格处理单审批通过就回填特采，没用就默认不特采」⇒
 *      **处理单审批通过 = 特采=是**（让步接收,不合格数量进采购入库）;
 *      **没有处理单/未通过 = 特采=否**（走暂收退料,退回供应商转 ERP 采购退货）。
 *   ⑥ 生单粒度:「一张不合格的检验数据记录 = 一张不合格品处理单」(沿用"一物料一单")。
 *
 * 现状(改动前,取证 2026-11-28 正式账套):
 *   · QC_TC_IN 面板名「特采单」、category=采购管理 / module_group=智能供应链、菜单挂在
 *     采购管理 > 单据(前端 menus.js);
 *   · 特采的**唯一发起口** = 暂收退回单 QC_RETURN 明细行勾「特采」(yj_field id=11587,是否/bit),
 *     由 ButtonService.returnAutoSpecialAccept 在退料单审核/审批通过时逐行生成特采单;
 *   · 来料检验单明细 qc_insp_detail 有**历史遗留的「特采」bit 列**(2026-09-22~10-04 那代口径用过),
 *     但 yj_field 行已下线 ⇒ 界面上看不到、也没人再写它(故本次只需复原字段行,不动 DDL);
 *   · 检验数据记录 qc_insp_rec **没有**指向不合格品处理单的链路列。
 *
 * 本脚本做的四件事(全部幂等):
 *   ① QC_TC_IN 面板正名「不合格品处理单(来料)」+ 模块归到 品质管理(与来料检验单同组),
 *      并迁移面板译名(panel / 特采单 → 不合格品处理单(来料));
 *   ② 来料检验单明细恢复「特采」字段(是否,只读,seq=105 紧跟不合格数量)—— 回填落点;
 *   ③ 删除暂收退回单明细「特采」字段(旧发起口下线);物理列保留(历史数据不动,避免毁证据);
 *   ④ 检验数据记录新增「不合格品处理单号」(nvarchar(200),隐藏链路列)+ 字段行 + 列中文注明;
 *      另补「不合格品处理单(来料)」面板译名与「不合格品处理单号」字段译名(en)。
 *
 * 两账套:HSDZ_MES(正式) → HSDZ_MES_TEST(测试) 各执行一遍。
 * 幂等:全部 IF NOT EXISTS / 窄条件 UPDATE(带行数断言) / 译名仅空播;重复跑输出 [PASS]。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 面板正名 + 模块归位 ---- */
DECLARE @panelCnt int;
SELECT @panelCnt = COUNT(*) FROM yj_panel WHERE panel_code = N'QC_TC_IN';
IF @panelCnt <> 1
    RAISERROR(N'[面板] QC_TC_IN 行数为 %d,预期 1 行,已中止', 16, 1, @panelCnt);

UPDATE yj_panel
   SET panel_name = N'不合格品处理单(来料)',
       panel_name_en = N'Incoming Nonconforming Disposal',
       category = N'采购管理',
       module_group = N'品质管理',
       config_at = GETDATE()
 WHERE panel_code = N'QC_TC_IN';
PRINT N'[面板] QC_TC_IN → 不合格品处理单(来料),模块=品质管理';
GO

/* ---- ② 来料检验单明细恢复「特采」字段(物理列 bit 早已存在,不动 DDL) ---- */
IF COL_LENGTH('dbo.qc_insp_detail', N'特采') IS NULL
    RAISERROR(N'[字段] qc_insp_detail 缺物理列「特采」(bit),本脚本不改 DDL,请人工核查血统', 16, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND col_name = N'特采')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width,
                          editable, required, hidden, visible, label_en)
    VALUES (N'QC_INSP', N'特采', N'特采', N'是否', N'detail', 105, 80,
            0, 0, 0, 1, N'Special acceptance');
    PRINT N'[字段] QC_INSP 明细恢复「特采」(是否/只读,seq=105,紧接不合格数量)';
END
ELSE
BEGIN
    -- 已存在:只校正位置/可见/只读,不动 seq 之外的东西,保证重跑幂等
    UPDATE yj_field
       SET label = N'特采', data_type = N'是否', place = N'detail', seq = 105, width = 80,
           visible = 1, hidden = 0, editable = 0
     WHERE panel_code = N'QC_INSP' AND col_name = N'特采';
    PRINT N'[字段] QC_INSP「特采」已存在,位置/可见性已校正';
END
GO

/* ---- ③ 暂收退回单明细「特采」字段下线(旧发起口) ---- */
DECLARE @retTc int;
SELECT @retTc = COUNT(*) FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'特采';
IF @retTc = 1
BEGIN
    DELETE FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'特采';
    PRINT N'[字段] QC_RETURN「特采」已删除(特采改由检验数据记录 → 不合格品处理单发起)';
END
ELSE IF @retTc = 0
    PRINT N'[字段] QC_RETURN「特采」已不存在(幂等)';
ELSE
    RAISERROR(N'[字段] QC_RETURN「特采」字段行数为 %d,预期 ≤1 行,已中止', 16, 1, @retTc);
GO

/* ---- ④ 检验数据记录:不合格品处理单号(列 + 字段 + 注明) ---- */
IF COL_LENGTH('dbo.qc_insp_rec', N'不合格品处理单号') IS NULL
BEGIN
    ALTER TABLE dbo.qc_insp_rec ADD 不合格品处理单号 nvarchar(200) NULL;
    PRINT N'[列] qc_insp_rec.不合格品处理单号 已新增';
END
ELSE
    PRINT N'[列] qc_insp_rec.不合格品处理单号 已存在(幂等)';
GO

/* 列中文注明(规范 §2.2.1):表与列都要有 MS_Description */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_insp_rec') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'检验数据记录(来料检验报告 YJ-QR-96)',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID('dbo.qc_insp_rec')
                  AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_rec'), N'不合格品处理单号', 'ColumnId')
                  AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'不合格品处理单号:检验结论=不合格且审批通过时自动生成的不合格品处理单(来料),供检验结论格跳转',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_rec', N'COLUMN', N'不合格品处理单号';
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND col_name = N'不合格品处理单号')
BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width,
                          editable, required, hidden, visible, label_en)
    VALUES (N'QC_INSP_REC', N'不合格品处理单号', N'不合格品处理单号', N'文本', N'header', 149, 140,
            0, 0, 1, 0, N'Nonconforming Disposal No.');
    PRINT N'[字段] QC_INSP_REC 新增隐藏链路列「不合格品处理单号」(seq=149)';
END
ELSE
    PRINT N'[字段] QC_INSP_REC「不合格品处理单号」已存在(幂等)';
GO

/* ---- ⑤ 译名(多语言硬约束 §2.1):面板名 + 新字段 ---- */
/* 面板译名:原键「特采单」→ 新键「不合格品处理单(来料)」(逐 locale 迁移,不重复插) */
DECLARE @txt nvarchar(400), @loc sysname, @newKey nvarchar(200) = N'不合格品处理单(来料)';
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT locale, text FROM yj_translation WHERE scope = N'panel' AND ref_key = N'特采单';
OPEN cur;
FETCH NEXT FROM cur INTO @loc, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = @newKey AND locale = @loc)
        INSERT INTO yj_translation (scope, ref_key, locale, text, source)
        VALUES (N'panel', @newKey, @loc, @txt, N'manual');
    DELETE FROM yj_translation WHERE scope = N'panel' AND ref_key = N'特采单' AND locale = @loc;
    FETCH NEXT FROM cur INTO @loc, @txt;
END
CLOSE cur; DEALLOCATE cur;

/* 缺哪个 locale 补哪个:至少 en(硬约束),其余语言由机翻兜底 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = @newKey AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'panel', @newKey, 'en', N'Incoming Nonconforming Disposal', N'manual');
-- 沿用的旧译名是「特采单 = Incoming Special Procurement」,正名后 en 必须跟着改(否则英文界面还是"特采")
UPDATE yj_translation SET text = N'Incoming Nonconforming Disposal', source = N'manual'
 WHERE scope = N'panel' AND ref_key = @newKey AND locale = 'en'
   AND text <> N'Incoming Nonconforming Disposal';

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'不合格品处理单号' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'不合格品处理单号', 'en', N'Nonconforming Disposal No.', N'manual');
/* 「特采」字段译名早已存在(采购入库单在用),这里只兜底一次 */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'特采' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES (N'field', N'特采', 'en', N'Special acceptance', N'manual');
PRINT N'[译名] panel/field 译名已补齐';
GO

/* ---- ⑥ 列中文注明刷新(口径已变的 3 列;五条自检在下一个批次) ---- */
/* qc_insp_detail.特采:旧注明写的是 2026-10-04 那代口径(检验审核不直接生成入库/退料),
   2026-11-28 起它是**分流开关**(不合格品处理单审批通过后回填),必须改注明,否则后人按旧口径读代码 */
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID('dbo.qc_insp_detail')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_insp_detail'), N'特采', 'ColumnId')
              AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
         N'特采:1=让步接收(不合格数量进采购入库),0=退回供应商(进暂收退回单)。2026-11-28 起由「不合格品处理单(来料)审批通过」回填,前端只读,人工不改;检验单审核/处理单审批通过两处都按它分流',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'特采';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
         N'特采:1=让步接收(不合格数量进采购入库),0=退回供应商(进暂收退回单)。2026-11-28 起由「不合格品处理单(来料)审批通过」回填,前端只读',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_insp_detail', N'COLUMN', N'特采';

/* qc_return_detail.特采:字段已下线(物理列留档),注明标明"已停用"免得后人又去读它 */
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID('dbo.qc_return_detail')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.qc_return_detail'), N'特采', 'ColumnId')
              AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
         N'特采(已停用 2026-11-28 起):原「退料行勾特采 → 生成特采单」的发起开关。特采改由「检验数据记录判不合格 → 不合格品处理单(来料)」发起,yj_field 已删除,本列仅留档历史数据,新代码不得再读写',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'特采';
ELSE
    EXEC sp_addextendedproperty N'MS_Description',
         N'特采(已停用 2026-11-28 起):原退料行特采开关,仅留档历史数据',
         N'SCHEMA', N'dbo', N'TABLE', N'qc_return_detail', N'COLUMN', N'特采';

/* bl_purchase_in.特采:来源单据改名后注明跟着改(值仍是 是/否) */
IF EXISTS (SELECT 1 FROM sys.extended_properties
            WHERE major_id = OBJECT_ID('dbo.bl_purchase_in')
              AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bl_purchase_in'), N'特采', 'ColumnId')
              AND name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description',
         N'特采:是=本行由「不合格品处理单(来料)」(QC_TC_IN,2026-11-28 前叫特采单)审批通过后生成,即让步接收的不合格数量入库;否=普通来料检验合格入库或免检直达。生单时写入,只读',
         N'SCHEMA', N'dbo', N'TABLE', N'bl_purchase_in', N'COLUMN', N'特采';
GO

/* ---- ⑦ 自检(三态) ---- */
DECLARE @chk nvarchar(400) = N'';
IF (SELECT panel_name FROM yj_panel WHERE panel_code = N'QC_TC_IN') <> N'不合格品处理单(来料)'
    SET @chk += N'面板名未正名; ';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP' AND col_name = N'特采' AND hidden = 0)
    SET @chk += N'检验单特采字段缺失/被隐藏; ';
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RETURN' AND col_name = N'特采')
    SET @chk += N'退料单特采字段未删除; ';
IF COL_LENGTH('dbo.qc_insp_rec', N'不合格品处理单号') IS NULL
    SET @chk += N'检验数据记录缺链路列; ';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND col_name = N'不合格品处理单号')
    SET @chk += N'检验数据记录缺字段行; ';
IF @chk = N''
    PRINT N'[PASS] migrate-qc-ng-disposal-20261128 全部四项就位(面板正名/特采字段/退料单字段下线/记录链路列)';
ELSE
    RAISERROR(N'[FAIL] %s', 16, 1, @chk);
GO
