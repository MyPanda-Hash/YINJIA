SET NOCOUNT ON;
DECLARE @ny nvarchar(7) = CONVERT(nvarchar(7), GETDATE(), 120);   -- yyyy-MM
SELECT DB_NAME() AS db, @ny AS 当前月,
       (SELECT MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno
         WHERE lb = N'LL' AND ny = @ny AND dh LIKE N'LL-' + @ny + N'-%')           AS 当月已用最大序号,
       N'LL-' + @ny + N'-' + RIGHT(N'0000' + CAST(ISNULL((SELECT MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno
         WHERE lb = N'LL' AND ny = @ny AND dh LIKE N'LL-' + @ny + N'-%'), 0) + 1 AS nvarchar(10)), 4) AS 下一个号;
