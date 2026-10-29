SET NOCOUNT ON;
SELECT '=== 当前登录与权限 ===' AS s;
SELECT SUSER_SNAME() AS 当前登录,
       IS_SRVROLEMEMBER('sysadmin') AS 是sysadmin,
       IS_SRVROLEMEMBER('securityadmin') AS 是securityadmin,
       IS_SRVROLEMEMBER('dbcreator') AS 是dbcreator,
       SERVERPROPERTY('ProductVersion') AS 版本,
       SERVERPROPERTY('IsIntegratedSecurityOnly') AS 仅Windows认证;
GO
SELECT '=== 服务端登录（sa / yinjia / 其他可见） ===' AS s;
SELECT name, type_desc, is_disabled, create_date, modify_date
  FROM sys.server_principals
 WHERE name IN (N'sa', N'yinjia') OR type IN ('S','U','G')
 ORDER BY name;
GO
SELECT '=== 我有权做的安全操作 ===' AS s;
SELECT HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY LOGIN') AS 可改登录,
       HAS_PERMS_BY_NAME(NULL, NULL, 'CONTROL SERVER') AS 可控实例,
       HAS_PERMS_BY_NAME(NULL, NULL, 'ALTER ANY SERVER ROLE') AS 可改服务器角色;
