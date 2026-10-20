/* ============================================================
   _xe_trace_read.sql - 读「某个客户端执行过的语句」
   服务器上跑(按需要改最上面的 @host):
     sqlcmd -I -S localhost -E -d master -f i:65001 -i _xe_trace_read.sql -W -s " | "
   @host = 客户端主机名(会话表里的 host_name);给 N'*' 就是不过滤、全都出。
   看三件事:
     ① 它查库存用的是什么条件(按批号查?按存货编码查?)
     ② 它有没有发 INSERT / UPDATE
     ③ 每条语句的影响行数(row_count)
   ============================================================ */
SET NOCOUNT ON;

DECLARE @host nvarchar(120) = N'172_16_0_13';   -- ← 改这里;N'*' = 全部

IF NOT EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'yj_pick_trace')
    PRINT N'[提示] yj_pick_trace 当前不在运行(还没 start 或已 stop);若已 drop,下面是空表。';

;WITH ev AS (
    SELECT CAST(t.target_data AS xml) AS td
      FROM sys.dm_xe_session_targets t
      JOIN sys.dm_xe_sessions s ON s.address = t.event_session_address
     WHERE s.name = N'yj_pick_trace' AND t.target_name = N'ring_buffer'
), raw AS (
    SELECT x.e.value('@timestamp', 'datetime2(3)')                                  AS 时间,
           x.e.value('@name', 'nvarchar(60)')                                       AS 事件,
           x.e.value('(action[@name="client_hostname"]/value)[1]', 'nvarchar(120)')  AS 主机,
           x.e.value('(action[@name="client_app_name"]/value)[1]', 'nvarchar(120)')  AS 客户端,
           x.e.value('(action[@name="username"]/value)[1]', 'nvarchar(120)')         AS 登录名,
           x.e.value('(action[@name="database_name"]/value)[1]', 'nvarchar(120)')    AS 数据库,
           x.e.value('(data[@name="row_count"]/value)[1]', 'bigint')                 AS 影响行数,
           x.e.value('(action[@name="sql_text"]/value)[1]', 'nvarchar(2000)')        AS SQL文本
      FROM ev d
     CROSS APPLY d.td.nodes('//event') AS x(e)
)
SELECT TOP 100 时间, 事件, 主机, 客户端, 登录名, 数据库, 影响行数, SQL文本
  FROM raw
 WHERE (@host = N'*' OR 主机 = @host)
 ORDER BY 时间 DESC;
