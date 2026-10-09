SET NOCOUNT ON;
SELECT DB_NAME() AS 库, N'wo_process_line 存在(应 1)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM sys.tables WHERE name=N'wo_process_line';
GO