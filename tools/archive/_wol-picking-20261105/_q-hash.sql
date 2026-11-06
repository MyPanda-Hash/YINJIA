SET NOCOUNT ON;
SELECT DB_NAME() AS db, script_name, content_hash FROM yj_schema_log WHERE script_name IN (N'migrate-drop-bak-qc-snapshots-20261102.sql', N'migrate-drop-wol-picking-perm-20261105.sql');
