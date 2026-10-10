SET NOCOUNT ON;
-- _q-qc-unused.sql — 品质管理 制程品质/不良处理/品质追溯 5 张面板的「用到没有」取证(只读)
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES ('QC_OP'),('QC_RECORD'),('QC_DISPOSAL'),('ROD_RETURN'),('LOT_TRACE');
GO
-- ① 面板元数据 + 授权
SELECT p.panel_code, p.panel_name, p.mode, RTRIM(ISNULL(p.head_table,'')) AS head_table,
       RTRIM(ISNULL(p.line_table,'')) AS line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 字段行,
       (SELECT COUNT(*) FROM yj_role_panel r WHERE r.panel_code = p.panel_code) AS 授权行,
       (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code = p.panel_code) AS 单据状态行
FROM yj_panel p JOIN #p x ON x.code = p.panel_code ORDER BY p.panel_code;
GO
-- ② 业务表行数
DECLARE @t TABLE (name sysname);
INSERT INTO @t(name) VALUES ('qc_op'),('qc_op_detail'),('qc_record'),('qc_record_detail'),
 ('qc_disposal'),('rod_return'),('rod_return_detail'),('v_lot_trace');
CREATE TABLE #r (name sysname, n int);
DECLARE @nm sysname, @sql nvarchar(300), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @t;
OPEN cur; FETCH NEXT FROM cur INTO @nm;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@nm) IS NULL INSERT INTO #r VALUES (@nm, -1);
  ELSE BEGIN
    SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@nm);
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    INSERT INTO #r VALUES (@nm, @n);
  END
  FETCH NEXT FROM cur INTO @nm;
END
CLOSE cur; DEALLOCATE cur;
GO
SELECT name, CASE WHEN n = -1 THEN 'MISSING' ELSE CAST(n AS varchar(10)) END AS rows_ FROM #r ORDER BY name;
GO
-- ③ 别的面板有没有「参照/生单」指向这 5 张
SELECT N'被参照(ref_panel)' AS 关系, f.panel_code AS 来源面板, f.label
FROM yj_field f JOIN #p x ON x.code = f.ref_panel
UNION ALL
SELECT N'生单链路 form_flow_link', source_panel_code + N' → ' + target_panel_code, CAST(COUNT(*) AS nvarchar(10))
FROM dbo.form_flow_link
WHERE source_panel_code IN (SELECT code FROM #p) OR target_panel_code IN (SELECT code FROM #p)
GROUP BY source_panel_code, target_panel_code;
GO
-- ④ 使用日志:这些面板有没有被打开过(表若为空则无从判定)
SELECT N'yj_usage_log 总行数' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM yj_usage_log
UNION ALL SELECT N'其中这 5 张面板', CAST(COUNT(*) AS nvarchar(10)) FROM yj_usage_log
  WHERE panel_name IN (SELECT panel_name FROM yj_panel WHERE panel_code IN (SELECT code FROM #p));
GO
-- ⑤ 批号追溯视图:它到底追溯什么、有多少真数据
SELECT N'v_lot_trace 可见行(未作废)' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM dbo.v_lot_trace WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
SELECT TOP 8 * FROM dbo.v_lot_trace ORDER BY id;
