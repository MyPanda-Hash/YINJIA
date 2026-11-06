SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM yj_schema_log WHERE script_name = N'migrate-drop-bak-qc-snapshots-20261102.sql') AS bak_snap_logged,
       (SELECT COUNT(*) FROM yj_schema_log WHERE script_name = N'migrate-drop-wol-picking-perm-20261105.sql') AS my_script_logged,
       (SELECT COUNT(*) FROM yj_schema_log) AS log_rows;
-- 该脚本要删的家族表现在还剩多少(判断它是否其实已执行过但没登记)
SELECT DB_NAME() AS db, COUNT(*) AS bak_family_tables
  FROM sys.tables WHERE name LIKE N'_bak[_]qc%';
