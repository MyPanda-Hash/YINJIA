SET NOCOUNT ON;
SELECT SUSER_SNAME() AS me, IS_SRVROLEMEMBER('sysadmin') AS sa, IS_SRVROLEMEMBER('dbcreator') AS dbc;
SELECT name, type_desc, is_disabled FROM sys.server_principals WHERE type IN ('S','U','G') ORDER BY type_desc, name;
SELECT HAS_PERMS_BY_NAME(NULL,NULL,'CREATE ANY DATABASE') AS can_create_db, HAS_PERMS_BY_NAME(NULL,NULL,'CONTROL SERVER') AS ctrl_server;
