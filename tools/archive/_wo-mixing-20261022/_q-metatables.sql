SET NOCOUNT ON;
SELECT t.name tbl, c.column_id, c.name, TYPE_NAME(c.user_type_id) ty, c.max_length, c.is_nullable
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('yj_panel','yj_field','yj_translation','yj_role_panel','yj_column_pref') ORDER BY t.name, c.column_id;
