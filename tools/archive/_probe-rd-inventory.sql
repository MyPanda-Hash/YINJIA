SET NOCOUNT ON;
-- 研发管理模块(RD_*)单据盘点:逐面板数头表与行表行数
DECLARE @code nvarchar(64), @name nvarchar(200), @head sysname, @line sysname, @sql nvarchar(400);
CREATE TABLE #r (panel nvarchar(64), pname nvarchar(200), head_tbl sysname, head_n int, line_tbl sysname, line_n int);
DECLARE cur CURSOR FOR
  SELECT panel_code, panel_name, head_table, line_table FROM yj_panel
   WHERE panel_code LIKE N'RD[_]%' ORDER BY panel_code;
OPEN cur;
FETCH NEXT FROM cur INTO @code, @name, @head, @line;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @hn int = NULL, @ln int = NULL, @s nvarchar(400);
  IF @head IS NOT NULL AND OBJECT_ID(@head) IS NOT NULL
  BEGIN
    SET @s = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@head);
    EXEC sp_executesql @s, N'@x int OUTPUT', @hn OUTPUT;
  END
  IF @line IS NOT NULL AND OBJECT_ID(@line) IS NOT NULL
  BEGIN
    SET @s = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@line);
    EXEC sp_executesql @s, N'@x int OUTPUT', @ln OUTPUT;
  END
  INSERT INTO #r VALUES (@code, @name, @head, @hn, @line, @ln);
  FETCH NEXT FROM cur INTO @code, @name, @head, @line;
END
CLOSE cur; DEALLOCATE cur;

SELECT panel AS 面板, pname AS 面板名, ISNULL(head_tbl, N'—') AS 头表, ISNULL(CAST(head_n AS nvarchar(10)), N'—') AS 头表行数,
       ISNULL(line_tbl, N'—') AS 行表, ISNULL(CAST(line_n AS nvarchar(10)), N'—') AS 行表行数
FROM #r ORDER BY (ISNULL(head_n,0) + ISNULL(line_n,0)) DESC, panel;

SELECT N'—— 按头表行数汇总 ——' AS 项;
SELECT N'有单据的研发面板数 = ' + CAST(COUNT(*) AS nvarchar(6)) FROM #r WHERE ISNULL(head_n,0) > 0;
SELECT N'研发头表合计行数 = ' + CAST(ISNULL(SUM(head_n),0) AS nvarchar(10)) FROM #r;
SELECT N'研发行表合计行数 = ' + CAST(ISNULL(SUM(line_n),0) AS nvarchar(10)) FROM #r;
DROP TABLE #r;
