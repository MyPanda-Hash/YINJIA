-- q-11-all-doc-empty-detail-audit.sql — 全库审计:哪些单据存在「明细不可见」问题
-- 两种失效模式(都以"单头未作废"为前提):
--   ① 明细行都在,但**全部** asp_cancel='Y'(面板过滤 ⇒ 看起来空)——本次事故的形态;
--   ② 明细**一行都没有**(被真删 / 生成时漏带)。
-- ⚠ 动态 SQL 拼接防坑:任何参与拼接的列都要 ISNULL,否则一个 NULL 会让整条 @sql 变成 NULL(上次就是这么扫出"0 行"的假阴性)。
SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (panel_code sysname, panel_name nvarchar(100), head_tbl sysname, line_tbl sysname, head_key sysname);
INSERT INTO #p (panel_code, panel_name, head_tbl, line_tbl, head_key)
SELECT p.panel_code, ISNULL(p.panel_name, N''), 
       CASE WHEN p.line_table LIKE 'bl[_]%' THEN N'bd_' + SUBSTRING(p.line_table, 4, 200)
            WHEN p.line_table LIKE '%[_]detail' THEN LEFT(p.line_table, LEN(p.line_table) - 7)
            ELSE p.line_table END,
       p.line_table,
       CASE WHEN COL_LENGTH(p.line_table, '单据编号') IS NOT NULL THEN N'单据编号' ELSE N'单号' END
FROM yj_panel p
WHERE p.mode = 'doc' AND ISNULL(p.line_table, N'') <> ''
  AND COL_LENGTH(p.line_table, 'asp_cancel') IS NOT NULL;

SELECT N'A 待扫面板数' AS t, COUNT(*) AS 面板数,
       SUM(CASE WHEN OBJECT_ID(head_tbl) IS NOT NULL THEN 1 ELSE 0 END) AS 头表存在,
       SUM(CASE WHEN OBJECT_ID(head_tbl) IS NOT NULL AND COL_LENGTH(head_tbl, head_key) IS NOT NULL THEN 1 ELSE 0 END) AS 可扫
FROM #p;

-- ① 明细全作废
DECLARE @s1 nvarchar(max) = N'';
SELECT @s1 = ISNULL(@s1, N'') + N'
SELECT N''① 明细全作废'' AS 模式, ''' + panel_code + N''' AS 面板, ''' + panel_name + N''' AS 面板名, ''' + line_tbl + N''' AS 明细表, COUNT(*) AS 单数
FROM [' + head_tbl + N'] h
WHERE ISNULL(h.asp_cancel, N''N'') <> N''Y''
  AND EXISTS (SELECT 1 FROM [' + line_tbl + N'] d WHERE d.[' + head_key + N'] = h.[' + head_key + N'])
  AND NOT EXISTS (SELECT 1 FROM [' + line_tbl + N'] d WHERE d.[' + head_key + N'] = h.[' + head_key + N'] AND ISNULL(d.asp_cancel, N''N'') <> N''Y'')
UNION ALL'
FROM #p WHERE OBJECT_ID(head_tbl) IS NOT NULL AND COL_LENGTH(head_tbl, head_key) IS NOT NULL;
IF LEN(ISNULL(@s1, N'')) > 0 BEGIN
  SET @s1 = LEFT(@s1, LEN(@s1) - LEN(N'UNION ALL')) + N';';
  EXEC sp_executesql @s1;
END ELSE PRINT N'[①] 无可扫面板';

-- ② 明细一行都没有
DECLARE @s2 nvarchar(max) = N'';
SELECT @s2 = ISNULL(@s2, N'') + N'
SELECT N''② 明细零行'' AS 模式, ''' + panel_code + N''' AS 面板, ''' + panel_name + N''' AS 面板名, ''' + line_tbl + N''' AS 明细表, COUNT(*) AS 单数
FROM [' + head_tbl + N'] h
WHERE ISNULL(h.asp_cancel, N''N'') <> N''Y''
  AND NOT EXISTS (SELECT 1 FROM [' + line_tbl + N'] d WHERE d.[' + head_key + N'] = h.[' + head_key + N'])
UNION ALL'
FROM #p WHERE OBJECT_ID(head_tbl) IS NOT NULL AND COL_LENGTH(head_tbl, head_key) IS NOT NULL;
IF LEN(ISNULL(@s2, N'')) > 0 BEGIN
  SET @s2 = LEFT(@s2, LEN(@s2) - LEN(N'UNION ALL')) + N';';
  EXEC sp_executesql @s2;
END ELSE PRINT N'[②] 无可扫面板';
