-- q-20-slow.sql — 数据库变慢定位:活动请求 / 阻塞链 / 等待类型 / 会话数
SET NOCOUNT ON;
SELECT 'A.活动请求(非 sleep)' AS k, r.session_id, r.status, r.blocking_session_id AS blocked_by,
       r.wait_type, r.wait_time AS wait_ms, r.cpu_time AS cpu_ms, r.total_elapsed_time AS elapsed_ms,
       DB_NAME(r.database_id) AS db, LEFT(t.text, 120) AS sql_head
  FROM sys.dm_exec_requests r
  OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
 WHERE r.session_id <> @@SPID AND r.session_id > 50
 ORDER BY r.total_elapsed_time DESC;
GO
SELECT 'B.会话状态分布' AS k, status, COUNT(*) AS n FROM sys.dm_exec_sessions WHERE session_id > 50 GROUP BY status;
GO
SELECT 'C.当前等待(库级)' AS k, TOP 10 wait_type, COUNT(*) AS n, SUM(wait_time_ms) AS total_ms
  FROM sys.dm_os_waiting_tasks GROUP BY wait_type ORDER BY SUM(wait_time_ms) DESC;
GO
