/* ============================================================
   _xe_stop.sql - 停止并删除抓取会话
   服务器上跑:
     sqlcmd -I -S localhost -E -d master -f i:65001 -i _xe_stop.sql -W
   ============================================================ */
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.dm_xe_sessions WHERE name = N'yj_pick_watch')
BEGIN
    ALTER EVENT SESSION [yj_pick_watch] ON SERVER STATE = STOP;
    PRINT N'[OK] 会话已停止';
END
GO

IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = N'yj_pick_watch')
BEGIN
    DROP EVENT SESSION [yj_pick_watch] ON SERVER;
    PRINT N'[OK] 会话已删除';
END
GO
