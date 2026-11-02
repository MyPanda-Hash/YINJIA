SET NOCOUNT ON;
SELECT '=== yj_app_setting 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_app_setting') ORDER BY c.column_id;
GO
SELECT '=== 备份配置(db_backup.*) ===' AS s;
SELECT * FROM dbo.yj_app_setting
 WHERE setting_key LIKE N'db_backup.%' OR CAST(setting_value AS nvarchar(200)) LIKE N'%SQLBackup%';
GO
SELECT '=== 备份记录条数 ===' AS s;
SELECT COUNT(*) AS 总记录数,
       SUM(CASE WHEN status = N'成功' THEN 1 ELSE 0 END) AS 成功,
       SUM(CASE WHEN status = N'失败' THEN 1 ELSE 0 END) AS 失败,
       MIN(started_at) AS 最早, MAX(started_at) AS 最近
  FROM dbo.yj_backup_log;
