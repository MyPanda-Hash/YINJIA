/* ============================================================
   _xe_start.sql - 开始抓取「写库失败」的现场(只抓错误,不改任何业务数据)
   服务器上跑:
     sqlcmd -I -S localhost -E -d master -f i:65001 -i _xe_start.sql -W
   然后让现场在小程序上扫一次料,再跑 _xe_read.sql 看抓到了什么。

   抓什么:SQL Server 报出的错误(2601 唯一键重复 / 2627 主键 / 1934 SET 选项 /
           515 必填为空 / 547 约束 / 229 权限 / 18456 登录 / 8152 截断 等),
           连同**客户端程序名、主机名、登录名、数据库、出错的 SQL 原文**一起记下来。
   存在哪:ring_buffer(内存 4MB),服务器重启即消失;不写文件、不碰业务表。
   停/删:  _xe_stop.sql
   ============================================================ */
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'yj_pick_watch')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'yj_pick_watch')
        ALTER EVENT SESSION [yj_pick_watch] ON SERVER STATE = STOP;
    DROP EVENT SESSION [yj_pick_watch] ON SERVER;
    PRINT N'[重建] 已删除旧的 yj_pick_watch 会话';
END
GO

CREATE EVENT SESSION [yj_pick_watch] ON SERVER
ADD EVENT sqlserver.error_reported
(
    ACTION
    (
        sqlserver.sql_text,
        sqlserver.client_app_name,
        sqlserver.client_hostname,
        sqlserver.username,
        sqlserver.database_name
    )
    WHERE
    (
        [error_number] = 2601 OR [error_number] = 2627 OR [error_number] = 2628
        OR [error_number] = 1934 OR [error_number] = 515 OR [error_number] = 547
        OR [error_number] = 229 OR [error_number] = 230 OR [error_number] = 18456
        OR [error_number] = 4060 OR [error_number] = 8152 OR [error_number] = 245
        OR [error_number] = 241 OR [error_number] = 102 OR [error_number] = 207
        OR [error_number] = 208 OR [error_number] = 537 OR [error_number] = 3609
    )
)
ADD TARGET package0.ring_buffer (SET max_memory = 4096)
WITH (MAX_DISPATCH_LATENCY = 5 SECONDS, STARTUP_STATE = OFF);
GO

ALTER EVENT SESSION [yj_pick_watch] ON SERVER STATE = START;
GO

SELECT N'[OK] 已开始抓取;现在去小程序扫码,扫完回来看 _xe_read.sql' AS 结果,
       (SELECT COUNT(*) FROM sys.dm_xe_sessions WHERE name = N'yj_pick_watch') AS 运行中的会话数;
