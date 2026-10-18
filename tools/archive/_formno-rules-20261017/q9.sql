SET NOCOUNT ON;
PRINT '== 各单据表 单号形态分布(前缀段-形态计数) ==';
DECLARE @t TABLE(tbl sysname, headcol sysname);
INSERT INTO @t VALUES
 (N'bd_purchase_in',N'单据编号'),(N'bd_sale_out',N'单据编号'),(N'bd_so_order',N'单据编号'),
 (N'bd_pu_order',N'单据编号'),(N'bd_finish_in',N'单据编号'),(N'bd_material_out',N'单据编号'),
 (N'bd_other_in',N'单据编号'),(N'bd_other_out',N'单据编号'),(N'sl_recv',N'单据编号'),
 (N'qc_insp',N'单据编号'),(N'qc_return',N'单据编号'),(N'bd_dispatch',N'单据编号'),
 (N'qc_proc_insp',N'单据编号'),(N'qc_first_insp_head',N'单据编号'),(N'qc_insp_rec',N'单据编号'),
 (N'qc_catalog',N'单据编号'),(N'qc_tc_in',N'单据编号'),(N'rd_spec_doc_head',N'单据编号');
DECLARE @tbl sysname, @col sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, headcol FROM @t;
OPEN cur; FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT ''' + @tbl + ''' AS tbl,'
   + N' CASE WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'' THEN N''前缀-yyyy-MM-NNNN(MES新)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'' THEN N''前缀-yyyyMMdd-NNNNN(金蝶)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''[A-Z][A-Z][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'' THEN N''前缀+yyMMdd+NNNN(遗留紧凑)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'' THEN N''前缀-yyyy-MM-NN'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''[A-Z][A-Z]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9]'' THEN N''前缀-yyyyMMdd-NN'''
   + N'      ELSE N''其它/空'' END AS shape, COUNT(*) AS cnt, MIN(' + QUOTENAME(@col) + N') AS sample'
   + N' FROM dbo.' + QUOTENAME(@tbl) + N' WHERE ISNULL(asp_cancel,''N'')<>''Y'' GROUP BY CASE WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'' THEN N''前缀-yyyy-MM-NNNN(MES新)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9]'' THEN N''前缀-yyyyMMdd-NNNNN(金蝶)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''[A-Z][A-Z][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'' THEN N''前缀+yyMMdd+NNNN(遗留紧凑)'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'' THEN N''前缀-yyyy-MM-NN'''
   + N'      WHEN ' + QUOTENAME(@col) + N' LIKE N''[A-Z][A-Z]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9]'' THEN N''前缀-yyyyMMdd-NN'''
   + N'      ELSE N''其它/空'' END';
  EXEC sp_executesql @sql;
  FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur; DEALLOCATE cur;
