SET NOCOUNT ON;
SELECT DB_NAME() AS db, SUSER_SNAME(owner_sid) AS db_owner, is_trustworthy_on FROM sys.databases WHERE name=DB_NAME();
SELECT r.name AS role_name FROM sys.database_role_members m
  JOIN sys.database_principals r ON r.principal_id=m.role_principal_id
  JOIN sys.database_principals u ON u.principal_id=m.member_principal_id
  WHERE u.name='yinjia';
SELECT HAS_PERMS_BY_NAME(NULL,NULL,'CREATE PROCEDURE') AS can_create_proc,
       HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','IMPERSONATE ANY LOGIN') AS can_imp,
       IS_MEMBER('db_owner') AS is_db_owner, IS_MEMBER('db_ddladmin') AS is_ddladmin;
