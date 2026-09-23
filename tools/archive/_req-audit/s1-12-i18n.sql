SET NOCOUNT ON;
GO
SELECT N'S1-60: yj_translation 中 文件编码/受控/履历/定型 词条' AS sec, scope, ref_key, locale, text, source
FROM yj_translation
WHERE ref_key LIKE N'%文件编码%' OR ref_key LIKE N'%受控%' OR ref_key LIKE N'%履历%'
   OR ref_key LIKE N'%定型%' OR text LIKE N'%文件编码%' OR text LIKE N'%受控%' OR text LIKE N'%履历%'
ORDER BY scope, ref_key, locale;
GO
SELECT N'S1-61: yj_translation scope 分布' AS sec, scope, COUNT(*) AS n FROM yj_translation GROUP BY scope ORDER BY scope;
GO
SELECT N'S1-62: yj_translation 是否含 文件汇总表' AS sec, scope, ref_key, locale, text
FROM yj_translation WHERE ref_key LIKE N'%汇总%' OR text LIKE N'%汇总%';
GO
SELECT N'S1-63: yj_field 四个文件表的 editable 汇总(是否随状态变化)' AS sec,
       panel_code, place, COUNT(*) AS n, SUM(CAST(editable AS int)) AS editable_1
FROM yj_field WHERE panel_code IN ('RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN')
GROUP BY panel_code, place ORDER BY panel_code, place;
GO
SELECT N'S1-64: 是否存在 按状态改 editable 的配置列(全库检索 yj_field 无状态相关列已确认,列校验)' AS sec,
       COUNT(*) AS yj_field_cols FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_field';
GO
