SET NOCOUNT ON;
DECLARE @col sysname, @sql nvarchar(max), @cnt bigint;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT c.name FROM HSDZ_MES.sys.columns c JOIN HSDZ_MES.sys.tables t ON t.object_id=c.object_id
  WHERE t.name='inv_cost_ledger' AND c.name NOT IN ('src','rid') ORDER BY c.column_id;
OPEN cur; FETCH NEXT FROM cur INTO @col;
WHILE @@FETCH_STATUS=0
BEGIN
  SET @sql = N'SELECT @cnt=COUNT_BIG(*) FROM HSDZ_MES.dbo.inv_cost_ledger a
    JOIN HSDZ_MES_SRV1017.dbo.inv_cost_ledger b ON b.src=a.src AND b.rid=a.rid
    WHERE (a.[' + @col + N'] <> b.[' + @col + N'])
       OR (a.[' + @col + N'] IS NULL AND b.[' + @col + N'] IS NOT NULL)
       OR (a.[' + @col + N'] IS NOT NULL AND b.[' + @col + N'] IS NULL)';
  BEGIN TRY
    EXEC sp_executesql @sql, N'@cnt bigint OUTPUT', @cnt OUTPUT;
    IF @cnt>0 PRINT '  ' + @col + ' 差异行=' + CAST(@cnt AS varchar);
  END TRY BEGIN CATCH PRINT '  ' + @col + ' ERR'; END CATCH
  FETCH NEXT FROM cur INTO @col;
END
CLOSE cur; DEALLOCATE cur;

PRINT '--- 示例 3 条差异行 ---';
SELECT TOP 3 'LOC' AS 来源, src, rid, 存货编码, 批号, 单据日期, 收入数量, 结存数量, 移动加权单价, 结存金额, 重算时间
FROM HSDZ_MES.dbo.inv_cost_ledger a
WHERE EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.dbo.inv_cost_ledger b
              WHERE b.src=a.src AND b.rid=a.rid AND (a.移动加权单价<>b.移动加权单价 OR a.重算时间<>b.重算时间))
ORDER BY src, rid;
SELECT TOP 3 'SRV' AS 来源, src, rid, 存货编码, 批号, 单据日期, 收入数量, 结存数量, 移动加权单价, 结存金额, 重算时间
FROM HSDZ_MES_SRV1017.dbo.inv_cost_ledger b
WHERE EXISTS (SELECT 1 FROM HSDZ_MES.dbo.inv_cost_ledger a
              WHERE b.src=a.src AND b.rid=a.rid AND (a.移动加权单价<>b.移动加权单价 OR a.重算时间<>b.重算时间))
ORDER BY src, rid;
