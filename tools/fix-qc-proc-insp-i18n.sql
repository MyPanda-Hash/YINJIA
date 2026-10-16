/* fix-qc-proc-insp-i18n.sql(2026-10-12):修正制程检验单两个字段的 en 译名被历史脏值占位的问题。
 *
 * 现象:migrate-qc-proc-insp.sql 的 NOT EXISTS 守卫让「表区」「检验类别」的 en 译名没插进去,
 *   因为库里**已存在**同 ref_key 的 en 行,但 text 是中文原文(历史机翻/占位遗留)。
 *   实测:`field|表区|en = 表区`、`field|检验类别|en = 检验类别` —— 等于没译。
 * 处理:直接把这两条的 en 文本改正(幂等:只在仍是中文原文时才更新)。
 */
SET NOCOUNT ON;
GO

UPDATE yj_translation SET text = N'Section', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'表区' AND locale = N'en' AND text = N'表区';
PRINT N'[OK] 表区 en 修正,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';

UPDATE yj_translation SET text = N'Inspection Type', source = N'manual'
 WHERE scope = N'field' AND ref_key = N'检验类别' AND locale = N'en' AND text = N'检验类别';
PRINT N'[OK] 检验类别 en 修正,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

/* 自检:这两个 key 的 en 不得等于中文原文 */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'表区' AND locale = N'en' AND text = N'表区') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'检验类别' AND locale = N'en' AND text = N'检验类别') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验单译名修正自检失败', 16, 1);
ELSE PRINT N'制程检验单译名就绪(表区/检验类别 en 已正名)';
GO
