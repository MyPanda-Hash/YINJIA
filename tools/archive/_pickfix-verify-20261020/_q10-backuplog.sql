SET NOCOUNT ON;
SELECT COUNT(*) AS 行数 FROM dbo.yj_backup_log;
SELECT TOP 10 * FROM dbo.yj_backup_log ORDER BY id DESC;
