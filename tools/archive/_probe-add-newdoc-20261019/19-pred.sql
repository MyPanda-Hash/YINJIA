SET NOCOUNT ON;
DECLARE @tbl sysname = 'sl_recv', @col sysname = N'单据编号', @colsH nvarchar(max), @colsX nvarchar(max);
SELECT @colsH = STRING_AGG('h.[' + c.name + N'] IS NULL', N' AND '),
       @colsX = STRING_AGG('x.[' + c.name + N'] IS NULL', N' AND ')
  FROM sys.columns c
 WHERE c.object_id = OBJECT_ID(@tbl)
   AND c.name NOT IN ('id', @col, N'单据日期', N'单据状态', N'创建时间', N'更新时间',
                      'asp_user1','asp_time1','asp_user2','asp_time2',
                      'asp_user3','asp_time3','asp_user4','asp_time4',
                      'asp_cancel','asp_print')
   AND c.name NOT LIKE N'备用%';
SELECT LEN(@colsH) len, @colsH pred;
DECLARE @sql nvarchar(max) = N'SELECT COUNT(*) FROM [' + @tbl + N'] h WHERE h.[' + @col + N'] IN (SELECT [k] FROM (SELECT [' + @col + N'] AS [k] FROM [' + @tbl + N'] GROUP BY [' + @col + N'] HAVING COUNT(*) > 1) d) AND ' + @colsH + N';';
SELECT @sql;
EXEC sp_executesql @sql;
