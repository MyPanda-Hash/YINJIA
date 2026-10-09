/* _probe-db-blocking.sql — 一次性的数据库阻塞取证(2026-10-06)
   背景:8090 应用在跑、端口在听,但连静态资源请求都 2s 失败(疑似 Tomcat 工作线程全被 JDBC 拖住)。
   目的:看 HSDZ_MES 上是否有阻塞链/长事务。 */
SET NOCOUNT ON;

PRINT '=== [1] 简单读(能否立刻返回)===';
SELECT COUNT(*) AS yj_panel_行数 FROM yj_panel;
GO

PRINT '=== [2] 阻塞链(blocking_session_id <> 0)===';
SELECT r.session_id, r.blocking_session_id, r.status, r.wait_type, r.wait_time,
       r.command, DB_NAME(r.database_id) AS db_name
FROM sys.dm_exec_requests r
WHERE r.blocking_session_id <> 0;
GO

PRINT '=== [3] 活动请求(wait_time 倒序前 20)===';
SELECT TOP 20 r.session_id, r.status, r.wait_type, r.wait_time, r.command,
       DB_NAME(r.database_id) AS db_name, r.cpu_time, r.total_elapsed_time
FROM sys.dm_exec_requests r
WHERE r.session_id > 50
ORDER BY r.wait_time DESC;
GO

PRINT '=== [4] 各库会话数(含睡眠)===';
SELECT DB_NAME(s.database_id) AS db_name, s.status, COUNT(*) AS 会话数
FROM sys.dm_exec_sessions s
WHERE s.session_id > 50
GROUP BY DB_NAME(s.database_id), s.status
ORDER BY 会话数 DESC;
GO
