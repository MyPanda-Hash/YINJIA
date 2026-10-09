SET NOCOUNT ON;
DELETE FROM yj_schema_log WHERE script_name LIKE N'%rename-back-loc%';
PRINT N'  删除 rename-back-loc 链记录 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';
SELECT N'rename-back-loc 链记录残留(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM yj_schema_log WHERE script_name LIKE N'%rename-back-loc%';
GO