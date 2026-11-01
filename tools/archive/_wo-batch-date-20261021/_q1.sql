SET NOCOUNT ON;
SELECT c.name AS col, t.name AS typ, c.max_length AS len
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.plang') ORDER BY c.column_id;
GO
SELECT TOP 30 id, pl_no, pl_xc, CONVERT(varchar(19), pl_date, 120) AS 单据日期,
       CONVERT(varchar(19), asp_time1, 120) AS 转单时间,
       ISNULL([批次号],N'') AS 批次号,
       CONVERT(varchar(19), [完工时间], 120) AS 完工时间,
       ISNULL([完工状态],N'') AS 完工状态,
       ISNULL(ja,N'') AS ja, pl_sl, rk_sl, ISNULL(dm,N'') AS dm
FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
ORDER BY id DESC;
