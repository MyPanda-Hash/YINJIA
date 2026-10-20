/* ============================================================
   _xe_trace_start.sql - 抓「某个客户端到底执行了什么 SQL」(不只是错误)
   服务器上跑:
     sqlcmd -I -S localhost -E -d master -f i:65001 -i _xe_trace_start.sql -W
   然后让现场在小程序上点一次领料,再跑 _xe_trace_read.sql 看它执行的每一条语句。

   用途:上一轮只抓到错误(18456 噪声),说明那个 .NET 客户端(172.16.0.13 / sa)
         的语句**没报错** —— 那就得看它执行的到底是哪些 SELECT、有没有 INSERT。
   抓什么:sql_batch_completed / rpc_completed(带 sql_text、主机、客户端、登录、影响行数)
   存在哪:ring_buffer 8MB,内存里;停掉/删会话即无痕。
   ============================================================ */
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'yj_pick_trace')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'yj_pick_trace')
        ALTER EVENT SESSION [yj_pick_trace] ON SERVER STATE = STOP;
    DROP EVENT SESSION [yj_pick_trace] ON SERVER;
    PRINT N'[重建] 已删除旧的 yj_pick_trace 会话';
END
GO

CREATE EVENT SESSION [yj_pick_trace] ON SERVER
ADD EVENT sqlserver.sql_batch_completed
(
    ACTION
    (
        sqlserver.sql_text,
        sqlserver.client_app_name,
        sqlserver.client_hostname,
        sqlserver.username,
        sqlserver.database_name
    )
    WHERE ([database_name] = N'HSDZ_MES' OR [database_name] = N'HSDZ_MES_TEST')
),
ADD EVENT sqlserver.rpc_completed
(
    ACTION
    (
        sqlserver.sql_text,
        sqlserver.client_app_name,
        sqlserver.client_hostname,
        sqlserver.username,
        sqlserver.database_name
    )
    WHERE ([database_name] = N'HSDZ_MES' OR [database_name] = N'HSDZ_MES_TEST')
)
ADD TARGET package0.ring_buffer (SET max_memory = 8192)
WITH (MAX_DISPATCH_LATENCY = 3 SECONDS, STARTUP_STATE = OFF);
GO

ALTER EVENT SESSION [yj_pick_trace] ON SERVER STATE = START;
GO

SELECT N'[OK] 已开始记录语句;现在去小程序点一次领料,再跑 _xe_trace_read.sql' AS 结果,
       (SELECT COUNT(*) FROM sys.dm_xe_sessions WHERE name = N'yj_pick_trace') AS 运行中的会话数;
