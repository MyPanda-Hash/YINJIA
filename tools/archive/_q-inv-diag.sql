SET NOCOUNT ON;
SELECT r.session_id, r.status, r.command, r.wait_type, r.blocking_session_id,
       r.cpu_time, r.total_elapsed_time, r.logical_reads,
       SUBSTRING(t.text, 1, 120) AS 语句
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id <> @@SPID;
