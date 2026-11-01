SET NOCOUNT ON;
SELECT DB_NAME() AS db_name,
       (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = N'WO_MIXING_LIST') AS panel_rows,
       (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'WO_MIXING_LIST') AS field_rows,
       (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'WO_MIXING_LIST') AS grant_rows,
       (SELECT COUNT(*) FROM dbo.wo_mixing_list) AS src_rows,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.wo_mixing_list')) AS src_cols;
SELECT TOP 60 column_id, name, TYPE_NAME(user_type_id) AS dtype, max_length, is_nullable, is_identity
  FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.wo_mixing_list') ORDER BY column_id;
