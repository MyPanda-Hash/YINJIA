SET NOCOUNT ON;
PRINT '=== sysprocesses: 被阻塞的会话 ===';
SELECT spid, blocked, waittype, waittime, lastwaittype, status, dbid, cmd, program_name, hostname, loginame
FROM sys.sysprocesses
WHERE blocked <> 0;
GO
PRINT '=== 非空闲会话(含 wait) ===';
SELECT spid, status, blocked, waittype, waittime, lastwaittype, dbid, cmd, program_name, hostname, loginame
FROM sys.sysprocesses
WHERE status <> 'sleeping' AND spid > 50;
GO
PRINT '=== 有未提交事务的会话 ===';
SELECT s.spid, s.status, s.open_tran, s.program_name, s.hostname, s.loginame, s.cmd
FROM sys.sysprocesses s
WHERE s.open_tran > 0;
GO
