SET NOCOUNT ON;
SELECT SUSER_SNAME() AS 登录名, IS_SRVROLEMEMBER('sysadmin') AS 是sysadmin,
       SERVERPROPERTY('ServerName') AS 实例, DB_NAME() AS 当前库;
SELECT COUNT(*) AS 库数 FROM sys.databases WHERE database_id > 4;
