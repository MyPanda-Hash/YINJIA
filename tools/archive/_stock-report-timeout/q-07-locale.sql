SET NOCOUNT ON;
GO
SELECT 'yj_locale' AS t, COUNT(*) AS n, STRING_AGG(locale, ',') AS locales FROM yj_locale;
GO
SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS tbl, OBJECT_NAME(fk.referenced_object_id) AS ref_tbl
FROM sys.foreign_keys fk WHERE OBJECT_NAME(fk.parent_object_id) IN ('yj_translation','yj_field','yj_panel');
GO
SELECT locale, text, source FROM yj_translation WHERE scope='field' AND ref_key=N'来料检验';
GO
SELECT TOP 3 c.name, TYPE_NAME(c.system_type_id) AS t, c.max_length FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_translation') ORDER BY c.column_id;
GO
