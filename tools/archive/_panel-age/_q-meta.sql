SET NOCOUNT ON;
SELECT 'T' AS k, name FROM sys.tables WHERE name IN ('yj_role_panel','yj_doc_status','yj_schema_log','yj_panel_perm','yj_column_prefs') ORDER BY name;
SELECT 'COLS' AS k, OBJECT_NAME(c.object_id) AS tbl, c.name FROM sys.columns c WHERE c.object_id IN (OBJECT_ID('yj_schema_log'),OBJECT_ID('yj_role_panel'),OBJECT_ID('yj_doc_status')) ORDER BY tbl, c.column_id;
GO
