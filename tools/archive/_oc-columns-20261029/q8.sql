SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_schema_log');
SELECT * FROM yj_schema_log WHERE script_name LIKE '%20261029%' OR script_name LIKE '%20261028%';
