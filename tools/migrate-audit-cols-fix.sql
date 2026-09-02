-- migrate-audit-cols-fix.sql — 补齐单据/档案表缺失的审计列
-- 症状:保存单据报「列名 'asp_user2' 无效」(UPDATE ... SET asp_user2/asp_time2)
-- 补列:asp_user2 nvarchar(50), asp_time2 datetime2;bl_so_order 另缺 asp_time1。
-- 幂等:只补缺失的列,可重复执行。
SET NOCOUNT ON;
DECLARE @t nvarchar(128), @sql nvarchar(max), @add nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
SELECT t.name FROM sys.tables t
WHERE EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = 'asp_user1')
  AND (NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = 'asp_user2')
    OR NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = 'asp_time2')
    OR NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = t.object_id AND c.name = 'asp_time1'));
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @add = N'';
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = 'asp_user2')
        SET @add = @add + N'asp_user2 nvarchar(50) NULL, ';
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = 'asp_time2')
        SET @add = @add + N'asp_time2 datetime2 NULL, ';
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name = 'asp_time1')
        SET @add = @add + N'asp_time1 datetime2 NULL, ';
    IF @add <> N''
    BEGIN
        SET @sql = N'ALTER TABLE ' + QUOTENAME(@t) + N' ADD ' + LEFT(@add, LEN(@add) - 1);
        EXEC sp_executesql @sql;
        PRINT N'patched: ' + @t;
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur;
DEALLOCATE cur;
