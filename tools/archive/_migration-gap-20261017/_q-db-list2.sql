SET NOCOUNT ON;
SELECT name, create_date, compatibility_level, collation_name, state_desc, recovery_model_desc
FROM sys.databases WHERE database_id > 4 ORDER BY name;
