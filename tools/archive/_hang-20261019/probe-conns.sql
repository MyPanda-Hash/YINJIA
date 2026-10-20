SET NOCOUNT ON;
PRINT '=== 应用连接池占用(JDBC 连接) ===';
SELECT spid, status, blocked, waittype, waittime, lastwaittype, dbid, cmd, hostname, program_name
FROM sys.sysprocesses
WHERE program_name LIKE '%JDBC%'
ORDER BY spid;
GO
PRINT '=== 连接数按库 ===';
SELECT dbid, COUNT(*) AS 连接数 FROM sys.sysprocesses WHERE spid > 50 GROUP BY dbid;
GO
