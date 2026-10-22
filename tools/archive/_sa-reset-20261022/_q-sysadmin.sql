SET NOCOUNT ON;
SELECT '=== sysadmin 成员（谁有权重置 sa）===' AS s;
EXEC sp_helpsrvrolemember 'sysadmin';
GO
SELECT '=== 全部登录（含 Windows/SYSTEM）===' AS s;
SELECT sp.name, sp.type_desc, sp.is_disabled, sp.default_database_name
  FROM sys.server_principals sp
 WHERE sp.type IN ('S','U','G','C','K','E')
 ORDER BY sp.type_desc, sp.name;
GO
SELECT '=== 能否用 sa 登录做探测 ===' AS s;
SELECT SUSER_SNAME() AS 当前;
