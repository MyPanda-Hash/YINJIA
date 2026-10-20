SET NOCOUNT ON;
PRINT '=== 1. 当前阻塞链(谁堵谁) ===';
SELECT r.session_id AS 被堵会话, r.blocking_session_id AS 堵它的会话,
       r.wait_type AS 等待类型, r.wait_time AS 等待ms, r.status AS 状态,
       DB_NAME(r.database_id) AS 库, r.command AS 命令,
       SUBSTRING(t.text, (r.statement_start_offset/2)+1, 200) AS 语句摘要
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id <> 0;
GO

PRINT '=== 2. 未提交事务 / 非空闲会话 ===';
SELECT s.session_id, s.login_name, s.host_name, s.program_name,
       s.status, s.open_transaction_count AS 未提交事务数,
       DATEDIFF(SECOND, s.last_request_start_time, GETDATE()) AS 本请求已秒,
       DATEDIFF(SECOND, s.last_request_end_time, GETDATE()) AS 空闲秒,
       st.text AS 最后语句
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_connections c ON c.session_id = s.session_id
LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(COALESCE(r.sql_handle, c.most_recent_sql_handle)) st
WHERE s.is_user_process = 1
  AND (s.open_transaction_count > 0 OR s.status <> 'sleeping')
ORDER BY s.session_id;
GO

PRINT '=== 3. 活动事务(年龄最长的在前) ===';
SELECT at.transaction_id, at.name, at.transaction_begin_time,
       DATEDIFF(SECOND, at.transaction_begin_time, GETDATE()) AS 事务已开秒,
       CASE at.transaction_type WHEN 1 THEN '读写' WHEN 2 THEN '只读' WHEN 3 THEN '系统' WHEN 4 THEN '分布式' END AS 类型,
       CASE at.transaction_state WHEN 0 THEN '未初始化' WHEN 1 THEN '未开始' WHEN 2 THEN '活动' WHEN 3 THEN '已结束' WHEN 4 THEN '已提交' WHEN 5 THEN '已回滚' WHEN 6 THEN '已提交' WHEN 7 THEN '回滚中' WHEN 8 THEN '已提交(被跟踪)' END AS 状态,
       st.session_id, st2.text AS 关联语句
FROM sys.dm_tran_active_transactions at
LEFT JOIN sys.dm_tran_session_transactions st ON st.transaction_id = at.transaction_id
LEFT JOIN sys.dm_exec_requests r2 ON r2.session_id = st.session_id
OUTER APPLY sys.dm_exec_sql_text(r2.sql_handle) st2
ORDER BY at.transaction_begin_time;
GO

PRINT '=== 4. 锁统计(按 对象/类型) ===';
SELECT OBJECT_NAME(p.object_id) AS 对象, p.index_id, l.resource_type AS 资源类型,
       l.request_mode AS 模式, l.request_status AS 状态, COUNT(*) AS 个数
FROM sys.dm_tran_locks l
LEFT JOIN sys.partitions p ON p.hobt_id = l.resource_associated_entity_id
WHERE l.resource_database_id = DB_ID()
GROUP BY p.object_id, p.index_id, l.resource_type, l.request_mode, l.request_status
ORDER BY COUNT(*) DESC;
GO

PRINT '=== 5. 最慢语句(按历史最大耗时) ===';
SELECT TOP 15
       qs.execution_count AS 次数,
       qs.total_elapsed_time/1000 AS 累计ms,
       qs.max_elapsed_time/1000 AS 最大ms,
       qs.last_elapsed_time/1000 AS 最近ms,
       SUBSTRING(t.text, (qs.statement_start_offset/2)+1, 160) AS 语句
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
ORDER BY qs.max_elapsed_time DESC;
GO

PRINT '=== 6. 正在跑/等待的语句(含 plang 或 workOrderList) ===';
SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, r.command,
       SUBSTRING(t.text, 1, 300) AS 语句
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id <> @@SPID;
GO
