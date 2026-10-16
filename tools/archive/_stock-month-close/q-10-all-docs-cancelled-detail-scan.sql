-- q-10-all-docs-cancelled-detail-scan.sql — 全库扫描:单头有效、明细却全部作废的单据(界面表现为"明细为空")
-- 口径:遍历 yj_panel 里 mode='doc' 的面板,拿 line_table 与其"头表"(去掉 _detail/_line 后缀),
--       按 单据编号 关联,统计每张单的 作废行/有效行;只报「作废行>0 且 有效行=0」的单。
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#doc') IS NOT NULL DROP TABLE #doc;
CREATE TABLE #doc (panel_code sysname, panel_name nvarchar(50), head_tbl sysname, line_tbl sysname,
                   head_key sysname, line_key sysname);
INSERT INTO #doc (panel_code, panel_name, head_tbl, line_tbl, head_key, line_key)
SELECT p.panel_code, p.panel_name,
       CASE WHEN p.line_table LIKE '%[_]detail' THEN LEFT(p.line_table, LEN(p.line_table) - 7)
            WHEN p.line_table LIKE '%[_]line'   THEN LEFT(p.line_table, LEN(p.line_table) - 5)
            ELSE p.line_table END,
       p.line_table,
       CASE WHEN COL_LENGTH(p.line_table, '单据编号') IS NOT NULL THEN '单据编号' ELSE '单号' END,
       CASE WHEN COL_LENGTH(p.line_table, '单据编号') IS NOT NULL THEN '单据编号' ELSE '单号' END
FROM yj_panel p
WHERE p.mode = 'doc' AND p.line_table IS NOT NULL AND p.line_table <> ''
  AND COL_LENGTH(p.line_table, 'asp_cancel') IS NOT NULL;

DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'
SELECT ''' + panel_code + N''' AS 面板, ''' + panel_name + N''' AS 面板名, ''' + line_tbl + N''' AS 明细表,
       COUNT(*) AS 全空单数, MAX(t.最近作废) AS 最近作废时间
FROM (
  SELECT h.[' + head_key + N'] AS 单号, MAX(d.asp_time2) AS 最近作废,
         SUM(CASE WHEN ISNULL(d.asp_cancel, N''N'') = N''Y'' THEN 1 ELSE 0 END) AS 作废行,
         SUM(CASE WHEN ISNULL(d.asp_cancel, N''N'') <> N''Y'' THEN 1 ELSE 0 END) AS 有效行
  FROM [' + head_tbl + N'] h JOIN [' + line_tbl + N'] d ON d.[' + line_key + N'] = h.[' + head_key + N']
  GROUP BY h.[' + head_key + N']
  HAVING SUM(CASE WHEN ISNULL(d.asp_cancel, N''N'') <> N''Y'' THEN 1 ELSE 0 END) = 0
     AND SUM(CASE WHEN ISNULL(d.asp_cancel, N''N'') = N''Y'' THEN 1 ELSE 0 END) > 0
) t
UNION ALL'
FROM #doc d
WHERE OBJECT_ID(d.head_tbl) IS NOT NULL
  AND COL_LENGTH(d.head_tbl, d.head_key) IS NOT NULL
  AND COL_LENGTH(d.head_tbl, 'asp_cancel') IS NOT NULL;

IF LEN(@sql) = 0 BEGIN PRINT N'[空] 没有可扫描的面板'; RETURN; END
SET @sql = LEFT(@sql, LEN(@sql) - LEN(N'UNION ALL')) + N' ORDER BY 全空单数 DESC;';
EXEC sp_executesql @sql;
