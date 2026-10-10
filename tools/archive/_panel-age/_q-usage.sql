SET NOCOUNT ON;
-- _q-usage.sql — 候选老面板的「实际使用度」取证(只读):业务表行数 / 角色授权 / 单据状态 / 字段数
DECLARE @codes TABLE (code varchar(40) PRIMARY KEY);
INSERT INTO @codes(code) VALUES
 ('QC_OP'),('QC_RECORD'),('QC_DISPOSAL'),('ROD_RETURN'),('LOT_TRACE'),
 ('SALES_ORDER_DETAIL'),('SALES_ORDER_STATS'),
 ('PURCHASE_IN_DETAIL'),('FINISH_IN_DETAIL'),('OTHER_IN_DETAIL'),('OUTSOURCE_IN_DETAIL'),
 ('SALE_OUT_DETAIL'),('MATERIAL_OUT_DETAIL'),('OTHER_OUT_DETAIL'),('OUTSOURCE_ISSUE_DETAIL'),
 ('PURCHASE_IN_STATS'),('FINISH_IN_STATS'),('OTHER_IN_STATS'),('OUTSOURCE_IN_STATS'),
 ('SALE_OUT_STATS'),('MATERIAL_OUT_STATS'),('OTHER_OUT_STATS'),('OUTSOURCE_ISSUE_STATS'),
 ('STOCK_BALANCE'),('STOCK_SUMMARY');

CREATE TABLE #out (code varchar(40), head_tbl sysname, head_rows int, line_tbl sysname, line_rows int,
                   grants int, doc_rows int, last_doc datetime, fields int);

DECLARE @c varchar(40), @h sysname, @l sysname, @sql nvarchar(400), @hr int, @lr int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT code FROM @codes ORDER BY code;
OPEN cur;
FETCH NEXT FROM cur INTO @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @h = (SELECT head_table FROM yj_panel WHERE panel_code = @c);
  SET @l = (SELECT line_table FROM yj_panel WHERE panel_code = @c);
  SET @hr = NULL; SET @lr = NULL;
  IF @h IS NOT NULL AND OBJECT_ID(@h) IS NOT NULL
  BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@h);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @hr OUTPUT;
  END
  IF @l IS NOT NULL AND OBJECT_ID(@l) IS NOT NULL
  BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@l);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @lr OUTPUT;
  END
  INSERT INTO #out
  SELECT @c, ISNULL(@h,''), @hr, ISNULL(@l,''), @lr,
         (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = @c),
         (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = @c),
         (SELECT MAX(update_at) FROM yj_doc_status WHERE panel_code = @c),
         (SELECT COUNT(*) FROM yj_field WHERE panel_code = @c);
  FETCH NEXT FROM cur INTO @c;
END
CLOSE cur; DEALLOCATE cur;
DECLARE @cnt int = (SELECT COUNT(*) FROM #out);
PRINT N'populated rows = ' + CAST(@cnt AS varchar(10));
GO
SELECT code, head_tbl, head_rows, line_tbl, line_rows,
       grants, doc_rows, CONVERT(varchar(19), last_doc, 120) AS last_doc, fields
FROM #out ORDER BY code;
