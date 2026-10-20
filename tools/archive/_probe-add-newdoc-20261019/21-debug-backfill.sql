SET NOCOUNT ON;
DECLARE @pfx sysname, @t2 sysname, @c2 sysname, @sql nvarchar(max), @n int, @total int = 0, @i int = 0;
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT prefix, CASE WHEN head_table IS NOT NULL THEN head_table ELSE line_table END, group_col
      FROM yj_panel
     WHERE prefix IS NOT NULL AND group_col IS NOT NULL
       AND (head_table IS NOT NULL OR line_table IS NOT NULL);
OPEN cur2 FETCH NEXT FROM cur2 INTO @pfx, @t2, @c2;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t2) IS NOT NULL AND COL_LENGTH(@t2, @c2) IS NOT NULL
    BEGIN
        SET @sql = N'
            INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
            SELECT DISTINCT ''0'', h.[' + @c2 + N'],
                   LEFT(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) - 1),
                   SUBSTRING(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) + 1, 7),
                   ''formno-sync'', GETDATE(), ''N''
              FROM [' + @t2 + N'] h
             WHERE h.[' + @c2 + N'] LIKE ''' + @pfx + N'-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'''
               AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[' + @c2 + N']);';
        IF @i < 1 SELECT @sql AS first_sql;
        IF @i < 1 BEGIN SET @i = 1; END
        BEGIN TRY
            EXEC sp_executesql @sql;
            SET @n = @@ROWCOUNT;
            IF @n > 0 SET @total = @total + @n;
        END TRY
        BEGIN CATCH
            SELECT 'ERR ' + @pfx + ' / ' + @t2 + ' : ' + ERROR_MESSAGE() AS step, @sql AS sql_;
            RETURN;
        END CATCH
    END
    FETCH NEXT FROM cur2 INTO @pfx, @t2, @c2;
END
CLOSE cur2 DEALLOCATE cur2;
SELECT 'TOTAL ' + CAST(@total AS varchar(20)) AS step;
