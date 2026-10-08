SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#hit') IS NOT NULL DROP TABLE #hit;
CREATE TABLE #hit (表名 sysname, 列名 sysname, 值 nvarchar(200), 行数 int);
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql
    + N'INSERT #hit SELECT ''' + t.name + N''',''' + c.name + N''', v.v, COUNT(*) FROM ['
    + s.name + N'].[' + t.name + N'] x JOIN (VALUES (N''CK01''),(N''CK02''),(N''CK03''),(N''CK04''),(N''CK05''),(N''CK00001'')) v(v)'
    + N' ON RTRIM(x.[' + c.name + N']) = v.v GROUP BY v.v HAVING COUNT(*) > 0;'
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE c.name IN (N'仓库', N'仓库编码', N'仓库名称', N'ckdm', N'目标仓库', N'原仓库')
  AND c.system_type_id IN (231, 239, 167, 175);
EXEC sp_executesql @sql;
SELECT 表名, 列名, 值, 行数 FROM #hit ORDER BY 表名, 列名, 值;
