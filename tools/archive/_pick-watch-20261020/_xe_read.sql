/* ============================================================
   _xe_read.sql - 读「写库失败」抓到的现场
   服务器上跑:
     sqlcmd -I -S localhost -E -d master -f i:65001 -i _xe_read.sql -W -s " | "
   需要先是 start 过(_xe_start.sql)、并且已经让现场扫过料。
   ============================================================ */
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'yj_pick_watch')
    PRINT N'[提示] 会话当前不在运行(要么还没 start,要么已 stop)。若已 drop,下面会是空表。';

;WITH ev AS (
    SELECT CAST(t.target_data AS xml) AS td
      FROM sys.dm_xe_session_targets t
      JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
     WHERE s.name = N'yj_pick_watch' AND t.target_name = N'ring_buffer'
)
SELECT TOP 50
       x.e.value('@timestamp', 'datetime2(3)')                                     AS 时间,
       x.e.value('(data[@name="error_number"]/value)[1]', 'int')                   AS 错误号,
       x.e.value('(data[@name="severity"]/value)[1]', 'int')                       AS 级别,
       x.e.value('(data[@name="message"]/value)[1]', 'nvarchar(500)')              AS 错误消息,
       x.e.value('(action[@name="database_name"]/value)[1]', 'nvarchar(120)')      AS 数据库,
       x.e.value('(action[@name="client_app_name"]/value)[1]', 'nvarchar(120)')    AS 客户端程序,
       x.e.value('(action[@name="client_hostname"]/value)[1]', 'nvarchar(120)')    AS 客户端主机,
       x.e.value('(action[@name="username"]/value)[1]', 'nvarchar(120)')           AS 登录名,
       x.e.value('(action[@name="sql_text"]/value)[1]', 'nvarchar(1500)')          AS SQL文本
  FROM ev d
 CROSS APPLY d.td.nodes('//event') AS x(e)
 ORDER BY 时间 DESC;
