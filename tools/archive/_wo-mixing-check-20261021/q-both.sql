SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM dbo.yj_panel WHERE panel_code = N'WO_MIXING_LIST') AS panel_rows,
       (SELECT COUNT(*) FROM dbo.yj_schema_log WHERE script_name = N'migrate-wo-mixing-list-20261022.sql') AS log_rows;
