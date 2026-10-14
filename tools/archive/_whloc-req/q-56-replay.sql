SET NOCOUNT ON;
SELECT DB_NAME() AS 库, script_name AS 脚本, applied_at AS 执行时间 FROM yj_schema_log
WHERE script_name LIKE N'%whloc-area-a-raw%' OR script_name LIKE N'%whloc-clean-coord%' OR script_name LIKE N'%whloc-zone-logic%' OR script_name LIKE N'%whloc-zonepick%'
ORDER BY script_name;
GO