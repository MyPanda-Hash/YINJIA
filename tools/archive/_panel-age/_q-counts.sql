SET NOCOUNT ON;
SELECT DB_NAME() AS db, (SELECT COUNT(*) FROM sys.tables) AS 表数, (SELECT COUNT(*) FROM sys.views) AS 视图数, (SELECT COUNT(*) FROM yj_panel) AS 面板数;
