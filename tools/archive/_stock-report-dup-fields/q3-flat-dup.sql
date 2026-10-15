-- q3-flat-dup.sql — 所有 flat(报表/平表)面板的字段重复体检
SET NOCOUNT ON;

PRINT '== 1. flat 面板清单 + 字段数 ==';
SELECT p.panel_code, p.panel_name, p.line_table, COUNT(f.id) AS 字段数
FROM yj_panel p LEFT JOIN yj_field f ON f.panel_code = p.panel_code
WHERE p.mode = 'flat'
GROUP BY p.panel_code, p.panel_name, p.line_table
ORDER BY p.panel_code;

PRINT '== 2. flat 面板中 label 重复(UI 会出现两列) ==';
SELECT f.panel_code, p.panel_name, f.label, COUNT(*) AS 次数,
       STRING_AGG(CAST(f.id AS varchar(10)) + '[' + f.place + ',seq' + CAST(f.seq AS varchar(10)) + ',ref='
                  + ISNULL(f.ref_panel, '-') + ']', ' ; ') AS 明细
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.mode = 'flat'
GROUP BY f.panel_code, p.panel_name, f.label
HAVING COUNT(*) > 1
ORDER BY f.panel_code, f.label;

PRINT '== 3. flat 面板中 col_name 重复 ==';
SELECT f.panel_code, f.col_name, COUNT(*) AS 次数,
       STRING_AGG(CAST(f.id AS varchar(10)) + '[' + f.place + ',seq' + CAST(f.seq AS varchar(10)) + ']', ' ; ') AS 明细
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.mode = 'flat'
GROUP BY f.panel_code, f.col_name
HAVING COUNT(*) > 1
ORDER BY f.panel_code, f.col_name;

PRINT '== 4. flat 面板中「列名在底层表/视图里不存在」的字段(会渲染空列) ==';
SELECT f.panel_code, f.id, f.col_name, f.place, f.seq
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.mode = 'flat'
  AND OBJECT_ID(N'dbo.' + p.line_table) IS NOT NULL
  AND COL_LENGTH(N'dbo.' + p.line_table, f.col_name) IS NULL
ORDER BY f.panel_code, f.seq, f.id;
