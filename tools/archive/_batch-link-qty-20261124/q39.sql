SET NOCOUNT ON;
SELECT DB_NAME() AS 库, COUNT(*) AS 已登记 FROM yj_schema_log WHERE script_name = N'migrate-batch-link-qty-sync-20261124.sql';
