SET NOCOUNT ON;
DECLARE @tbl sysname, @col sysname, @sql nvarchar(max), @colsH nvarchar(max), @colsX nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT head_table, group_col FROM yj_panel
     WHERE head_table IS NOT NULL AND group_col IS NOT NULL AND prefix IS NOT NULL;
OPEN cur FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@tbl) IS NOT NULL AND COL_LENGTH(@tbl, @col) IS NOT NULL
    BEGIN
        SET @colsH = NULL; SET @colsX = NULL;
        SELECT @colsH = STRING_AGG('h.[' + c.name + N'] IS NULL', N' AND '),
               @colsX = STRING_AGG('x.[' + c.name + N'] IS NULL', N' AND ')
          FROM sys.columns c
         WHERE c.object_id = OBJECT_ID(@tbl)
           AND c.name NOT IN ('id', @col, N'单据日期', N'单据状态', N'创建时间', N'更新时间',
                              'asp_user1','asp_time1','asp_user2','asp_time2',
                              'asp_user3','asp_time3','asp_user4','asp_time4',
                              'asp_cancel','asp_print')
           AND c.name NOT LIKE N'备用%';
        IF @colsH IS NULL PRINT N'[SKIP-NULLCOLS] ' + @tbl;
        ELSE
        BEGIN
            SET @sql = N'DELETE h FROM [' + @tbl + N'] h WHERE h.[' + @col + N'] IN (
                       SELECT [k] FROM (SELECT [' + @col + N'] AS [k] FROM [' + @tbl + N'] GROUP BY [' + @col + N'] HAVING COUNT(*) > 1) d)
                   AND ' + @colsH + N'
                   AND EXISTS (SELECT 1 FROM [' + @tbl + N'] x
                                WHERE x.[' + @col + N'] = h.[' + @col + N'] AND NOT (' + @colsX + N'));';
            SELECT 'TRY ' + @tbl AS step;
            BEGIN TRY
                EXEC sp_executesql @sql;
                PRINT N'[OK] ' + @tbl + N' deleted=' + CAST(@@ROWCOUNT AS nvarchar(10));
            END TRY
            BEGIN CATCH
                SELECT 'ERR ' + @tbl + ' : ' + ERROR_MESSAGE() AS step;
                PRINT @sql;
            END CATCH
        END
    END
    FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur DEALLOCATE cur;
