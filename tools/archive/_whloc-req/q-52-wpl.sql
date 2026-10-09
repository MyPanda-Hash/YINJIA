SET NOCOUNT ON;
SELECT N'wo_process_line 表是否存在(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM sys.tables WHERE name=N'wo_process_line';
GO