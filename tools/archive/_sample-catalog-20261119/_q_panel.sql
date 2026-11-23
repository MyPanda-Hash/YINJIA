/* 只读:yj_panel(SAMPLE_REG) 现状 + yj_translation 结构探针 */
SET NOCOUNT ON;

SELECT N'[panel] SAMPLE_REG' AS 标签, panel_code, panel_name, mode, ISNULL(config, N'(null)') AS config
FROM yj_panel WHERE panel_code = N'SAMPLE_REG';

SELECT N'[translation 结构]' AS 标签, c.name AS 列名, t.name AS 类型,
       CAST(c.max_length AS nvarchar(10)) AS 长度, CAST(c.is_nullable AS nvarchar(10)) AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_translation') ORDER BY c.column_id;

SELECT N'[translation 现役列清单]' AS 标签, scope, ref_key, locale, text, source
FROM yj_translation WHERE scope = N'panel' AND ref_key LIKE N'%送样%';
