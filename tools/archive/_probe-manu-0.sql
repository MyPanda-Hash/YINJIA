SET NOCOUNT ON;
PRINT '=== 0. yj_panel / yj_field / yj_button 列 ===';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('yj_panel','yj_field','yj_button','yj_role_panel') ORDER BY TABLE_NAME, ORDINAL_POSITION;
