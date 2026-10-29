SET NOCOUNT ON;
SELECT DB_NAME() AS db, OBJECT_ID(N'dbo.wo_mixing_list') AS mixing_obj, OBJECT_NAME(OBJECT_ID(N'dbo.wo_mixing_list')) AS nm;
SELECT script_name, RIGHT(content_hash, 8) AS h FROM yj_schema_log WHERE script_name LIKE '%prod-pick%' OR script_name LIKE '%wo-mixing%';
