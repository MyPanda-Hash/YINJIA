SET NOCOUNT ON;
SELECT '=== 备份相关表 ===' AS s;
SELECT t.name AS 表名,
       CAST(ep.value AS nvarchar(400)) AS 中文注明,
       (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) AS 行数
  FROM sys.tables t
  LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
 WHERE t.name LIKE N'%backup%' OR t.name LIKE N'%bak%';
GO
SELECT '=== yj_backup_log 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS 注明
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_backup_log') ORDER BY c.column_id;
GO
SELECT '=== 最近的备份记录（前 10） ===' AS s;
SELECT TOP 10 id, run_type, status, db_name, file_path, file_size_kb, elapsed_ms,
       started_at, finished_at, operator, message
  FROM dbo.yj_backup_log ORDER BY id DESC;
GO
SELECT '=== 备份配置参数（yj_app_setting） ===' AS s;
SELECT * FROM dbo.yj_app_setting WHERE 参数 LIKE N'db_backup.%' OR 键 LIKE N'db_backup.%';
