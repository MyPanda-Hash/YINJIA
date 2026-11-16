SELECT SUSER_SNAME() AS login_name, IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin,
       IS_SRVROLEMEMBER('db_backupoperator') AS is_backupop,
       HAS_PERMS_BY_NAME(NULL, NULL, 'BACKUP DATABASE') AS can_backup;
SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400)) AS default_backup_path,
       CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)) AS default_data_path;
