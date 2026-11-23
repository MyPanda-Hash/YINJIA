/* migrate-qc-bhc-resp-per-section-20261123.sql(2026-11-23)
 *
 * 用户口径(不合格品处理单(制程) YJ-QR-59 截图):
 *   「这每个责任人都是不同的责任人，而不是作为同一个责任人。」
 *   纸面上「问题描述 / 原因分析 / 性能验证 / 不合格品处理意见(品质部) / 改善效果验证」
 *   五处落款都由同一个表头列 `责任人` 渲染 ⇒ 填一处五处一起变，无法分别签不同的人。
 *
 * 做法:
 *   · qc_bhc 加 5 个独立人员列(列名=中文标签，ADR-0001 数据键不翻译);
 *   · yj_field 逐个登记(place=header，editable=1，visible=1)，供纸面 DocSheet 绑定与保存;
 *   · 译名补 en / zh-TW(AGENTS §2.1 新增字段必须给 yj_translation);
 *   · 纸面配置改在 frontend/src/core/views/docSheetConfigs.js：各 section 的 signKey 指向各自列，
 *     表头「责任人」列保留原语义(仍由 ButtonService.prefillResponsible 预填，可改)。
 *
 * 口径:
 *   · 「责任人」表头列不动 —— 它是本单的业务责任人(问题来源行)，也是后端预填/审核链路认的列;
 *     新增五列只在各自章节落款处使用，互不影响。
 *   · 日期不新增列：各章节日期仍绑 `单据日期`(用户本次只要求责任人分开;
 *     纸面右上「时间」按第 4 条改为提交审批时间戳，见 QueryService.DOC_SUBMIT_TIME_PANELS)。
 *
 * 规范:qc_ 前缀既有表加列；新列写 MS_Description；幂等(加列 IF COL_LENGTH IS NULL、
 *   字段/译名 INSERT NOT EXISTS)；两账套均执行。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO
PRINT N'== migrate-qc-bhc-resp-per-section-20261123 ==';
GO

/* ============ A. 物理列 ============ */
IF COL_LENGTH(N'dbo.qc_bhc', N'问题描述责任人') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [问题描述责任人] nvarchar(100) NULL;
    PRINT N'[OK] qc_bhc.[问题描述责任人] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[问题描述责任人] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'原因分析责任人') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [原因分析责任人] nvarchar(100) NULL;
    PRINT N'[OK] qc_bhc.[原因分析责任人] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[原因分析责任人] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'性能验证责任人') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [性能验证责任人] nvarchar(100) NULL;
    PRINT N'[OK] qc_bhc.[性能验证责任人] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[性能验证责任人] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'处理意见责任人') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [处理意见责任人] nvarchar(100) NULL;
    PRINT N'[OK] qc_bhc.[处理意见责任人] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[处理意见责任人] 已存在';
GO
IF COL_LENGTH(N'dbo.qc_bhc', N'改善效果验证责任人') IS NULL
BEGIN
    ALTER TABLE dbo.qc_bhc ADD [改善效果验证责任人] nvarchar(100) NULL;
    PRINT N'[OK] qc_bhc.[改善效果验证责任人] 已加';
END
ELSE PRINT N'[SKIP] qc_bhc.[改善效果验证责任人] 已存在';
GO

/* ============ B. 列中文注明 ============ */
DECLARE @col sysname, @desc nvarchar(500), @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT v.col, v.[desc] FROM (VALUES
        (N'问题描述责任人', N'问题描述落款责任人:一．问题描述章节签名，与其它章节责任人分开填(2026-11-23 用户口径)'),
        (N'原因分析责任人', N'原因分析落款责任人:二．原因分析章节签名，与其它章节责任人分开填(2026-11-23 用户口径)'),
        (N'性能验证责任人', N'性能验证落款责任人:三．性能验证章节签名，与其它章节责任人分开填(2026-11-23 用户口径)'),
        (N'处理意见责任人', N'处理意见(品质部)落款责任人:四．不合格品处理意见章节签名，与其它章节责任人分开填(2026-11-23 用户口径)'),
        (N'改善效果验证责任人', N'改善效果验证落款责任人:六．改善效果验证章节签名，与其它章节责任人分开填(2026-11-23 用户口径)')
    ) AS v(col, [desc]);
OPEN cur;
FETCH NEXT FROM cur INTO @col, @desc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE major_id = OBJECT_ID(N'dbo.qc_bhc')
                     AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), @col, 'ColumnId')
                     AND name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @desc,
            N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @desc,
            N'SCHEMA', N'dbo', N'TABLE', N'qc_bhc', N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @col, @desc;
END
CLOSE cur;
DEALLOCATE cur;
GO

/* ============ C. yj_field 字段登记(seq 紧接表头「责任人」110 之后) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'问题描述责任人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'问题描述责任人', N'问题描述责任人', N'文本', N'header', 111, 100, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'原因分析责任人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'原因分析责任人', N'原因分析责任人', N'文本', N'header', 112, 100, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'性能验证责任人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'性能验证责任人', N'性能验证责任人', N'文本', N'header', 113, 100, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'处理意见责任人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'处理意见责任人', N'处理意见责任人', N'文本', N'header', 114, 100, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_BHC' AND col_name = N'改善效果验证责任人')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES (N'QC_BHC', N'改善效果验证责任人', N'改善效果验证责任人', N'文本', N'header', 115, 100, 1, 0, 0, 1);
GO

/* ============ D. 字段译名(至少 en;zh-TW 一并给) ============ */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'问题描述责任人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'问题描述责任人', 'en', N'Problem Description Owner', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'问题描述责任人' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'问题描述责任人', 'zh-TW', N'問題描述責任人', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'原因分析责任人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'原因分析责任人', 'en', N'Cause Analysis Owner', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'原因分析责任人' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'原因分析责任人', 'zh-TW', N'原因分析責任人', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'性能验证责任人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'性能验证责任人', 'en', N'Performance Verification Owner', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'性能验证责任人' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'性能验证责任人', 'zh-TW', N'性能驗證責任人', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'处理意见责任人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'处理意见责任人', 'en', N'Disposition Owner', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'处理意见责任人' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'处理意见责任人', 'zh-TW', N'處理意見責任人', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'改善效果验证责任人' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'改善效果验证责任人', 'en', N'Improvement Verification Owner', 'manual');
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'改善效果验证责任人' AND locale = 'zh-TW')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source)
    VALUES ('field', N'改善效果验证责任人', 'zh-TW', N'改善效果驗證責任人', 'manual');
GO

/* ============ E. 自检 ============ */
DECLARE @db sysname = DB_NAME();
IF COL_LENGTH(N'dbo.qc_bhc', N'问题描述责任人') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'原因分析责任人') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'性能验证责任人') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'处理意见责任人') IS NOT NULL
   AND COL_LENGTH(N'dbo.qc_bhc', N'改善效果验证责任人') IS NOT NULL
   AND (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_BHC'
        AND col_name IN (N'问题描述责任人', N'原因分析责任人', N'性能验证责任人', N'处理意见责任人', N'改善效果验证责任人')
        AND editable = 1 AND visible = 1) = 5
   AND (SELECT COUNT(*) FROM sys.extended_properties
        WHERE major_id = OBJECT_ID(N'dbo.qc_bhc') AND name = N'MS_Description'
          AND minor_id IN (COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'问题描述责任人', 'ColumnId'),
                           COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'原因分析责任人', 'ColumnId'),
                           COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'性能验证责任人', 'ColumnId'),
                           COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'处理意见责任人', 'ColumnId'),
                           COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_bhc'), N'改善效果验证责任人', 'ColumnId'))) = 5
   AND (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field'
        AND ref_key IN (N'问题描述责任人', N'原因分析责任人', N'性能验证责任人', N'处理意见责任人', N'改善效果验证责任人')
        AND locale IN ('en', 'zh-TW')) >= 10
    RAISERROR(N'[PASS] %s 不合格品处理单(制程)分章节责任人已就绪(5 列 + 5 字段 + 译名)', 10, 1, @db);
ELSE
    RAISERROR(N'[FAIL] %s 不合格品处理单(制程)分章节责任人自检未通过', 16, 1, @db);
GO
