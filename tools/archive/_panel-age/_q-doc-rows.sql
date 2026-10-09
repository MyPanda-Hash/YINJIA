SET NOCOUNT ON;
DECLARE @t TABLE (tbl sysname);
INSERT INTO @t(tbl) VALUES ('bd_purchase_in'),('bd_finish_in'),('bd_other_in'),('bd_outsource_in'),('bd_sale_out'),('bd_material_out'),('bd_other_out'),('bd_outsource_issue'),('bd_so_order'),('bd_pu_order'),('bd_pu_req'),('qc_recv'),('qc_insp'),('qc_return'),('qc_tc_in'),('qc_bhg'),('qc_bhc'),('qc_bhz'),('qc_jjf'),('qc_scp'),('qc_lyb'),('qc_scy'),('qc_catalog'),('qc_insp_rec'),('qc_insp_req');
CREATE TABLE #r (tbl sysname, n int);
DECLARE @tb sysname, @sql nvarchar(300), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl FROM @t;
OPEN cur; FETCH NEXT FROM cur INTO @tb;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@tb) IS NOT NULL
  BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@tb);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    INSERT INTO #r VALUES (@tb, @n);
  END
  ELSE INSERT INTO #r VALUES (@tb, -1);
  FETCH NEXT FROM cur INTO @tb;
END
CLOSE cur; DEALLOCATE cur;
GO
SELECT tbl, CASE WHEN n = -1 THEN 'MISSING' ELSE CAST(n AS varchar(10)) END AS rows_ FROM #r ORDER BY tbl;

