/* fix-qc-proc-insp-report-i18n.sql(2026-10-12):补制程检验记录表相关标签的 en 译名。
 *
 * 背景:报表模板名「制程检验记录表」缺 en;而「检验要求 / 检验方法 / 不合格应对措施 / 尺寸」
 *   4 个标签的 en 值是中文原文(历史占位/机翻遗留),等于没译 —— AGENTS.md 多语言规范不允许。
 * 幂等:缺失则插、值为中文原文则改;两账套均执行。
 */
SET NOCOUNT ON;
GO

/* ① 报表名(scope=report;与模板名 yj_report_template.name 对齐) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'report' AND ref_key = N'制程检验记录表' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'report', N'制程检验记录表', N'en', N'In-Process Inspection Record', N'manual');
GO

/* ② 值为中文原文的标签:正名(只在仍是中文原文时更新,避免覆盖人工校对过的译文) */
UPDATE yj_translation SET text = N'Inspection Requirement', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'检验要求' AND locale = N'en' AND text = N'检验要求';
UPDATE yj_translation SET text = N'Inspection Method', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'检验方法' AND locale = N'en' AND text = N'检验方法';
UPDATE yj_translation SET text = N'Nonconformance Action', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'不合格应对措施' AND locale = N'en' AND text = N'不合格应对措施';
UPDATE yj_translation SET text = N'Dimensions', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'尺寸' AND locale = N'en' AND text = N'尺寸';
GO

/* 自检:上述 key 的 en 不得缺、也不得等于中文原文 */
DECLARE @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'report' AND ref_key = N'制程检验记录表' AND locale = N'en') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验要求' AND locale = N'en' AND text = N'检验要求') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验方法' AND locale = N'en' AND text = N'检验方法') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'不合格应对措施' AND locale = N'en' AND text = N'不合格应对措施') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'尺寸' AND locale = N'en' AND text = N'尺寸') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验记录表译名修正自检失败', 16, 1);
ELSE PRINT N'制程检验记录表译名就绪';
GO
