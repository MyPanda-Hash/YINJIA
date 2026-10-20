SET NOCOUNT ON;
DECLARE @pfx sysname = 'RB', @t2 sysname = 'day_report', @c2 sysname = N'单据编号';
DECLARE @sql nvarchar(max);
SET @sql = N'
            INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
            SELECT DISTINCT ''0'', h.[' + @c2 + N'],
                   LEFT(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) - 1),
                   SUBSTRING(h.[' + @c2 + N'], CHARINDEX(''-'', h.[' + @c2 + N']) + 1, 7),
                   ''formno-sync'', GETDATE(), ''N''
              FROM [' + @t2 + N'] h
             WHERE h.[' + @c2 + N'] LIKE ''' + @pfx + N'-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'''
               AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[' + @c2 + N']);';
SELECT @sql AS sql_text;
