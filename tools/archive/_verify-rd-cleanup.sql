SET NOCOUNT ON;
-- 研发模块清理后的独立核对(不信脚本报数,直接查库)
DECLARE @code nvarchar(64), @head sysname, @line sysname, @s nvarchar(400), @hn int, @ln int;
-- ⚠ 别用 sysname 声明可空列:sysname 在 SQL Server 里是 nvarchar(128) **NOT NULL** 的别名类型,
--   无 head_table 的面板(RD_ASM_BOM / RD_MOLD_FORMULA / RD_SINTER_TOL)插进去会报 515 并终止余下插入
CREATE TABLE #r (panel nvarchar(64), head_tbl nvarchar(128) NULL, hn int, line_tbl nvarchar(128) NULL, ln int);
DECLARE cur CURSOR FOR SELECT panel_code, head_table, line_table FROM yj_panel
   WHERE panel_code LIKE N'RD[_]%' ORDER BY panel_code;
OPEN cur; FETCH NEXT FROM cur INTO @code, @head, @line;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @hn = NULL; SET @ln = NULL;
  IF @head IS NOT NULL AND OBJECT_ID(@head) IS NOT NULL
  BEGIN SET @s = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@head);
        EXEC sp_executesql @s, N'@x int OUTPUT', @hn OUTPUT; END
  IF @line IS NOT NULL AND OBJECT_ID(@line) IS NOT NULL
  BEGIN SET @s = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@line);
        EXEC sp_executesql @s, N'@x int OUTPUT', @ln OUTPUT; END
  INSERT INTO #r VALUES (@code, @head, @hn, @line, @ln);
  FETCH NEXT FROM cur INTO @code, @head, @line;
END
CLOSE cur; DEALLOCATE cur;

SELECT N'[残留>0 的研发业务表]' AS 类别, panel AS 面板, ISNULL(head_tbl,N'—') AS 头表, ISNULL(CAST(hn AS nvarchar(10)),N'—') AS 头表行数,
       ISNULL(line_tbl,N'—') AS 行表, ISNULL(CAST(ln AS nvarchar(10)),N'—') AS 行表行数
  FROM #r WHERE ISNULL(hn,0) > 0 OR ISNULL(ln,0) > 0
UNION ALL
SELECT N'[汇总]', N'研发头表合计', N'', CAST(ISNULL(SUM(hn),0) AS nvarchar(10)), N'研发行表合计', CAST(ISNULL(SUM(ln),0) AS nvarchar(10))
  FROM #r;

SELECT N'—— 流程留痕残留(应为 0) ——' AS 项;
SELECT N'yj_doc_status(RD_)' AS 表, CAST(COUNT(*) AS nvarchar(10)) AS 残留 FROM yj_doc_status   WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'yj_form_approval(RD_)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_form_approval WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'yj_doc_modify_log(RD_)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_modify_log WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'yjmessages(指向已删RD单)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_message m
   WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.doc_no = m.单据编号);

SELECT N'—— 必须保留项 ——' AS 项;
SELECT N'rd_progress 头行(应=1)' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_progress
UNION ALL SELECT N'rd_progress_detail(应=0)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_progress_detail
UNION ALL SELECT N'rd_sinter_tolerance 规格字典(应=60)', CAST(COUNT(*) AS nvarchar(10)) FROM rd_sinter_tolerance
UNION ALL SELECT N'RD_* 面板元数据(应=26)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_panel WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'RD_* 字段元数据(应=866)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field WHERE panel_code LIKE N'RD[_]%'
UNION ALL SELECT N'号池 s_allno(不动)', CAST(COUNT(*) AS nvarchar(10)) FROM s_allno;
DROP TABLE #r;
